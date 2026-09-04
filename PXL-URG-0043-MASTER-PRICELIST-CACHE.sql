-- PXL-URG-0043 — Master Pricelist persistent cache, last-sync metadata, and price history.
-- Google Sheet remains READ ONLY. These tables are written only by PixelApps backend.

begin;

create extension if not exists pgcrypto;

create table if not exists public.master_pricelist_items (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  category text not null,
  brand text not null default 'LAINNYA',
  item_name text not null,
  price numeric(18,2) not null default 0,
  source_cell text not null,
  is_active boolean not null default true,
  first_synced_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  last_synced_by text
);

create index if not exists idx_master_pricelist_items_category on public.master_pricelist_items(category);
create index if not exists idx_master_pricelist_items_brand on public.master_pricelist_items(brand);
create index if not exists idx_master_pricelist_items_name on public.master_pricelist_items(item_name);
create index if not exists idx_master_pricelist_items_last_sync on public.master_pricelist_items(last_synced_at desc);

create table if not exists public.master_pricelist_syncs (
  id uuid primary key default gen_random_uuid(),
  synced_at timestamptz not null default now(),
  synced_by text,
  item_count integer not null default 0,
  changed_count integer not null default 0
);
create index if not exists idx_master_pricelist_syncs_time on public.master_pricelist_syncs(synced_at desc);

create table if not exists public.master_pricelist_price_history (
  id uuid primary key default gen_random_uuid(),
  sync_id uuid references public.master_pricelist_syncs(id) on delete set null,
  source_key text not null,
  category text not null,
  brand text not null default 'LAINNYA',
  item_name text not null,
  old_price numeric(18,2) not null,
  new_price numeric(18,2) not null,
  changed_at timestamptz not null default now(),
  changed_by text
);
create index if not exists idx_master_pricelist_history_time on public.master_pricelist_price_history(changed_at desc);
create index if not exists idx_master_pricelist_history_source on public.master_pricelist_price_history(source_key);

alter table public.master_pricelist_items enable row level security;
alter table public.master_pricelist_syncs enable row level security;
alter table public.master_pricelist_price_history enable row level security;

-- No anon/authenticated policies are created intentionally.
-- Backend service-role access bypasses RLS; direct browser writes remain blocked.

commit;
