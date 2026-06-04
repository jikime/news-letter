# 01 · Architecture — Marketing Weekly

> 브랜드: **Marketing Weekly** — 매주 한 통, 마케터를 위한 큐레이션 뉴스레터.
> 스택: Next.js (App Router) · TypeScript · Supabase(Postgres + RLS) · Resend · Vercel Cron.
> 이 문서는 backend-dev · frontend-dev · scheduler-email-dev가 따르는 **단일 설계 기준**이다.

---

## 1. 폴더 구조

```
news-letter/
├─ app/
│  ├─ page.tsx                      # 공개 구독 랜딩 (구독 폼)
│  ├─ layout.tsx
│  ├─ admin/
│  │  ├─ page.tsx                   # 관리자 대시보드(데모, 인증 없음)
│  │  ├─ subscribers/page.tsx       # 가입자 목록
│  │  └─ newsletters/page.tsx       # 뉴스레터 작성·예약·상태 확인
│  └─ api/
│     ├─ subscribe/route.ts                 # POST  공개 구독
│     ├─ admin/
│     │  ├─ subscribers/route.ts            # GET   가입자 목록 (service_role)
│     │  └─ newsletters/
│     │     ├─ route.ts                      # POST  작성(+선택 예약)
│     │     └─ schedule/route.ts             # POST  기존 글 예약
│     └─ cron/
│        └─ dispatch/route.ts                # GET   스케줄러(발송 엔진)
├─ lib/
│  ├─ supabase/
│  │  ├─ admin.ts                   # service_role 클라이언트(서버 전용)
│  │  └─ public.ts                  # anon 클라이언트(구독 insert)
│  ├─ resend.ts                     # Resend 클라이언트 + sendMail 헬퍼
│  ├─ validation.ts                 # zod 스키마(요청 바디 검증)
│  └─ http.ts                       # ok()/fail() 응답 래퍼
├─ components/
│  └─ ui/                           # shadcn 등 UI 프리미티브 (frontend-dev)
├─ supabase/
│  └─ migrations/
│     └─ 0001_init.sql              # 테이블·인덱스·RLS DDL
├─ artifacts/                       # 설계·계약·QA 산출물
├─ .env.example
└─ vercel.json                      # Cron 스케줄 정의(scheduler-email-dev)
```

**경계 원칙**
- `lib/supabase/admin.ts`(service_role)는 **서버 라우트에서만** import. 클라이언트 번들에 절대 포함 금지.
- 구독 폼은 anon 키로 `subscribers` insert만 가능(RLS로 강제).
- 관리/발송 라우트는 모두 service_role 키 사용 → **service_role 라우트가 사실상 관리 경계**(데모: 화면 인증 없음).

---

## 2. 데이터 흐름

```
[방문자]
  └ 구독 폼 (app/page.tsx)
      └→ POST /api/subscribe { name, email }
            └→ subscribers INSERT (email UNIQUE → 중복 시 409)

[관리자]
  └ 작성/예약 (app/admin/newsletters)
      ├→ POST /api/admin/newsletters { title, content }            → newsletters(status='draft')
      ├→ POST /api/admin/newsletters { title, content, scheduled_at } → newsletters(status='scheduled')
      └→ POST /api/admin/newsletters/schedule { id, scheduled_at }  → status='scheduled'
  └ 가입자 확인
      └→ GET /api/admin/subscribers                                 → subscribers SELECT

[Vercel Cron] (주기 호출, 예: 매분/5분)
  └→ GET /api/cron/dispatch  (Authorization: Bearer CRON_SECRET)
        1) 잠금: scheduled & 도래한 글을 'sending'으로 조건부 UPDATE
        2) subscribers 전수 조회
        3) Resend 발송 → send_logs INSERT (가입자별 UNIQUE)
        4) 완료: status='sent', sent_at=now()
```

데이터 객체는 셋: **가입자(subscribers) / 뉴스레터(newsletters) / 발송결과(send_logs)**.

---

## 3. 상태 흐름 (newsletters.status)

```
draft ─────────────► scheduled ─────────────► sending ─────────────► sent
  │  POST schedule /     │  cron 잠금 획득          │  전건 발송 완료
  │  POST(+scheduled_at) │  (조건부 UPDATE 1행)     │  status='sent', sent_at=now()
```

| 상태 | 의미 | 진입 트리거 | 다음 |
|---|---|---|---|
| `draft` | 작성만 됨, 예약 안 됨 | POST /api/admin/newsletters (scheduled_at 없음) | scheduled |
| `scheduled` | 발송 예약됨 | schedule 또는 작성 시 scheduled_at 동봉 | sending |
| `sending` | 발송 진행 중(잠금 상태) | cron의 조건부 UPDATE 성공 | sent |
| `sent` | 발송 완료 | cron이 전건 처리 후 마감 | (종료) |

