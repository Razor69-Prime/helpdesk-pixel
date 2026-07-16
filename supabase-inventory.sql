-- PXL-REV-0005 — Inventory Asset
-- Jalankan satu kali melalui Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_number text,
  category text not null default 'Aksesoris',
  unit text not null default 'pcs',
  stock numeric(14,2) not null default 0 check (stock >= 0),
  min_stock numeric(14,2) not null default 0 check (min_stock >= 0),
  barcode text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_items_product_number_uidx
  on public.inventory_items(product_number) where product_number is not null and product_number <> '';
create unique index if not exists inventory_items_barcode_uidx
  on public.inventory_items(barcode) where barcode is not null and barcode <> '';
create index if not exists inventory_items_name_idx on public.inventory_items(name);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('RESTOCK','REQUEST','RETURN','OPNAME')),
  qty numeric(14,2) not null,
  balance_after numeric(14,2) not null check (balance_after >= 0),
  reference text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists inventory_transactions_item_idx on public.inventory_transactions(item_id);
create index if not exists inventory_transactions_created_idx on public.inventory_transactions(created_at desc);

create table if not exists public.inventory_opnames (
  id uuid primary key default gen_random_uuid(),
  item_count integer not null default 0,
  matched_count integer not null default 0,
  difference_count integer not null default 0,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_opname_items (
  id uuid primary key default gen_random_uuid(),
  opname_id uuid not null references public.inventory_opnames(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  system_stock numeric(14,2) not null,
  physical_stock numeric(14,2) not null check (physical_stock >= 0),
  difference numeric(14,2) not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists inventory_opname_items_opname_idx on public.inventory_opname_items(opname_id);

-- Arsitektur aplikasi saat ini mengakses Supabase melalui backend Express memakai key proyek.
-- Hak akses pengguna tetap divalidasi oleh JWT dan middleware backend.
alter table public.inventory_items disable row level security;
alter table public.inventory_transactions disable row level security;
alter table public.inventory_opnames disable row level security;
alter table public.inventory_opname_items disable row level security;

grant select, insert, update, delete on public.inventory_items to anon, authenticated, service_role;
grant select, insert, update, delete on public.inventory_transactions to anon, authenticated, service_role;
grant select, insert, update, delete on public.inventory_opnames to anon, authenticated, service_role;
grant select, insert, update, delete on public.inventory_opname_items to anon, authenticated, service_role;
