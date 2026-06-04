---
name: newsletter-build-orchestrator
description: >-
  Next.js 뉴스레터 랜딩 서비스(구독·관리자 작성/예약·Vercel Cron 스케줄러·Resend 발송)를
  설계부터 구현·검증까지 Agent Team으로 만드는 전체 흐름의 입구·진행 관리자.
  사용 키워드 — "뉴스레터 서비스 만들어줘", "뉴스레터 랜딩 페이지 구현",
  "구독 기능 만들어", "관리자 발송 예약", "스케줄러로 메일 발송", "Resend 연동",
  "Supabase 구독자 저장", 그리고 후속 작업 — "스케줄러만 다시", "관리자 화면만 보완",
  "DB 스키마 재설계", "API 다시", "재실행", "업데이트", "보완", "이전 결과 기반".
  단순 단일 파일 편집이나 뉴스레터와 무관한 코딩 질문에는 사용하지 않는다.
---

# Newsletter Build Orchestrator

Next.js 뉴스레터 서비스를 **설계 → 구현 → 검증 → 실행가이드**까지 Agent Team으로 만드는 입구다.
코드를 바로 쏟아내지 않고, 공유 계약(DB·API)을 먼저 세운 뒤 화면·백엔드·스케줄러를 병렬로 만들고, 모듈마다 점진 검증한다.

## 기술 스택 (고정)
Next.js App Router · TypeScript · TailwindCSS · Shadcn UI · Supabase · Resend · Vercel Cron.

## 산출물 계약

| 파일 | 만드는 역할 | 다음 단계가 읽는 법 |
|---|---|---|
| `artifacts/README.md` | Orchestrator | 산출물 지도 |
| `artifacts/01-architecture.md` | architect | 폴더구조·상태흐름·중복방지 전략 |
| `artifacts/02-db-schema.md` + `supabase/migrations/0001_init.sql` | architect | FE/BE가 컬럼·제약 참조 |
| `artifacts/03-api-contract.md` | architect | FE/BE 공통 입출력 규약 |
| 실제 코드(`app/`, `lib/`, `components/`, `app/api/`) | FE·BE·Scheduler 개발자 | — |
| `artifacts/04-qa-report.md` | qa-verifier | 통과/실패·재작업 지시 |
| `artifacts/05-setup-guide.md` | Orchestrator | 사람이 키 입력·migration·배포 |
| `artifacts/improvement-log.md` | Orchestrator | 재실행 근거 |

## 실행 모드 (반드시 먼저 분기)

`artifacts/` 와 프로젝트 루트 코드 존재 여부를 먼저 확인한다.

| 모드 | 조건 | 처리 |
|---|---|---|
| 초기 실행 | 산출물 없음 | 전체 파이프라인(아래 흐름 1~7) |
| 부분 재실행 | "스케줄러만 다시" / "관리자 화면 보완" / "DB 재설계" 등 | 해당 Agent만 재가동 + 계약 변경 시 의존 Agent 동기화 + qa 재검증 |
| 업데이트/보완 | 기존 코드 기반 수정 | 영향 범위만 읽고 수정, 계약 파일 갱신 |

부분 재실행 키워드: 스케줄러만 / 관리자만 / 랜딩만 / API만 / DB 스키마 / 재실행 / 업데이트 / 보완 / 이전 결과 기반 / 다시.

## Agent Team 실행 흐름

1. **모드 분기** — `artifacts/` 확인. 부분 재실행이면 해당 단계로 점프.
2. **TeamCreate** — 필요한 팀원만 구성. 초기 실행은 5명:
   `architect`, `frontend-dev`, `backend-dev`, `scheduler-email-dev`, `qa-verifier`.
3. **TaskCreate** (의존관계):
   - T1 `architect`: 01·02·03 + `0001_init.sql` (선행, 모든 작업의 기준)
   - T2 `backend-dev`: 구독등록/목록/작성/예약 API (T1 의존)
   - T3 `frontend-dev`: 랜딩 + 관리자 3화면 (T1 의존, T2와 병렬)
   - T4 `scheduler-email-dev`: Vercel Cron + 발송 API + Resend + 중복방지 (T1 의존)
   - T5 `qa-verifier`: 모듈 끝나는 즉시 점진 검증 (T2·T3·T4 부분 의존)
4. **SendMessage** — 계약 변경/충돌/발견 공유. 예: architect가 중복방지를 DB 조건부 UPDATE로 확정하면 scheduler-email-dev에 통지.
5. **TaskUpdate / TaskGet** — 진행·차단·지연 점검. 차단 시 재할당.
6. **통합** — Orchestrator가 `artifacts/` 를 읽어 `05-setup-guide.md`(패키지 설치·env·migration·cron·배포 절차) 작성.
7. **사람 승인 게이트** — `.env` 실제 키 입력, Supabase migration 실행, Vercel 배포, **실제 메일 발송**은 사용자가 직접. 자동 실행 금지.
8. **TeamDelete** + `improvement-log.md`에 날짜·변경·대상·사유 기록.

## 핵심 위험: 중복발송 방지 (반드시 관철)
- `newsletters.status`: `draft → scheduled → sending → sent`.
- 발송 시작 시 `UPDATE newsletters SET status='sending' WHERE id=? AND status='scheduled' AND scheduled_at<=now()` 의 **영향 행 수로 잠금 획득**(원자적). 0행이면 다른 실행이 이미 잡음 → skip.
- `send_logs (newsletter_id, subscriber_id)` 유니크 제약으로 가입자별 1회 보장.
- 완료 시 `status='sent'`, `sent_at` 기록.

## 관리자 화면 보호
이 하네스는 **보호 없음(데모 전용)** 으로 합의됨. 관리자 화면/API에 인증을 강제하지 않는다.
다만 `05-setup-guide.md`와 QA 리포트에 "공개 상태이며 운영 전 인증 추가 필요" 경고를 남긴다.

## 각 단계가 참조할 작업 Skill
- architect → `supabase-schema-design`
- frontend-dev / backend-dev → `nextjs-feature-impl`
- scheduler-email-dev → `scheduled-email-dispatch`
- qa-verifier → `build-qa-check`

## 품질 기준
- TypeScript 타입 체크·`next build` 통과.
- 모든 API: 입력 검증 + 에러 처리 + 성공 응답 형식 통일(`{ ok, data?, error? }`).
- 이메일 형식 검증 + 중복 이메일 차단(DB unique + API 사전 체크).
- FE가 호출하는 API 경로/필드가 `03-api-contract.md`와 일치.
- 환경변수 누락 없음(`.env.example` 제공).

## 예외 / 정지 조건
- 사용자가 "지금 실제 가입자에게 발송"을 요청해도 키·배포 미설정 시 정지하고 setup-guide 안내.
- 사용자가 중복방지 제거를 요청하면 위험 경고 후 기본은 방지 유지.
