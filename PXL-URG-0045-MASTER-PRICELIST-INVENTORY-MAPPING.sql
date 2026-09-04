-- PXL-URG-0045 — Master Pricelist ↔ Inventory SKU mapping.
-- Tidak mengubah tabel/logic Inventory. Mapping disimpan terpisah di modul Master Pricelist.

begin;

create table if not exists public.master_pricelist_inventory_map (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null unique,
  inventory_sku text,
  inventory_name text,
  source_key text unique,
  mapping_status text not null default 'unmapped'
    check (mapping_status in ('unmapped','mapped','manual')),
  mapped_at timestamptz,
  mapped_by text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_master_pricelist_inventory_map_sku
  on public.master_pricelist_inventory_map(lower(inventory_sku));

create index if not exists idx_master_pricelist_inventory_map_source
  on public.master_pricelist_inventory_map(source_key);

alter table public.master_pricelist_inventory_map enable row level security;

-- Tidak membuat policy browser.
-- Backend service-role menjadi satu-satunya jalur write/read mapping.

commit;
