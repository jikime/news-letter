---
name: supabase-schema-design
description: >-
  뉴스레터 서비스의 Supabase 스키마(subscribers·newsletters·send_logs)를 컬럼·관계·인덱스·제약·RLS·migration SQL로
  설계하는 작업 매뉴얼. architect 에이전트가 따른다. 구독자 저장·이메일 중복 차단·뉴스레터 상태 관리·예약 시간·발송 결과 기록·중복발송 방지를 만족하는 DDL을 만든다.
---

# Supabase Schema Design

## 트리거
architect가 DB·migration·계약을 설계할 때.

## 절차
1. 요구사항을 데이터 객체로 분해: 가입자 / 뉴스레터 / 발송결과.
2. 각 테이블의 컬럼·타입·제약·인덱스를 정한다.
3. RLS 정책을 정한다(공개 insert는 구독, 관리/발송은 service_role).
4. 중복발송 방지를 스키마 수준에서 못 박는다.
5. `0001_init.sql`을 idempotent하게 작성한다.

## 권장 스키마 (기준)

```sql
-- subscribers: 가입자, 이메일 중복 차단
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint subscribers_email_key unique (email)   -- 중복 가입 방지
);

-- newsletters: 작성·예약·상태 관리
create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  status text not null default 'draft'
    check (status in ('draft','scheduled','sending','sent')),
  scheduled_at timestamptz,        -- 예약 발송 시간
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists newsletters_due_idx
  on public.newsletters (status, scheduled_at);   -- 스케줄러 조회용

-- send_logs: 발송 결과 + 가입자별 1회 보장
create table if not exists public.send_logs (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  status text not null check (status in ('success','failed')),
  error text,
  sent_at timestamptz not null default now(),
  constraint send_logs_once unique (newsletter_id, subscriber_id)  -- 중복발송 방지
);
```

## RLS (예시 — 데모: 관리자 보호 없음)
- `subscribers`: RLS on. `insert` 익명 허용(구독 폼). `select`는 service_role만(관리자 API가 service_role 사용).
- `newsletters`, `send_logs`: service_role 전용(관리자/스케줄러가 서버에서 접근).
- 데모이므로 관리자 화면 자체 인증은 없음 → service_role 키 사용 라우트가 사실상 관리 경계. setup-guide에 "공개 데모, 운영 시 RLS+Auth 강화" 경고.

## 중복발송 방지 (스키마 + 런타임 합의)
- 런타임 잠금: `update newsletters set status='sending' where id=? and status='scheduled' and scheduled_at<=now()` 영향 행 수로 잠금 획득.
- 데이터 보장: `send_logs_once` 유니크로 같은 가입자 중복 insert 차단.

## 출력
- `artifacts/01-architecture.md`, `artifacts/02-db-schema.md`, `supabase/migrations/0001_init.sql`, `artifacts/03-api-contract.md`.

## 품질 체크
- email UNIQUE 존재. status CHECK 존재. send_logs UNIQUE 존재. 스케줄러 조회 인덱스 존재.
- SQL이 두 번 실행해도 안전(`if not exists`).
- 03 계약의 필드명이 실제 컬럼과 일치.

## 예외
- 사용자가 추가 필드(소스, 동의 여부 등) 요구 시 반영하되 핵심 제약은 유지.
