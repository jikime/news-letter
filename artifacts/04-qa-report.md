# 04 · QA Report — Marketing Weekly

> 검증자: qa-verifier · 일자: 2026-06-04
> 기준 계약: `artifacts/03-api-contract.md`, `artifacts/02-db-schema.md`, `supabase/migrations/0001_init.sql`
> 점검 방식: 실제 빌드/타입 실행 + 전 라우트·계약·스키마 코드 정독 + 보안 grep.

---

## 전체 판정: **PASS** — critical 이슈 **없음**

빌드/타입 통과, 경계면(frontend↔contract↔backend) 일치, 중복발송 3겹 방어선 코드+스키마에 실재, service_role 클라이언트 미유입, env 전부 선언. 모든 항목 PASS.

---

## A. 빌드 / 타입

### A-1. `npx tsc --noEmit` — [PASS]
```
TSC_EXIT=0   (출력 없음 = 에러 0건)
```

### A-2. `npm run build` (next build) — [PASS]
```
▲ Next.js 15.1.6
 ✓ Compiled successfully
   Linting and checking validity of types ...
 ✓ Generating static pages (6/6)

Route (app)                              Size     First Load JS
┌ ○ /                                    3.41 kB   119 kB
├ ○ /admin                               2.13 kB   118 kB
├ ○ /admin/compose                       3.48 kB   119 kB
├ ƒ /api/admin/newsletters               146 B     105 kB
├ ƒ /api/admin/newsletters/schedule      146 B     105 kB
├ ƒ /api/admin/subscribers               146 B     105 kB
├ ƒ /api/cron/dispatch                   146 B     105 kB
└ ƒ /api/subscribe                       146 B     105 kB
```
- lint/type-check 단계 포함 통과. API 라우트는 모두 `ƒ (Dynamic)` 로 정상 서버 렌더.

---

## B. 계약 일치 (경계면 교차 검증)

| 계약(§) | 경로/메서드 | frontend 호출 | backend route | 응답 `{ok,data?,error?}` | 판정 |
|---|---|---|---|---|---|
| §1 | POST `/api/subscribe` | `app/page.tsx:67` body `{name,email}` | `app/api/subscribe/route.ts:13` | ok 201 `{id}` / 400 / 409 | [PASS] |
| §2 | GET `/api/admin/subscribers` | `app/admin/page.tsx:58` | `app/api/admin/subscribers/route.ts:12` | ok 200 `[{id,name,email,created_at}]` desc | [PASS] |
| §3 | POST `/api/admin/newsletters` | `app/admin/compose/page.tsx:49` body `{title,content,scheduled_at?}` | `app/api/admin/newsletters/route.ts:14` | ok 201 `{id,status,scheduled_at?}` | [PASS] |
| §4 | POST `/api/admin/newsletters/schedule` | (호출 UI 없음 — 아래 minor) | `app/api/admin/newsletters/schedule/route.ts:15` | ok 200 / 404 / 422 / 400 | [PASS] |
| §5 | GET `/api/cron/dispatch` | (cron, vercel.json) | `app/api/cron/dispatch/route.ts:33` | ok 200 `{processed,sent,failed}` / 401 | [PASS] |

- **응답 형식 통일** — [PASS] 모든 라우트가 `lib/api.ts`의 `ok()/fail()` 헬퍼만 사용. 형식 `{ok:true,data}` / `{ok:false,error:{code,message}}` 일관(`lib/api.ts:28-41`). 에러 코드 enum이 계약 §0 표와 1:1 일치(`lib/api.ts:19-26`).
- **필드명 일치** — [PASS] subscribe body `{name,email}`, newsletters `{title,content,scheduled_at}`, cron 응답 `{processed,sent,failed}` 모두 계약 §6 컬럼표와 동일.
- frontend의 클라이언트측 `ApiResponse` 타입이 계약 형태와 동일하게 선언됨(`app/page.tsx:17-19`, `app/admin/page.tsx:29-31`, `app/admin/compose/page.tsx:24-26`).

### B-1. [PASS][minor 참고] `/schedule` (§4) 라우트는 구현·계약 일치하나 호출 UI 없음
- `app/admin/compose/page.tsx`는 작성+즉시예약(§3)만 사용. 기존 draft를 사후 예약하는 §4 라우트를 부르는 화면 없음.
- 계약상 §4 라우트는 요구되며 구현은 정확함. 데모 범위에서 화면 미연결은 결함 아님(기능 누락 아닌 UI 미노출).
  → frontend-dev: (선택) 추후 draft 목록 + "예약" 버튼에서 `/api/admin/newsletters/schedule` 연결 권장. 차단 사유 아님.

---

## C. 데이터 / 검증

### C-1. subscribers.email UNIQUE — [PASS]
- migration: `constraint subscribers_email_key unique (email)` `supabase/migrations/0001_init.sql:19`.

