-- ═══════════════════════════════════════════════════════
--  HELPDESK PIXEL — FULL SETUP (Database Baru)
--  Jalankan SEKALI di: Supabase Dashboard → SQL Editor → Run
--  Script ini membuat SEMUA tabel + seed data sekaligus
-- ═══════════════════════════════════════════════════════

-- ── 1. TABEL TICKETS ──
create table if not exists tickets (
  id               uuid default gen_random_uuid() primary key,
  wo_number        text not null,
  project_name     text,
  customer_name    text,
  customer_phone   text,
  technician       text,
  technicians      jsonb default '[]',
  created_by       text,
  status           text default 'assigned'
    check (status in ('assigned','travelling','ongoing','done','pending','progress')),
  worked_at        timestamptz,
  description      text,
  rating           int check (rating between 0 and 5) default 0,
  tracking_token   text unique not null,
  last_lat         numeric(10,7),
  last_lng         numeric(10,7),
  last_gps_at      timestamptz,
  archived         boolean default false,
  archived_at      timestamptz,
  archived_by      text,
  created_at       timestamptz default now()
);

-- ── 2. TABEL STATUS HISTORY ──
create table if not exists status_history (
  id          uuid default gen_random_uuid() primary key,
  ticket_id   uuid references tickets(id) on delete cascade,
  status      text not null,
  timestamp   timestamptz default now(),
  technician  text,
  lat         numeric(10,7),
  lng         numeric(10,7)
);

-- ── 3. TABEL INVOICES ──
create table if not exists invoices (
  id              uuid default gen_random_uuid() primary key,
  ticket_id       uuid references tickets(id) on delete cascade,
  file_url        text,
  original_name   text,
  mime_type       text,
  uploaded_by     text,
  uploaded_at     timestamptz default now(),
  note            text,
  total_amount    numeric(15,2),
  sales_pic       text,
  file_deleted    boolean default false,
  file_deleted_at timestamptz
);

-- ── 4. TABEL JOB STAGES ──
create table if not exists job_stages (
  id          uuid default gen_random_uuid() primary key,
  ticket_id   uuid references tickets(id) on delete cascade,
  stage       text not null check (stage in ('berangkat','tiba','selesai')),
  timestamp   timestamptz default now(),
  technician  text,
  lat         numeric(10,7),
  lng         numeric(10,7)
);

-- ── 5. TABEL SALES TARGETS ──
create table if not exists sales_targets (
  id            uuid default gen_random_uuid() primary key,
  sales_pic     text not null,
  year_month    text not null,
  target_amount numeric(15,2) not null,
  updated_at    timestamptz default now(),
  updated_by    text,
  unique (sales_pic, year_month)
);

-- ── 6. TABEL SALES VISITS ──
create table if not exists sales_visits (
  id               uuid default gen_random_uuid() primary key,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  sales_pic        text not null,
  sales_user_id    text not null,
  customer_name    text not null,
  customer_phone   text,
  address          text,
  lat              numeric(10,7),
  lng              numeric(10,7),
  location_manual  boolean default false,
  location_label   text,
  estimasi_omzet   numeric(15,2),
  realisasi_omzet  numeric(15,2),
  status           text default 'prospect'
    check (status in ('prospect','follow_up_1','follow_up_2','last_follow','closed_won','closed_lost')),
  prospect_date    date not null,
  follow_up_1_date date,
  follow_up_2_date date,
  last_follow_date date,
  notes            text
);

-- ── 7. TABEL USERS ──
create table if not exists users (
  id           text primary key default gen_random_uuid()::text,
  username     text unique not null,
  password     text not null,
  name         text not null,
  role         text not null default 'technician',
  custom_menus jsonb default '[]',
  created_at   timestamptz default now()
);

