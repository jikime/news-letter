---
name: nextjs-feature-impl
description: >-
  Next.js App Router 기반으로 뉴스레터 서비스의 화면(랜딩·관리자)과 API Route(구독·구독자목록·뉴스레터작성·예약)를
  TypeScript·TailwindCSS·Shadcn UI·Supabase로 구현하는 공통 작업 매뉴얼. frontend-dev·backend-dev가 따른다.
---

# Next.js Feature Implementation

## 트리거
frontend-dev가 화면을, backend-dev가 API를 구현할 때.

## 공통 규약
- App Router(`app/`), TypeScript strict, 서버/클라이언트 컴포넌트 구분 명확히.
- API 응답 형식 통일: 성공 `{ ok: true, data }`, 실패 `{ ok: false, error: string }`. HTTP 상태코드 적절히(400/409/500).
- 입력 검증은 zod 권장. 이메일은 형식 검증 + `toLowerCase().trim()`.
- 환경변수는 `lib/env`나 직접 `process.env`로 읽되, 누락 시 명확한 에러. `.env.example` 동기화.

## Supabase Client
- `lib/supabase/server.ts`: `SUPABASE_SERVICE_ROLE_KEY` 사용, **서버 라우트 전용**. 절대 클라이언트 번들로 import 금지.
- `lib/supabase/client.ts`: `NEXT_PUBLIC_SUPABASE_*`(anon) — 필요할 때만.

## API (backend-dev)
- `POST /api/subscribe`: name·email 검증 → 중복(사전 select 또는 unique 위반 23505 → 409) → insert → 201 `{ ok, data }`.
- `GET /api/admin/subscribers`: 목록 반환(최신순).
- `POST /api/admin/newsletters`: title·content 검증 → status='draft' insert.
- `POST /api/admin/newsletters/schedule`: id + scheduled_at(미래 시각) 검증 → status='scheduled'. (작성+예약 통합 엔드포인트 허용)
- 모든 라우트: try/catch, 검증 실패 400, DB 에러 500, 메시지 한국어 가능.

## 화면 (frontend-dev)
- `app/page.tsx`(랜딩): 제목·소개·핵심가치 3가지·구독 폼(이름/이메일/버튼)·성공/실패 메시지. Shadcn `Card`,`Input`,`Button`.
- `app/admin/page.tsx`: 구독자 `Table`.
- `app/admin/compose/page.tsx`: 제목·본문(`Textarea`)·발송일시(`Input type=datetime-local`)·"예약 저장" 버튼.
- 클라이언트 검증 후 fetch, 응답 메시지 표시. 로딩/에러 상태 처리.
- 관리자 화면 **인증 없음(데모)**. 상단에 "데모용 공개 화면" 안내 한 줄.

## Shadcn UI 설치
```bash
npx shadcn@latest init
npx shadcn@latest add button input card table textarea label sonner
```

## 출력
- frontend-dev: `app/page.tsx`, `app/admin/**`, `components/**`.
- backend-dev: `lib/supabase/*.ts`, `app/api/**/route.ts`, `lib/validation.ts`.

## 품질 체크
- 호출 경로/필드가 `artifacts/03-api-contract.md`와 일치.
- 이메일 형식·중복 차단 동작. service_role 키 클라이언트 미유입.
- `tsc --noEmit` 통과. 모바일 폭 깨짐 없음.

## 예외
- 계약과 충돌하면 임의 변경 말고 architect에 SendMessage로 합의.
