# 03 · API Contract — Marketing Weekly

> 이 문서가 backend-dev · frontend-dev · scheduler-email-dev의 **단일 입출력 규약**이다.
> 필드명은 `02-db-schema.md`의 컬럼명과 정확히 일치한다. 응답은 전부 `{ ok, data?, error? }`.

---

## 0. 공통 규약

### 응답 형태
```ts
type ApiResponse<T> =
  | { ok: true;  data: T }
  | { ok: false; error: { code: string; message: string } }
```

### 공통 에러 코드
| HTTP | code | 의미 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 요청 바디/쿼리 검증 실패 |
| 401 | `UNAUTHORIZED` | 인증/시크릿 불일치 (cron) |
| 404 | `NOT_FOUND` | 대상 리소스 없음 |
| 409 | `CONFLICT` | 유니크 충돌(중복 가입 등) |
| 422 | `INVALID_STATE` | 상태 전이 불가(예: draft 아닌 글 재예약) |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |

### Content-Type
- 요청/응답 모두 `application/json`.

### 권한
| 경로 | Supabase 클라이언트 | 보호 |
|---|---|---|
| `/api/subscribe` | anon | 공개 |
| `/api/admin/*` | service_role | (데모) 화면 인증 없음, service_role 라우트가 경계 |
| `/api/cron/dispatch` | service_role | `Authorization: Bearer CRON_SECRET` |

---

## 1. POST /api/subscribe — 공개 구독

**요청**
```json
{ "name": "홍길동", "email": "hong@example.com" }
```
검증: `name` 비어있지 않음, `email` 형식 유효.

**성공 — 201**
```json
{ "ok": true, "data": { "id": "8f1c... (uuid)" } }
```

**검증 실패 — 400**
```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "유효한 이메일을 입력하세요." } }
```

**중복 가입 — 409** (email UNIQUE 충돌)
```json
{ "ok": false, "error": { "code": "CONFLICT", "message": "이미 구독 중인 이메일입니다." } }
```

---

## 2. GET /api/admin/subscribers — 가입자 목록

요청 바디 없음. (service_role)

**성공 — 200**
```json
{
  "ok": true,
  "data": [
    { "id": "8f1c...", "name": "홍길동", "email": "hong@example.com", "created_at": "2026-06-04T07:00:00.000Z" }
  ]
}
```
정렬 권장: `created_at desc`.

**실패 — 500**
```json
{ "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "가입자 조회에 실패했습니다." } }
```

---

## 3. POST /api/admin/newsletters — 작성 (+선택 즉시 예약)

**요청 (작성만)**
```json
{ "title": "이번 주 마케팅 트렌드", "content": "<h1>...</h1>" }
```

**요청 (작성 + 즉시 예약)** — `scheduled_at` 동봉 시 바로 `scheduled` 저장
```json
{ "title": "이번 주 마케팅 트렌드", "content": "<h1>...</h1>", "scheduled_at": "2026-06-10T00:00:00.000Z" }
```
검증: `title`/`content` 비어있지 않음. `scheduled_at`이 있으면 ISO8601 + **미래 시각**.

**성공 — 201 (예약 없이 작성)**
```json
{ "ok": true, "data": { "id": "a12b...", "status": "draft" } }
```

**성공 — 201 (작성 + 예약)**
```json
{ "ok": true, "data": { "id": "a12b...", "status": "scheduled", "scheduled_at": "2026-06-10T00:00:00.000Z" } }
```

**검증 실패 — 400**
```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "예약 시간은 미래여야 합니다." } }
```

---

## 4. POST /api/admin/newsletters/schedule — 기존 글 예약

**요청**
```json
{ "id": "a12b...", "scheduled_at": "2026-06-10T00:00:00.000Z" }
```
검증: `id` 존재, `scheduled_at` ISO8601 + 미래. 대상 글의 현재 status는 `draft`(또는 재예약 허용 시 `scheduled`)여야 함.

**성공 — 200**
```json
{ "ok": true, "data": { "id": "a12b...", "status": "scheduled", "scheduled_at": "2026-06-10T00:00:00.000Z" } }
```

**대상 없음 — 404**
```json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "뉴스레터를 찾을 수 없습니다." } }
```

**상태 전이 불가 — 422** (이미 sending/sent)
```json
{ "ok": false, "error": { "code": "INVALID_STATE", "message": "발송 중이거나 완료된 글은 예약할 수 없습니다." } }
```

**검증 실패 — 400**
```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "예약 시간은 미래여야 합니다." } }
```

---

## 5. GET /api/cron/dispatch — 스케줄러(발송 엔진)

**요청**
- 메서드: `GET`
- 헤더: `Authorization: Bearer <CRON_SECRET>`
- 바디 없음.

**동작 계약 (scheduler-email-dev 준수)**
1. 시크릿 검증 실패 → 401.
2. `select id from newsletters where status='scheduled' and scheduled_at <= now()` (인덱스 `newsletters_due_idx` 활용).
3. 각 글마다:
   a. **잠금**: `update newsletters set status='sending' where id=:id and status='scheduled' and scheduled_at<=now()` → 영향 행 0이면 **skip**.
   b. `subscribers` 전건 조회.
   c. 각 가입자에게 Resend 발송 → `send_logs` INSERT (`status` success/failed, 실패 시 `error`). `(newsletter_id, subscriber_id)` UNIQUE로 중복 차단.
   d. **마감**: `update newsletters set status='sent', sent_at=now() where id=:id`.
4. 집계 반환.

**성공 — 200**
```json
{ "ok": true, "data": { "processed": 2, "sent": 350, "failed": 3 } }
```
- `processed`: 이번 호출에서 잠금 획득하여 처리한 뉴스레터 수.
- `sent`: success 로그 총합.
- `failed`: failed 로그 총합.

**보낼 글 없음 — 200** (정상)
```json
{ "ok": true, "data": { "processed": 0, "sent": 0, "failed": 0 } }
```

**인증 실패 — 401**
```json
{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "유효하지 않은 cron 시크릿입니다." } }
```

---

## 6. 필드명 일치 표 (계약 ↔ 컬럼)

| 계약 필드 | 테이블.컬럼 |
|---|---|
| `id` | `*.id` |
| `name`, `email` | `subscribers.name`, `subscribers.email` |
| `created_at` | `subscribers.created_at` / `newsletters.created_at` |
| `title`, `content` | `newsletters.title`, `newsletters.content` |
| `status` | `newsletters.status` (draft/scheduled/sending/sent), `send_logs.status` (success/failed) |
| `scheduled_at`, `sent_at` | `newsletters.scheduled_at`, `newsletters.sent_at` |
| `newsletter_id`, `subscriber_id`, `error` | `send_logs.*` |

> 변경 시: architect가 SendMessage로 backend-dev·frontend-dev·scheduler-email-dev에 즉시 통지. 특히 중복방지(§5 a,c) 변경은 우선 공유.
