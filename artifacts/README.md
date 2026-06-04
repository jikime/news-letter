# artifacts — 산출물 지도

뉴스레터 서비스 제작 하네스의 중간·최종 산출물이 모이는 곳이다.
다음 실행은 여기 파일을 읽고 "전체 다시"가 아니라 "필요한 부분만" 이어간다.

## 산출물 흐름

| 순서 | 파일 | 만드는 역할 | 다음 단계가 읽는 법 | 상태 |
|---|---|---|---|---|
| 1 | `01-architecture.md` | architect | 폴더구조·데이터흐름·상태흐름·중복방지 전략 | ✅ 완료 |
| 2 | `02-db-schema.md` + `../supabase/migrations/0001_init.sql` | architect | FE/BE가 컬럼·제약 참조 | ✅ 완료 |
| 3 | `03-api-contract.md` | architect | FE/BE 공통 입출력 규약 | ✅ 완료 |
| 4 | (실제 코드 `../app`, `../lib`, `../components`) | FE·BE·Scheduler | — | ✅ 완료 |
| 5 | `04-qa-report.md` | qa-verifier | 통과/실패·재작업 지시 | ✅ 완료 (PASS) |
| 6 | `05-setup-guide.md` | Orchestrator | 사람이 키 입력·migration·배포 | ✅ 완료 |
| — | `improvement-log.md` | Orchestrator | 재실행·개선 근거 | ✅ |

## 실행 모드
- 초기 실행: 위 표가 모두 ⬜ → 전체 파이프라인.
- 부분 재실행: "스케줄러만 다시" 등 → 해당 산출물만 갱신 + QA 재검증.

## 사람 승인 게이트 (자동 실행 금지)
- `.env` 실제 키 입력 · Supabase migration 실행 · Vercel 배포 · **실제 메일 발송** → 사용자가 직접.
- 관리자 화면은 **데모 전용(보호 없음)**. 운영 전 인증 추가 필요.

## 입구
`.claude/skills/newsletter-build-orchestrator/SKILL.md` (자연어로 "뉴스레터 서비스 만들어줘" 하면 자동 연결)
