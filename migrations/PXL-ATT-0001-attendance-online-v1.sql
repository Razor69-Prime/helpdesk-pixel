-- PXL-ATT-0001 — Attendance Online V1 (additive only)
create extension if not exists pgcrypto;

create table if not exists public.attendance_rules (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 1 and 7),
  is_workday boolean not null default true,
  check_in_time time,
  check_out_time time,
  timezone text not null default 'Asia/Makassar',
  overtime_stage1_minutes integer not null default 120 check (overtime_stage1_minutes >= 0),
  overtime_stage2_minutes integer not null default 240 check (overtime_stage2_minutes >= overtime_stage1_minutes),
  is_active boolean not null default true,
  updated_by_id text,
  updated_by_name text,
  updated_at timestamptz not null default now(),
  unique(day_of_week)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text not null,
  work_date date not null,
  timezone text not null default 'Asia/Makassar',
  check_in_at timestamptz,
  check_in_status text,
  check_in_photo_url text,
  check_in_photo_public_id text,
  check_in_latitude double precision,
  check_in_longitude double precision,
  check_in_accuracy double precision,
  check_in_work_context text,
  check_out_at timestamptz,
  check_out_status text,
  check_out_photo_url text,
  check_out_photo_public_id text,
  check_out_latitude double precision,
  check_out_longitude double precision,
  check_out_accuracy double precision,
  check_out_work_context text,
  overtime_stage smallint not null default 0,
  overtime_eligible_minutes integer not null default 0,
  rule_id uuid,
  scheduled_check_in time,
  scheduled_check_out time,
  rule_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, work_date)
);

create table if not exists public.attendance_capture_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id text not null,
  event_type text not null check (event_type in ('CHECK_IN','CHECK_OUT')),
  work_date date not null,
  server_time_issued_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision not null,
  photo_public_id text,
  photo_secure_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_history (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records(id) on delete cascade,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  actor_user_id text,
  actor_name text,
  actor_role text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists attendance_records_work_date_idx on public.attendance_records(work_date desc);
create index if not exists attendance_records_user_date_idx on public.attendance_records(user_id, work_date desc);
create index if not exists attendance_capture_tokens_exp_idx on public.attendance_capture_tokens(expires_at) where used_at is null;
create index if not exists attendance_history_record_idx on public.attendance_history(attendance_record_id, created_at desc);

insert into public.attendance_rules(day_of_week,is_workday,check_in_time,check_out_time,timezone,overtime_stage1_minutes,overtime_stage2_minutes,is_active)
values
(1,true,'08:00','16:30','Asia/Makassar',120,240,true),
(2,true,'08:00','16:30','Asia/Makassar',120,240,true),
(3,true,'08:00','16:30','Asia/Makassar',120,240,true),
(4,true,'08:00','16:30','Asia/Makassar',120,240,true),
(5,true,'08:00','16:30','Asia/Makassar',120,240,true),
(6,true,'08:30','13:00','Asia/Makassar',120,240,true),
(7,false,null,null,'Asia/Makassar',120,240,true)
on conflict(day_of_week) do nothing;

create or replace function public.pxl_attendance_consume_capture_token(
  p_token_hash text,
  p_user_id text,
  p_event_type text
) returns setof public.attendance_capture_tokens
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.attendance_capture_tokens
     set used_at = now()
   where token_hash = p_token_hash
     and user_id = p_user_id
     and event_type = p_event_type
     and used_at is null
     and expires_at > now()
  returning *;
end;
$$;

alter table public.attendance_rules enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_capture_tokens enable row level security;
alter table public.attendance_history enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attendance_rules' and policyname='attendance_rules_authenticated') then
    create policy attendance_rules_authenticated on public.attendance_rules for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attendance_records' and policyname='attendance_records_authenticated') then
    create policy attendance_records_authenticated on public.attendance_records for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attendance_capture_tokens' and policyname='attendance_capture_tokens_authenticated') then
    create policy attendance_capture_tokens_authenticated on public.attendance_capture_tokens for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attendance_history' and policyname='attendance_history_authenticated') then
    create policy attendance_history_authenticated on public.attendance_history for all to authenticated using (true) with check (true);
  end if;
end $$;

grant execute on function public.pxl_attendance_consume_capture_token(text,text,text) to authenticated;
notify pgrst, 'reload schema';
