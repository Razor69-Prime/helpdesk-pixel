-- ═══════════════════════════════════════════════════════
--  HELPDESK PIXEL — Supabase SQL Schema (Complete)
--  Jalankan di: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════

-- 1. Tabel tiket utama
create table if not exists tickets (
  id               uuid default gen_random_uuid() primary key,
  wo_number        text not null,
  project_name     text,
  customer_name    text,
  customer_phone   text,
  technician       text,
  technicians      jsonb  default '[]',
  created_by       text,
  status           text   default 'assigned',
  worked_at        timestamptz,
  description      text,
  rating           int    check (rating between 0 and 5) default 0,
  tracking_token   text   unique not null,
  last_lat         numeric(10,7),
  last_lng         numeric(10,7),
  last_gps_at      timestamptz,
  archived         boolean default false,
  archived_at      timestamptz,
  archived_by      text,
  created_at       timestamptz default now()
);

-- 2. Tabel histori status
create table if not exists status_history (
  id          uuid default gen_random_uuid() primary key,
  ticket_id   uuid references tickets(id) on delete cascade,
  status      text not null,
  timestamp   timestamptz default now(),
  technician  text,
  lat         numeric(10,7),
  lng         numeric(10,7)
);

-- 3. Tabel invoice
create table if not exists invoices (
  id            uuid default gen_random_uuid() primary key,
  ticket_id     uuid references tickets(id) on delete cascade,
  file_url      text,
  original_name text,
  mime_type     text,
  uploaded_by   text,
  uploaded_at   timestamptz default now(),
  note          text,
  total_amount  numeric(15,2),
  sales_pic     text,
  file_deleted  boolean default false,
  file_deleted_at timestamptz
);

-- 4. Tabel job stages
create table if not exists job_stages (
  id          uuid default gen_random_uuid() primary key,
  ticket_id   uuid references tickets(id) on delete cascade,
  stage       text not null check (stage in ('berangkat','tiba','selesai')),
  timestamp   timestamptz default now(),
  technician  text,
  lat         numeric(10,7),
  lng         numeric(10,7)
);

-- 5. Tabel sales targets
create table if not exists sales_targets (
  id            uuid default gen_random_uuid() primary key,
  sales_pic     text not null,
  year_month    text not null,
  target_amount numeric(15,2) not null,
  updated_at    timestamptz default now(),
  updated_by    text,
  unique (sales_pic, year_month)
);

-- 6. Tabel sales visits (struktur siap, UI belum aktif)
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
  status           text default 'prospect' check (status in ('prospect','follow_up_1','follow_up_2','last_follow','closed_won','closed_lost')),
  prospect_date    date not null,
  follow_up_1_date date,
  follow_up_2_date date,
  last_follow_date date,
  notes            text
);

-- ── Index untuk performa ──
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

-- ── Row Level Security ──
alter table tickets        enable row level security;
alter table status_history enable row level security;
alter table invoices       enable row level security;
alter table job_stages     enable row level security;
alter table sales_targets  enable row level security;
alter table sales_visits   enable row level security;

-- Policy: akses penuh via anon key (auth dihandle Express session)
create policy "anon_all_tickets"        on tickets        for all using (true) with check (true);
create policy "anon_all_status_history" on status_history for all using (true) with check (true);
create policy "anon_all_invoices"       on invoices       for all using (true) with check (true);
create policy "anon_all_job_stages"     on job_stages     for all using (true) with check (true);
create policy "anon_all_sales_targets"  on sales_targets  for all using (true) with check (true);
create policy "anon_all_sales_visits"   on sales_visits   for all using (true) with check (true);
