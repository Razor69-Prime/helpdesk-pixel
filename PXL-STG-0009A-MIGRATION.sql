begin;
create extension if not exists pgcrypto;

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(), user_id text not null, user_name text not null,
  year integer not null, opening_balance numeric(6,2) not null default 0, used_days numeric(6,2) not null default 0,
  remaining_balance numeric(6,2) not null default 0, notes text, updated_by text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,year)
);
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(), request_number text not null unique,
  applicant_user_id text not null, applicant_name text not null, company text, division text, job_title text,
  start_date date not null, end_date date not null, duration_days numeric(6,2) not null default 1, return_date date,
  leave_type text not null check(leave_type in ('permission','annual_leave','maternity_leave','other')),
  leave_type_other text, reason text not null, pic_user_id text, pic_name text,
  opening_balance numeric(6,2) not null default 0, remaining_balance numeric(6,2) not null default 0,
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','cancelled')),
  applicant_signature text, applicant_signed_by text, applicant_signed_at timestamptz,
  pic_signature text, pic_signed_by text, pic_signed_at timestamptz,
  approver_user_id text, approver_name text, approver_role text, approver_signature text, approved_at timestamptz, decision_note text,
  submitted_at timestamptz, created_by text not null, created_by_id text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.leave_request_history (
  id uuid primary key default gen_random_uuid(), leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  action text not null, note text, actor_user_id text, actor_name text, actor_role text, created_at timestamptz not null default now()
);
create index if not exists idx_leave_requests_applicant on public.leave_requests(applicant_user_id,created_at desc);
create index if not exists idx_leave_requests_pic on public.leave_requests(pic_user_id,status);
create index if not exists idx_leave_history_request on public.leave_request_history(leave_request_id,created_at);
grant select,insert,update,delete on public.leave_requests,public.leave_balances,public.leave_request_history to service_role;
commit;
