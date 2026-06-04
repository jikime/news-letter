---
name: build-qa-check
description: >-
  뉴스레터 서비스의 빌드·타입체크·FE↔API 계약 일치·중복발송 방지 로직 존재·환경변수 누락·이메일/중복 검증을
  모듈 단위로 점진 검증하는 작업 매뉴얼. qa-verifier 에이전트가 따른다.
---

# Build & QA Check

## 트리거
qa-verifier가 각 모듈 완료 직후 점진 검증할 때(전체 끝나고 한 번만 X).

## 점검 체크리스트

### A. 빌드/타입
- [ ] `npx tsc --noEmit` 통과
- [ ] `next build` 성공(가능 시) / 최소 lint
- [ ] import 경로·미사용 변수 정리

### B. 계약 일치 (경계면 교차 검증 — 최우선)
- [ ] frontend의 fetch 경로·메서드·바디 필드 == `artifacts/03-api-contract.md`
- [ ] backend의 실제 route 경로·응답 형식 == 계약
- [ ] 응답 형식 `{ ok, data?, error? }` 통일

### C. 데이터/검증
- [ ] subscribers.email UNIQUE 적용(migration)
- [ ] 구독 API 이메일 형식 검증 + 중복 409 처리
- [ ] newsletters.status CHECK + 인덱스 존재

### D. 중복발송 방지 (critical)
- [ ] 조건부 UPDATE 잠금(`status='scheduled' AND scheduled_at<=now()`) 코드 존재
- [ ] `send_logs (newsletter_id, subscriber_id)` UNIQUE 존재
- [ ] 발송 완료 후 `status='sent'` 전이
- [ ] cron 인증(CRON_SECRET) 존재

### E. 보안/환경
- [ ] service_role 키가 클라이언트 번들로 유입되지 않음(`NEXT_PUBLIC_` 아닌 키를 클라 컴포넌트에서 import 안 함)
- [ ] 코드가 쓰는 모든 env가 `.env.example`에 선언
- [ ] **관리자 보호 없음(데모)** — 검증 대상 아님. 단 리포트에 "공개 상태, 운영 전 인증 필요" 경고 1줄 명시

## 출력 — `artifacts/04-qa-report.md`
각 항목: PASS / FAIL, 근거 위치 `file:line`, severity(critical/major/minor), 재작업 지시.
형식 예:
```
## D. 중복발송 방지
- [FAIL][critical] 조건부 UPDATE 잠금 없음 — app/api/cron/dispatch/route.ts:42
  → scheduler-email-dev: where status='scheduled' AND scheduled_at<=now() 조건 추가, 영향 행 수로 skip 판정
```

## 처리 규칙
- critical 발견 시 담당 Agent에 즉시 SendMessage + Task blocked.
- 수정은 담당 Agent가. qa는 지적·재검증만(단순 오타는 제안 가능).
- 재검증은 해당 모듈만 다시.

## 예외
- 빌드 도구 미설치 등 환경 한계는 리포트에 "검증 불가 사유"로 명시하고 사람 확인 요청.
