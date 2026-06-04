---
name: scheduled-email-dispatch
description: >-
  Vercel Cron으로 예약 뉴스레터를 주기 점검하고 발송 시간이 지난 미발송 건을 전체 가입자에게 Resend로 발송하며,
  중복발송을 원자적 잠금으로 막고 발송 결과를 기록하는 작업 매뉴얼. scheduler-email-dev 에이전트가 따른다.
---

# Scheduled Email Dispatch

## 트리거
scheduler-email-dev가 Cron·발송·Resend·중복방지를 구현할 때.

## 절차 (cron 핸들러 한 번의 실행)
1. **인증**: `Authorization: Bearer ${CRON_SECRET}` 검증. 불일치 401.
2. **대상 조회**: `status='scheduled' AND scheduled_at <= now()` 인 뉴스레터 목록.
3. **각 뉴스레터마다 잠금 획득**:
   ```
   update newsletters set status='sending'
   where id = :id and status='scheduled' and scheduled_at <= now()
   returning id;
   ```
   반환 0행이면 다른 실행이 이미 처리 → skip (중복발송 방지 핵심).
4. **가입자 조회**: subscribers 전체.
5. **발송**: 각 가입자에게 Resend로 발송. title=제목, content=본문. rate limit 고려해 순차/소배치.
6. **결과 기록**: `send_logs`에 (newsletter_id, subscriber_id, status, error) upsert(onConflict로 재시도 안전).
7. **완료 처리**: `update newsletters set status='sent', sent_at=now() where id=:id`.
8. 실패 수신자는 success로 마감하지 않고 failed 기록만. 전체 실패해도 status는 sent로 마감하되 로그에 남김(재발송은 별도 운영 결정).

## Vercel Cron 등록 (`vercel.json`)
```json
{ "crons": [ { "path": "/api/cron/dispatch", "schedule": "* * * * *" } ] }
```
> Vercel Hobby는 cron 빈도 제한이 있으니 setup-guide에 안내(예: 분 단위는 Pro). 데모 기본은 `*/5 * * * *` 등 보수적으로.

## Resend (`lib/email/resend.ts`)
```ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
export async function sendNewsletter(to: string, subject: string, html: string) {
  return resend.emails.send({ from: process.env.RESEND_FROM!, to, subject, html });
}
```
- 본문이 평문이면 간단히 HTML 래핑. 발송 실패 시 throw → 호출부가 failed 기록.

## 중복발송 방지 — 절대 기준
- 조건부 UPDATE 잠금(영향 행 수) + `send_logs (newsletter_id, subscriber_id)` UNIQUE 둘 다.
- 사용자가 "중복방지 빼도 돼"라고 해도 위험 경고 후 기본 유지.

## 사람 승인 게이트
- 실제 발송은 사용자가 키(`RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`) 입력 + 배포 후에만. 코드는 준비하되 자동 실제 발송 금지.
- 로컬 테스트는 수동 트리거(`curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/dispatch`) 안내.

## 출력
- `app/api/cron/dispatch/route.ts`, `lib/email/resend.ts`, `vercel.json`.

## 품질 체크
- 잠금 조건부 UPDATE 존재. send_logs UNIQUE 사용. CRON_SECRET 검증 존재.
- 같은 뉴스레터 2회 실행해도 1회만 발송됨(2번째는 0행 skip).
- 부분 실패 처리. `tsc --noEmit` 통과.
