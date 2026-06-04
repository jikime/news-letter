# 05 · 실행/배포 가이드 — Marketing Weekly

이 서비스는 코드까지 완성됐다. 아래는 **사람이 직접 해야 하는** 키 입력·DB 마이그레이션·발송·배포 절차다.
(자동 실행하지 않는다 — 외부 발송·배포는 사람 승인 게이트)

---

## 0. 사전 준비물
- Node.js 18.18+ (권장 20+)
- Supabase 프로젝트 1개 (무료 플랜 가능)
- Resend 계정 + (실제 발송 시) 인증된 발신 도메인
- (배포 시) Vercel 계정

---

## 1. 패키지 설치
```bash
npm install
```

## 2. 환경 변수 설정
`.env.example` 를 복사해 `.env.local` 생성 후 값 채우기:
```bash
cp .env.example .env.local
```
| 변수 | 어디서 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 동 | 공개(구독 insert용) |
| `SUPABASE_SERVICE_ROLE_KEY` | 동 | **서버 전용, 절대 노출 금지** |
| `RESEND_API_KEY` | resend.com/api-keys | |
| `RESEND_FROM` | 인증 도메인 발신주소 | 테스트는 `onboarding@resend.dev` 가능 |
| `CRON_SECRET` | 임의의 긴 랜덤 문자열 | cron 보호 |

## 3. 데이터베이스 마이그레이션 (사람이 실행)
Supabase Dashboard → SQL Editor 에 `supabase/migrations/0001_init.sql` 내용을 붙여 실행.
(또는 Supabase CLI: `supabase db push`)
- 생성: `subscribers`, `newsletters`, `send_logs` + 제약·인덱스·RLS.
- idempotent(`if not exists`)라 재실행 안전.

## 4. 로컬 실행
```bash
npm run dev      # http://localhost:3000
```
- `/` 랜딩에서 구독 → Supabase `subscribers`에 적재 확인.
- `/admin` 구독자 목록, `/admin/compose` 작성+예약.

## 5. 발송 스케줄러 로컬 테스트 (실제 메일 주의)
예약 시간이 지난 뉴스레터가 있을 때 cron 엔진을 수동 호출:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/dispatch
```
- 응답 예: `{"ok":true,"data":{"processed":1,"sent":3,"failed":0}}`
- **두 번 호출해도** 두 번째는 `processed:0`(이미 sent) → 중복발송 안 됨. 이걸로 중복방지 검증 가능.
- ⚠️ 이 호출은 **실제 메일을 보낸다.** 테스트는 본인 이메일 소수로 가입 후 진행.

## 6. 배포 (Vercel)
```bash
# Vercel 프로젝트 연결 후
vercel
```
- Vercel 대시보드에 위 환경변수 모두 등록(특히 `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`).
- `vercel.json`의 cron(`0 9 * * *`)이 `/api/cron/dispatch`를 하루 1회 호출.
- Vercel은 cron 호출 시 `Authorization: Bearer $CRON_SECRET` 헤더를 자동 첨부(프로젝트의 CRON_SECRET 사용).

### ⚠️ Vercel Cron 빈도 & 타임존
- **현재 설정 `0 9 * * *` = Hobby 호환(하루 1회).** Vercel cron은 **UTC 기준**이라 `0 9 * * *`는 **09:00 UTC = 18:00 KST**에 실행된다. 다른 시각을 원하면 KST−9로 환산해 조정(예: 09:00 KST 발송 → `0 0 * * *`, 정오 KST → `0 3 * * *`).
- **Hobby 플랜**은 하루 1회 빈도까지만 허용. 5분/매시 같은 잦은 주기(`*/5 * * * *`, `0 * * * *`)는 **Pro 이상**에서만 동작.
- 5분 정밀 발송이 꼭 필요하고 Hobby라면, 외부 cron(cron-job.org 등)에서 `Authorization: Bearer <CRON_SECRET>` 헤더로 `/api/cron/dispatch`를 원하는 주기로 호출.

---

## 7. 운영 전 반드시 (보안 경고)
- 🔴 **관리자 화면/API는 현재 인증 없이 공개 상태(데모 합의).** `/admin`, `/admin/compose`, `/api/admin/*` 는 누구나 접근 가능.
  운영 전환 전 **Supabase Auth + 미들웨어 인증** 또는 최소한 라우트 보호를 반드시 추가하라.
- 구독 폼에 스팸/봇 방지(레이트리밋·캡차) 추가 권장.
- Resend 발송량/도메인 평판 관리, 수신거부(unsubscribe) 링크는 운영 시 법적 요구사항일 수 있음 — 별도 확장 필요.

## 8. 사람 승인 게이트 요약
| 동작 | 누가 |
|---|---|
| `.env` 실제 키 입력 | 사용자 |
| migration 실행 | 사용자 |
| 실제 메일 발송(cron/수동) | 사용자 |
| Vercel 배포 | 사용자 |
