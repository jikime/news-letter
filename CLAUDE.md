# 프로젝트 안내 — 뉴스레터 서비스 제작 하네스

Next.js 기반 **뉴스레터 랜딩 서비스**(방문자 구독 → Supabase 저장 → 관리자 작성/예약 → Vercel Cron 스케줄러 → Resend 발송)를
설계부터 구현·검증·실행가이드까지 **Agent Team**으로 만드는 하네스다.

## 자연어 라우팅 (먼저 읽기)
아래 성격의 요청이면 스킬명을 직접 입력하지 않아도 **`newsletter-build-orchestrator` 스킬을 먼저 사용**한다.

- "뉴스레터 서비스/랜딩 페이지 만들어줘", "구독 기능 구현", "관리자 발송 예약 화면" → 초기 실행(전체 파이프라인)
- "스케줄러로 메일 발송", "Resend 연동", "Supabase 구독자 저장" → 초기 실행 또는 해당 모듈
- "스케줄러만 다시", "관리자 화면만 보완", "DB 스키마 재설계", "API 다시", "재실행", "업데이트", "보완", "이전 결과 기반" → 부분 재실행
- 직접 호출 예: `newsletter-build-orchestrator` 스킬 실행

## 무엇을 만드나
| 영역 | 내용 |
|---|---|
| 공개 화면 | 뉴스레터 소개 랜딩 + 이름·이메일 구독 폼 |
| 관리자 화면 | 구독자 목록 / 뉴스레터 작성 / 발송 예약 (**보호 없음, 데모 전용**) |
| API | 구독등록·구독자목록·뉴스레터작성·예약·자동발송·발송결과저장 |
| DB | Supabase: subscribers / newsletters / send_logs (+ 제약·인덱스·RLS·migration SQL) |
| 스케줄러 | Vercel Cron → 발송시간 지난 예약 뉴스레터 조회 → 전체 발송 → 결과 기록 → 상태 sent |
| 이메일 | Resend (제목=뉴스레터 제목, 본문=뉴스레터 본문, 실패 로그) |

## 팀 구성 (일상 언어)
- `architect` — DB 스키마·API 계약·중복방지 전략을 정하는 **설계자**
- `frontend-dev` — 랜딩·관리자 3화면을 만드는 **화면 개발자**
- `backend-dev` — 구독/뉴스레터 API를 만드는 **백엔드 개발자**
- `scheduler-email-dev` — Cron·Resend·중복발송 잠금을 만드는 **발송 담당자**
- `qa-verifier` — 빌드·계약 일치·중복방지를 점검하는 **검증자**

## 주요 위치
| 목적 | 위치 |
|---|---|
| 전체 진행표(입구) | `.claude/skills/newsletter-build-orchestrator/SKILL.md` |
| 작업 매뉴얼 | `.claude/skills/{supabase-schema-design, nextjs-feature-impl, scheduled-email-dispatch, build-qa-check}/SKILL.md` |
| 팀원 역할 카드 | `.claude/agents/*.md` |
| 산출물 지도 | `artifacts/README.md` |
| 설계·계약·QA·실행가이드 | `artifacts/01~05-*.md` |
| migration SQL | `supabase/migrations/` |
| 개선 이력 | `artifacts/improvement-log.md` |

## 원칙
- 파일 생성/대규모 변경은 **청사진 → 승인 → 구성** 순서.
- 코드는 만들되 **외부 발송·migration 실행·배포·실제 키 입력은 사람 승인 게이트**. 자동 발송 금지.
- **중복발송 방지**는 절대 기준: 상태 조건부 UPDATE 잠금 + `send_logs` 유니크.
- 모든 API는 입력 검증·에러 처리·통일된 성공 응답을 포함.
- 관리자 화면은 데모 전용(보호 없음). 운영 전 인증 추가 필요를 setup-guide에 경고로 남긴다.

## 변경 이력
- 2026-06-04 — 하네스 신규 구축. Agent 5 / Skill 5(오케스트레이터 1 + 작업 4) / artifacts 골격 생성. 관리자 보호: 없음(데모).
