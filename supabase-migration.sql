-- ═══════════════════════════════════════════════════════
--  MIGRATION — tambah kolom yang belum ada
--  Jalankan di: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════

-- Tambah kolom baru ke tabel tickets
alter table tickets add column if not exists customer_phone   text;
alter table tickets add column if not exists technicians      jsonb default '[]';
alter table tickets add column if not exists created_by       text;
alter table tickets add column if not exists archived         boolean default false;
alter table tickets add column if not exists archived_at      timestamptz;
alter table tickets add column if not exists archived_by      text;

-- Update status check constraint
alter table tickets drop constraint if exists tickets_status_check;
alter table tickets add constraint tickets_status_check
  check (status in ('assigned','travelling','ongoing','done','pending','progress'));

-- Tambah kolom baru ke tabel invoices
alter table invoices add column if not exists file_deleted     boolean default false;
alter table invoices add column if not exists file_deleted_at  timestamptz;

-- Tabel sales_targets
create table if not exists sales_targets (
  id            uuid default gen_random_uuid() primary key,
  sales_pic     text not null,
  year_month    text not null,
  target_amount numeric(15,2) not null,
  updated_at    timestamptz default now(),
  updated_by    text,
  unique (sales_pic, year_month)
);

-- Tabel sales_visits
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
  status           text default 'prospect',
  prospect_date    date not null,
  follow_up_1_date date,
  follow_up_2_date date,
  last_follow_date date,
  notes            text
);

-- Tabel job_stages
create table if not exists job_stages (
  id          uuid default gen_random_uuid() primary key,
  ticket_id   uuid references tickets(id) on delete cascade,
  stage       text not null,
  timestamp   timestamptz default now(),
  technician  text,
  lat         numeric(10,7),
  lng         numeric(10,7)
);

-- Index tambahan
create index if not exists idx_tickets_archived     on tickets (archived);
create index if not exists idx_job_stages_ticket    on job_stages (ticket_id);
create index if not exists idx_sales_visits_pic     on sales_visits (sales_pic);
create index if not exists idx_sales_visits_date    on sales_visits (prospect_date desc);

-- RLS untuk tabel baru
alter table sales_targets enable row level security;
alter table sales_visits  enable row level security;
alter table job_stages    enable row level security;

-- Policy (tanpa IF NOT EXISTS — Supabase tidak support)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='sales_targets' and policyname='anon_all_sales_targets'
  ) then
    execute 'create policy "anon_all_sales_targets" on sales_targets for all using (true) with check (true)';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='sales_visits' and policyname='anon_all_sales_visits'
  ) then
    execute 'create policy "anon_all_sales_visits" on sales_visits for all using (true) with check (true)';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='job_stages' and policyname='anon_all_job_stages'
  ) then
    execute 'create policy "anon_all_job_stages" on job_stages for all using (true) with check (true)';
  end if;
end $$;

-- ── Tabel users ──
create table if not exists users (
  id           text primary key default gen_random_uuid()::text,
  username     text unique not null,
  password     text not null,
  name         text not null,
  role         text not null default 'technician',
  custom_menus jsonb default '[]',
  created_at   timestamptz default now()
);

alter table users enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='users' and policyname='anon_all_users'
  ) then
    execute 'create policy "anon_all_users" on users for all using (true) with check (true)';
  end if;
end $$;

-- Seed default users (jalankan sekali saja)
insert into users (id, username, password, name, role, custom_menus) values
  ('u1', 'andi',       'andi123',         'Andi Pratama',   'technician', '[]'),
  ('u2', 'budi',       'budi123',         'Budi Santoso',   'technician', '[]'),
  ('u3', 'citra',      'citra123',        'Citra Dewi',     'technician', '[]'),
  ('u4', 'doni',       'doni123',         'Doni Kurniawan', 'technician', '[]'),
  ('u5', 'admin',      'admin888',        'Admin',          'admin',      '[]'),
  ('u6', 'akunting',   'akun2024',        'Akunting',       'accounting', '[]'),
  ('u7', 'sales1',     'sales123',        'Budi Sales',     'sales',      '[]'),
  ('u8', 'manager',    'mgr2024',         'Manager',        'manager',    '[]'),
  ('u-super', 'superadmin', 'super@pixel2026', 'Super Admin', 'superadmin', '[]')
on conflict (username) do nothing;
