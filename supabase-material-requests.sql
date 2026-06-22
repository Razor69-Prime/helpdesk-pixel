-- ═══════════════════════════════════════════════════════
--  MATERIAL REQUESTS TABLE
--  Jalankan di: Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════

create table if not exists material_requests (
  id          uuid default gen_random_uuid() primary key,
  ticket_id   text,
  wo_number   text,
  technician  text,
  materials   jsonb default '[]',
  jasa        jsonb default '[]',
  notes       text,
  created_at  timestamptz default now()
);

-- Tambah kolom jasa jika tabel sudah ada sebelumnya
alter table material_requests add column if not exists jasa jsonb default '[]';

create index if not exists idx_material_requests_ticket on material_requests (ticket_id);
create index if not exists idx_material_requests_created on material_requests (created_at desc);

alter table material_requests enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='material_requests' and policyname='anon_all_material_requests') then
    execute 'create policy "anon_all_material_requests" on material_requests for all using (true) with check (true)';
  end if;
end $$;
