-- =====================================================================
-- Marketing Weekly · 0001_init
-- Newsletter service schema: subscribers / newsletters / send_logs
-- Idempotent (if not exists). 두 번 실행해도 안전.
-- Postgres / Supabase. RLS: anon은 구독 insert만, 관리/발송은 service_role.
-- =====================================================================

-- gen_random_uuid() 제공 (Supabase는 기본 활성, 안전망)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- subscribers : 가입자 (email 중복 가입 차단)
-- ---------------------------------------------------------------------
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  created_at timestamptz not null default now(),
  constraint subscribers_email_key unique (email)   -- 중복 가입 방지
);

-- ---------------------------------------------------------------------
-- newsletters : 작성 · 예약 · 상태 관리
-- status: draft → scheduled → sending → sent
-- ---------------------------------------------------------------------
create table if not exists public.newsletters (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  content      text not null,
  status       text not null default 'draft'
               check (status in ('draft','scheduled','sending','sent')),
  scheduled_at timestamptz,        -- 예약 발송 시간 (scheduled 이상에서 사용)
  sent_at      timestamptz,        -- 발송 완료 시각
  created_at   timestamptz not null default now()
);

-- 스케줄러 조회용: "보낼 때가 된 scheduled 글" 빠른 탐색
create index if not exists newsletters_due_idx
  on public.newsletters (status, scheduled_at);

-- ---------------------------------------------------------------------
-- send_logs : 발송 결과 + 가입자별 1회 보장
-- ---------------------------------------------------------------------
create table if not exists public.send_logs (
  id            uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  status        text not null check (status in ('success','failed')),
  error         text,
  sent_at       timestamptz not null default now(),
  constraint send_logs_once unique (newsletter_id, subscriber_id)  -- 중복발송 방지
);

-- 뉴스레터별 발송 현황 집계 조회용
create index if not exists send_logs_newsletter_idx
  on public.send_logs (newsletter_id);

-- =====================================================================
-- RLS — Row Level Security
--   subscribers : anon insert 허용(구독 폼), select는 service_role만
--   newsletters / send_logs : service_role 전용 (anon 정책 없음 = 거부)
-- service_role 키는 RLS를 우회하므로 별도 정책 없이도 서버 라우트는 전 권한.
-- =====================================================================

alter table public.subscribers enable row level security;
alter table public.newsletters enable row level security;
alter table public.send_logs   enable row level security;

-- subscribers: 익명 구독(insert) 허용
drop policy if exists "subscribers_anon_insert" on public.subscribers;
create policy "subscribers_anon_insert"
  on public.subscribers
  for insert
  to anon
  with check (true);

-- (명시) anon에는 select/update/delete 정책을 주지 않는다 → service_role만 조회 가능.
-- newsletters / send_logs : anon 정책 없음 → 모든 anon 접근 거부, service_role만 접근.