> `sending`은 **잠금 표식**이다. 한 번 `sending`으로 바뀌면 같은 글에 대한 다른 cron 호출의 조건부 UPDATE는 0행이 되어 skip된다.

---

## 4. 중복발송 방지 전략 (핵심 — 그대로 준수)

세 겹의 방어선으로 "같은 뉴스레터를 같은 가입자에게 두 번 보내지 않는다"를 보장한다.

### (1) 런타임 잠금 — 조건부 UPDATE의 영향 행 수
```sql
update newsletters
set status = 'sending'
where id = :id
  and status = 'scheduled'
  and scheduled_at <= now();
```
- 이 UPDATE의 **영향 행 수(rowCount)** 로 잠금을 획득한다.
- `1`이면 이 호출이 발송 권한을 가진다.
- `0`이면 (이미 다른 호출이 `sending`/`sent`로 바꿨거나 아직 시간이 안 됨) → **해당 글 skip**.
- Postgres는 단일 UPDATE를 원자적으로 처리하므로, cron이 중복 실행되어도 단 하나의 호출만 `1`을 받는다.

### (2) 데이터 보장 — send_logs UNIQUE(newsletter_id, subscriber_id)
- 가입자별 발송 결과를 INSERT할 때 같은 `(newsletter_id, subscriber_id)` 조합은 유니크 제약으로 거부된다.
- 발송 루프가 부분 재실행되더라도 이미 보낸 가입자에 대한 재INSERT는 충돌 → **가입자별 정확히 1회**.
- 권장 구현: `insert ... on conflict (newsletter_id, subscriber_id) do nothing` 후, 실제로 insert된 행만 메일 발송 대상으로 본다(혹은 발송 성공 직후 log insert).

### (3) 완료 마감
- 전건 처리 후 `update newsletters set status='sent', sent_at=now() where id=:id`.
- 이후 같은 글은 `scheduled`가 아니므로 (1)의 잠금에서 영원히 0행 → 재발송 불가.

> scheduler-email-dev 주의: (1)→(2)→(3) 순서를 반드시 지킨다. (1) 잠금 실패 시 즉시 다음 글로 넘어간다. 발송 자체 실패는 send_logs.status='failed'로 기록하되, 글 status는 전건 처리 완료 시 'sent'로 마감한다(실패 건 재시도 정책은 데모 범위 밖).

---

## 5. 응답 규약 (전 엔드포인트 공통)

모든 API는 다음 형태로만 응답한다.
```ts
type ApiResponse<T> =
  | { ok: true;  data: T }
  | { ok: false; error: { code: string; message: string } }
```
- 성공: `{ ok: true, data: ... }`
- 실패: `{ ok: false, error: { code, message } }`
- HTTP 상태코드와 함께 사용(400/401/409/500 등). 상세는 `03-api-contract.md`.

---

## 6. 주요 기술 결정과 이유

| 결정 | 이유 |
|---|---|
| **App Router + Route Handlers** | 서버 전용 비밀(service_role, RESEND, CRON_SECRET)을 클라이언트 노출 없이 다룰 단일 런타임. |
| **service_role 라우트 = 관리 경계** | 데모라 관리자 Auth 미구현. RLS로 anon은 구독 insert만, 관리/발송은 service_role 라우트로만 가능하게 막아 최소한의 경계 확보. |
| **상태 머신 + 조건부 UPDATE 잠금** | 분산/중복 cron 실행에 대해 외부 락 없이 DB 원자성만으로 단일 발송자를 선출. 간단·견고. |
| **send_logs UNIQUE** | 런타임 로직 버그가 있어도 스키마 수준에서 가입자별 1회를 최종 보장(방어적 설계). |
| **(status, scheduled_at) 복합 인덱스** | cron이 "보낼 때가 된 scheduled 글"을 매 호출 스캔 → 인덱스로 조회 비용 최소화. |
| **email UNIQUE** | 중복 가입 차단을 앱이 아닌 DB에서 강제 → 동시 가입 레이스에도 안전. |
| **Resend** | 도메인 인증·간단한 API. 발송 결과를 send_logs에 일관 기록. |
| **Vercel Cron(GET + Bearer)** | 인프라 추가 없이 주기 실행. CRON_SECRET으로 무단 호출 차단. |
| **응답 `{ ok, data, error }` 통일** | FE가 분기 한 곳으로 처리, 계약 안정성. |

> 데모 경고: 관리자 화면 자체 인증이 없다. 운영 전환 시 (a) 관리자 Auth, (b) 관리 라우트 권한 검사, (c) RLS 정책 강화가 필수.
