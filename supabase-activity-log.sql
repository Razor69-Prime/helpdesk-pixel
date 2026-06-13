-- ═══════════════════════════════════════════════════════
--  ACTIVITY LOG TABLE
--  Jalankan di: Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════

create table if not exists activity_logs (
  id          uuid default gen_random_uuid() primary key,
  timestamp   timestamptz default now(),
  category    text,
  action      text,
  "user"      text,
  detail      text,
  ip          text
);

create index if not exists idx_activity_logs_timestamp on activity_logs (timestamp desc);
create index if not exists idx_activity_logs_category  on activity_logs (category);
create index if not exists idx_activity_logs_user      on activity_logs ("user");

alter table activity_logs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='activity_logs' and policyname='anon_all_activity_logs') then
    execute 'create policy "anon_all_activity_logs" on activity_logs for all using (true) with check (true)';
  end if;
end $$;
