# 02 · DB Schema — Marketing Weekly

> 실행 DDL: `supabase/migrations/0001_init.sql` (idempotent, `if not exists`).
> 세 테이블: `subscribers` / `newsletters` / `send_logs`. 모두 `public` 스키마.

---

## 1. subscribers — 가입자

| 컬럼 | 타입 | 제약 / 기본값 | 설명 |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | 가입자 식별자 |
| `name` | `text` | `not null` | 이름 |
| `email` | `text` | `not null`, **UNIQUE** (`subscribers_email_key`) | 이메일. 중복 가입 차단 |
| `created_at` | `timestamptz` | `not null default now()` | 가입 시각 |

**제약**
- `subscribers_email_key UNIQUE (email)` — 동일 이메일 재가입 시 DB가 거부. 앱은 이를 409로 변환.

**인덱스**
- UNIQUE 제약이 email 인덱스를 자동 생성(별도 인덱스 불필요).

**RLS**
- `enable row level security`.
- 정책 `subscribers_anon_insert`: `to anon for insert with check (true)` → 공개 구독 폼이 anon 키로 insert 가능.
- select/update/delete 정책 없음 → **anon은 조회 불가, service_role(관리 API)만 조회**.

---

## 2. newsletters — 뉴스레터(작성·예약·상태)

| 컬럼 | 타입 | 제약 / 기본값 | 설명 |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | 뉴스레터 식별자 |
| `title` | `text` | `not null` | 제목 |
| `content` | `text` | `not null` | 본문(HTML/마크다운 문자열) |
| `status` | `text` | `not null default 'draft'`, **CHECK** in (`draft`,`scheduled`,`sending`,`sent`) | 상태 머신 |
| `scheduled_at` | `timestamptz` | nullable | 예약 발송 시간. scheduled 이상에서 사용 |
| `sent_at` | `timestamptz` | nullable | 발송 완료 시각(sent 진입 시 설정) |
| `created_at` | `timestamptz` | `not null default now()` | 생성 시각 |

**제약**
- `CHECK (status in ('draft','scheduled','sending','sent'))` — 허용된 상태값만.

**인덱스**
- `newsletters_due_idx (status, scheduled_at)` — 스케줄러가 "보낼 때가 된 scheduled 글"을 매 cron마다 효율적으로 조회.

**상태 전이**
`draft → scheduled → sending → sent` (역전 없음). `sending`은 cron 잠금 표식.

**RLS**
- `enable row level security`. anon 정책 없음 → anon 전면 거부. **service_role(관리/발송 라우트)만 접근**.

---

## 3. send_logs — 발송 결과(가입자별 1회 보장)

| 컬럼 | 타입 | 제약 / 기본값 | 설명 |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | 로그 식별자 |
| `newsletter_id` | `uuid` | `not null`, FK → `newsletters(id)` **on delete cascade** | 대상 뉴스레터 |
| `subscriber_id` | `uuid` | `not null`, FK → `subscribers(id)` **on delete cascade** | 수신 가입자 |
| `status` | `text` | `not null`, **CHECK** in (`success`,`failed`) | 발송 결과 |
| `error` | `text` | nullable | 실패 시 에러 메시지 |
| `sent_at` | `timestamptz` | `not null default now()` | 발송 시도 시각 |

**제약**
- `send_logs_once UNIQUE (newsletter_id, subscriber_id)` — **같은 뉴스레터를 같은 가입자에게 1회만**. 중복발송 최종 방어선.
- FK on delete cascade — 뉴스레터/가입자 삭제 시 로그도 정리.

**인덱스**
- UNIQUE 제약이 `(newsletter_id, subscriber_id)` 인덱스를 자동 생성.
- `send_logs_newsletter_idx (newsletter_id)` — 뉴스레터별 발송 현황 집계.

**RLS**
- `enable row level security`. anon 정책 없음 → **service_role(발송 라우트)만 접근**.

---

## 4. 관계도

```
subscribers (1) ──< send_logs >── (1) newsletters
                 (newsletter_id, subscriber_id) UNIQUE
```

- `send_logs`는 두 테이블을 잇는 발송 사실 기록.
- 모든 FK는 `on delete cascade`.

---

## 5. 중복발송 방지 — 스키마 측 요약

| 방어선 | 위치 | 효과 |
|---|---|---|
| 런타임 잠금 | `update newsletters set status='sending' where id=? and status='scheduled' and scheduled_at<=now()` 영향 행 수 | 글 단위로 단일 발송자 선출 |
| 데이터 보장 | `send_logs_once UNIQUE` | 가입자 단위 1회 |
| 완료 마감 | `status='sent', sent_at=now()` | 재진입 차단 |

(상세 흐름은 `01-architecture.md` §4)

---

## 6. 품질 체크리스트

- [x] `subscribers.email` UNIQUE
- [x] `newsletters.status` CHECK (draft/scheduled/sending/sent)
- [x] `send_logs` UNIQUE (newsletter_id, subscriber_id)
- [x] 스케줄러 조회 인덱스 (status, scheduled_at)
- [x] FK on delete cascade
- [x] RLS: subscribers anon insert만, newsletters/send_logs service_role 전용
- [x] DDL `if not exists` — 재실행 안전

> 데모 경고: 운영 전환 시 RLS 세분화 + 관리자 Auth + 발신 동의(consent)·구독 해지(unsubscribe) 컬럼 추가를 권장.
