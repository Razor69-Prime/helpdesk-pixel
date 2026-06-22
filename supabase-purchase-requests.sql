-- ═══════════════════════════════════════════════════════
--  PURCHASE REQUESTS TABLE
--  Jalankan di: Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════

create table if not exists purchase_requests (
  id              uuid default gen_random_uuid() primary key,
  pr_number       text not null,
  pr_date         date,
  outlet          text,
  requester       text,
  requester_title text,
  department      text default 'Pixel',
  reason          text,
  items           jsonb default '[]',
  status          text default 'pending',
  approved_by     text,
  approved_at     timestamptz,
  rejected_by     text,
  rejected_at     timestamptz,
  reject_reason   text,
  created_at      timestamptz default now()
);

create index if not exists idx_pr_outlet   on purchase_requests (outlet);
create index if not exists idx_pr_status   on purchase_requests (status);
create index if not exists idx_pr_created  on purchase_requests (created_at desc);

alter table purchase_requests enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='purchase_requests' and policyname='anon_all_pr') then
    execute 'create policy "anon_all_pr" on purchase_requests for all using (true) with check (true)';
  end if;
end $$;

-- ════════════════════════════════════════════
--  TAMBAH KOLOM TANDA TANGAN DI TABEL USERS
-- ════════════════════════════════════════════
alter table users add column if not exists signature_url text;

-- Tambah kolom signature jika tabel sudah ada
alter table purchase_requests add column if not exists requester_signature text;
alter table purchase_requests add column if not exists approver_signature text;

-- Tambah kolom remarks jika belum ada
alter table purchase_requests add column if not exists remarks text;
