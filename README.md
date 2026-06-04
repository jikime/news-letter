# Marketing Weekly — 마케팅 뉴스레터 서비스

방문자 구독 → Supabase 저장 → 관리자 작성/예약 → Vercel Cron 스케줄러 → Resend 발송.
Next.js App Router · TypeScript · TailwindCSS v4 · shadcn UI · Supabase · Resend · Vercel Cron.

## 빠른 시작
```bash
npm install
cp .env.example .env.local   # 값 채우기 (Supabase/Resend/CRON_SECRET)
# Supabase SQL Editor에 supabase/migrations/0001_init.sql 실행
npm run dev                  # http://localhost:3000
```
자세한 절차·배포·보안 주의: **[artifacts/05-setup-guide.md](artifacts/05-setup-guide.md)**

## 화면
| 경로 | 설명 |
|---|---|
| `/` | 공개 마케팅 랜딩 + 구독 폼 |
| `/admin` | 구독자 목록 (데모: 인증 없음) |
| `/admin/compose` | 뉴스레터 작성 + 발송 예약 |

## API
| 경로 | 메서드 | 설명 |
|---|---|---|
| `/api/subscribe` | POST | 구독 등록(이메일 검증·중복 409) |
| `/api/admin/subscribers` | GET | 구독자 목록 |
| `/api/admin/newsletters` | POST | 작성(+선택 즉시 예약) |
| `/api/admin/newsletters/schedule` | POST | 기존 글 예약 |
| `/api/cron/dispatch` | GET | 스케줄러 발송 엔진(Bearer CRON_SECRET) |

규약·스키마: `artifacts/03-api-contract.md`, `artifacts/02-db-schema.md`.

## 중복발송 방지 (핵심)
1. 조건부 UPDATE 잠금 — `status='scheduled' AND scheduled_at<=now()` 영향 행 수로 단일 발송자 선출, 0행이면 skip.
2. `send_logs (newsletter_id, subscriber_id)` UNIQUE — 가입자별 1회.
3. 완료 시 `status='sent'`.

## ⚠️ 운영 전 필수
관리자 영역(`/admin*`, `/api/admin/*`)은 **데모용 공개 상태**. 운영 전 인증을 반드시 추가하세요.

## 이 프로젝트는 하네스로 만들어졌습니다
설계·구현·검증 산출물은 `artifacts/`에, 제작 하네스(Agent/Skill/Orchestrator)는 `.claude/`에 있습니다.
재실행·부분 수정: "스케줄러만 다시", "관리자 화면 보완" 등으로 요청 → `newsletter-build-orchestrator`가 해당 부분만 갱신.
# news-letter