### C-2. 구독 이메일 형식 검증 + 중복 409 — [PASS]
- 형식: `subscribeSchema` `lib/validation.ts:27-34` (`.email()` + trim + toLowerCase).
- 중복: `error.code === "23505"` → 409 CONFLICT `app/api/subscribe/route.ts:38-39`.
- frontend도 1차 이메일 정규식 검증 `app/page.tsx:21,60`.

### C-3. newsletters.status CHECK + 인덱스 — [PASS]
- CHECK in (draft/scheduled/sending/sent) `0001_init.sql:30-31`.
- `newsletters_due_idx (status, scheduled_at)` `0001_init.sql:38-39`.

### C-4. schedule 상태 전이 (404 / 422) — [PASS]
- 대상 없음 404: `0001_init` 대상 maybeSingle → `schedule/route.ts:42-44`.
- sending/sent 422 INVALID_STATE: `schedule/route.ts:49-55`.
- 동시성 가드: update에 `.in("status",["draft","scheduled"])` 후 영향행 0 → 422 `schedule/route.ts:62,69-76`.

---

## D. 중복발송 방지 (critical 영역)

### D-1. 조건부 UPDATE 잠금 — [PASS][critical 통과]
- `app/api/cron/dispatch/route.ts:77-83`: `.update({status:'sending'}).eq('id').eq('status','scheduled').lte('scheduled_at',now).select('id')`.
- 영향 행 0건이면 skip: `route.ts:91-93`. 계약 §5-a 정확 구현. processed는 잠금 성공 글만 +1(`route.ts:95`).

### D-2. send_logs UNIQUE + onConflict — [PASS][critical 통과]
- 스키마: `constraint send_logs_once unique (newsletter_id, subscriber_id)` `0001_init.sql:51`.
- 코드: `.upsert({...}, { onConflict:"newsletter_id,subscriber_id", ignoreDuplicates:true })` `route.ts:118-131`. 부분 재실행 시 가입자별 1회 보장.

### D-3. 완료 status='sent' 전이 — [PASS]
- `route.ts:145-148`: `.update({status:'sent', sent_at:now()})`. 이후 D-1 조건에서 영원히 0행 → 재발송 불가.

### D-4. cron 인증 (Bearer CRON_SECRET) — [PASS]
- `route.ts:35-43`: `authHeader !== "Bearer " + cronSecret` → 401 UNAUTHORIZED. 시크릿 미설정 시에도 401(fail-safe).
- vercel.json cron 등록 확인 `vercel.json:2-7` (`*/5 * * * *`).

---

## E. 보안 / 환경

### E-1. service_role 키 클라이언트 미유입 — [PASS][critical 통과]
- `SUPABASE_SERVICE_ROLE_KEY` 참조는 `lib/supabase/server.ts:26` 단 1곳.
- `lib/supabase/server.ts`, `lib/email/resend.ts` 둘 다 `"use client"` 없음(서버 모듈).
- 이를 import하는 파일은 전부 `app/api/**/route.ts`(서버 핸들러)뿐. `"use client"` 파일(app/page.tsx, app/admin/page.tsx, app/admin/compose/page.tsx)은 server 클라이언트나 service_role을 import하지 않고 `fetch`로만 통신.

### E-2. 코드가 쓰는 env 전부 `.env.example`에 선언 — [PASS]
| 코드 참조 | 위치 | .env.example |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | server.ts:25,35 | ✓ line 3 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | server.ts:36 | ✓ line 4 |
| SUPABASE_SERVICE_ROLE_KEY | server.ts:26 | ✓ line 6 |
| RESEND_API_KEY | resend.ts:55 | ✓ line 10 |
| RESEND_FROM | resend.ts:56 | ✓ line 12 |
| CRON_SECRET | dispatch/route.ts:35 | ✓ line 16 |
- 누락 없음. (`.env.example`에 선언된 `NEXT_PUBLIC_SITE_URL`은 현재 코드 미사용 — 무해, 선택값으로 표기되어 있음.)

### E-3. 관리자 화면 보호 — [검증 제외, 경고 명시]
> ⚠️ **경고: `/admin`, `/admin/compose` 및 `/api/admin/*` 는 현재 인증 없이 공개 상태(데모 합의). 운영 전환 전 반드시 관리자 인증(미들웨어/Auth)을 추가할 것.**

---

## 재작업 지시
- critical / major FAIL **없음**. 담당 Agent 재작업 SendMessage 불필요.
- (선택·minor) frontend-dev: §4 schedule 라우트 호출 UI 미연결 — 데모 범위 내 결함 아님. 운영 확장 시 연결 권장.

## 운영 전환 권고 (차단 아님)
1. 관리자 인증 추가(E-3).
2. RLS 세분화 + unsubscribe/consent 컬럼(02-db-schema §6 권고).
3. cron 발송 실패 건 재시도 정책 정의(현재 실패해도 글은 'sent' 마감 — `route.ts:144` 의도된 설계).