-- ═══════════════════════════════════════════════════════
--  INDEX
-- ═══════════════════════════════════════════════════════
create index if not exists idx_tickets_technician    on tickets (technician);
create index if not exists idx_tickets_status        on tickets (status);
create index if not exists idx_tickets_worked_at     on tickets (worked_at desc);
create index if not exists idx_tickets_token         on tickets (tracking_token);
create index if not exists idx_tickets_archived      on tickets (archived);
create index if not exists idx_status_history_ticket on status_history (ticket_id);
create index if not exists idx_invoices_ticket       on invoices (ticket_id);
create index if not exists idx_job_stages_ticket     on job_stages (ticket_id);
create index if not exists idx_sales_visits_pic      on sales_visits (sales_pic);
create index if not exists idx_sales_visits_date     on sales_visits (prospect_date desc);

-- ═══════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════
alter table tickets        enable row level security;
alter table status_history enable row level security;
alter table invoices       enable row level security;
alter table job_stages     enable row level security;
alter table sales_targets  enable row level security;
alter table sales_visits   enable row level security;
alter table users          enable row level security;

-- Policy: akses penuh via anon key (auth dihandle Express + JWT)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='tickets' and policyname='anon_all_tickets') then
    execute 'create policy "anon_all_tickets" on tickets for all using (true) with check (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename='status_history' and policyname='anon_all_status_history') then
    execute 'create policy "anon_all_status_history" on status_history for all using (true) with check (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='anon_all_invoices') then
    execute 'create policy "anon_all_invoices" on invoices for all using (true) with check (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename='job_stages' and policyname='anon_all_job_stages') then
    execute 'create policy "anon_all_job_stages" on job_stages for all using (true) with check (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename='sales_targets' and policyname='anon_all_sales_targets') then
    execute 'create policy "anon_all_sales_targets" on sales_targets for all using (true) with check (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename='sales_visits' and policyname='anon_all_sales_visits') then
    execute 'create policy "anon_all_sales_visits" on sales_visits for all using (true) with check (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename='users' and policyname='anon_all_users') then
    execute 'create policy "anon_all_users" on users for all using (true) with check (true)';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
--  STORAGE BUCKET (untuk invoice)
-- ═══════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='Allow public read invoices') then
    execute 'create policy "Allow public read invoices" on storage.objects for select using ( bucket_id = ''invoices'' )';
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='Allow upload invoices') then
    execute 'create policy "Allow upload invoices" on storage.objects for insert with check ( bucket_id = ''invoices'' )';
  end if;
  if not exists (select 1 from pg_policies where tablename='objects' and policyname='Allow delete invoices') then
    execute 'create policy "Allow delete invoices" on storage.objects for delete using ( bucket_id = ''invoices'' )';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
--  SEED DATA — USERS DEFAULT
-- ═══════════════════════════════════════════════════════
insert into users (id, username, password, name, role, custom_menus) values
  ('u-super', 'superadmin', 'Lock4Secure!!!',  'Super Admin',    'superadmin', '[]'),
  ('u1',      'admin',      'admin888',        'Admin',          'admin',      '[]'),
  ('u2',      'akunting',   'akun2024',        'Akunting',       'accounting', '[]'),
  ('u3',      'manager',    'mgr2024',         'Manager',        'manager',    '[]'),
  ('u4',      'sales1',     'sales123',        'Budi Sales',     'sales',      '[]'),
  ('u5',      'andi',       'andi123',         'Andi Pratama',   'technician', '[]'),
  ('u6',      'budi',       'budi123',         'Budi Santoso',   'technician', '[]'),
  ('u7',      'citra',      'citra123',        'Citra Dewi',     'technician', '[]'),
  ('u8',      'doni',       'doni123',         'Doni Kurniawan', 'technician', '[]')
on conflict (username) do nothing;

-- ═══════════════════════════════════════════════════════
--  SELESAI ✅
--  Setelah ini jalankan deploy ke Vercel dengan credentials:
--  - SUPABASE_URL = (Settings → API → Project URL)
--  - SUPABASE_KEY = (Settings → API → anon public key)
-- ═══════════════════════════════════════════════════════
