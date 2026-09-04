-- PXL-URG-0044 — Master Pricelist change detection + permanent last successful sync metadata.
-- Jalankan setelah PXL-URG-0043-MASTER-PRICELIST-CACHE.sql.

begin;

alter table public.master_pricelist_syncs
  add column if not exists price_changed_count integer not null default 0,
  add column if not exists added_count integer not null default 0,
  add column if not exists removed_count integer not null default 0,
  add column if not exists renamed_count integer not null default 0,
  add column if not exists brand_changed_count integer not null default 0;

create table if not exists public.master_pricelist_change_log (
  id uuid primary key default gen_random_uuid(),
  sync_id uuid references public.master_pricelist_syncs(id) on delete set null,
  change_type text not null check (change_type in ('added','removed','renamed','brand_changed','price_changed')),
  source_key text not null,
  category text not null,
  item_name_before text,
  item_name_after text,
  brand_before text,
  brand_after text,
  price_before numeric(18,2),
  price_after numeric(18,2),
  changed_at timestamptz not null default now(),
  changed_by text
);

create index if not exists idx_master_pricelist_change_log_time
  on public.master_pricelist_change_log(changed_at desc);

create index if not exists idx_master_pricelist_change_log_sync
  on public.master_pricelist_change_log(sync_id);

create index if not exists idx_master_pricelist_change_log_source
  on public.master_pricelist_change_log(source_key);

alter table public.master_pricelist_change_log enable row level security;

-- Tidak membuat policy anon/authenticated.
-- Backend service-role tetap satu-satunya jalur write/read untuk log ini.

commit;
