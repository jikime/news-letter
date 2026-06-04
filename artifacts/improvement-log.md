# 개선 이력 (improvement-log)

하네스 실행·실패·피드백을 바탕으로 무엇을 고쳤는지 날짜·변경·대상·사유로 남긴다.

| 날짜 | 변경 내용 | 대상 | 사유 |
|---|---|---|---|
| 2026-06-04 | 하네스 신규 구축 (Agent 5 / Skill 5 / artifacts 골격) | 전체 | 뉴스레터 서비스 제작을 반복 가능한 구조로 |
| 2026-06-04 | 관리자 화면 보호: 없음(데모) 결정 → QA 검증 대상 제외, 경고만 | qa-verifier, build-qa-check | 사용자 승인 시 데모 전용으로 합의 |
| 2026-06-04 | 초기 실행 완료 — "마케팅 뉴스레터 서비스" 전체 파이프라인 빌드(설계→FE/BE/Scheduler→QA). next build 통과, QA PASS, critical 0 | 전체 코드베이스 | 사용자 요청 "마케팅 뉴스레터 서비스를 만들어줘" |
| 2026-06-04 | (관찰) /api/admin/newsletters/schedule(기존 draft 사후 예약) 호출 UI 없음 — compose는 즉시예약만 사용 | frontend-dev | minor, 데모 범위 외. 운영 확장 시 draft 목록+예약 UI 연결 권장 |
| 2026-06-04 | Supabase 실DB 구축 — 0001_init.sql을 psql(세션 풀러 aws-1-ap-southeast-2)로 실행. 3테이블·제약·인덱스·RLS 생성 확인 | DB(실환경) | 사용자 요청 "DB/테이블 생성". migration 실행=사람 승인 게이트 통과 |
| 2026-06-04 | **[critical 버그 수정]** /api/subscribe 가 anon으로 `.insert().select('id')` 호출 → anon SELECT 정책 부재로 RLS(42501) 차단, 실구독 실패. id를 서버에서 crypto.randomUUID()로 생성·명시 insert + select-back 제거로 수정. 실DB 검증: anon insert 201, 중복 409 | backend-dev(subscribe route) | 정적 QA(빌드/타입)로는 못 잡고 실DB 연결 스모크 테스트에서 발견. 최소권한(anon) 유지하며 해결 |

> 다음 실행에서 발견한 문제·재작업·계약 변경은 여기에 한 줄씩 추가한다.
