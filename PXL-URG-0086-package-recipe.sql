-- PXL-URG-0086 — Standalone Package Recipe module
-- Phase 1 only: no relation to Sales Order, Material Request, Work Order, or Inventory quantity.

create table if not exists public.package_recipes (
  id uuid primary key default gen_random_uuid(),
  package_code text not null unique,
  name text not null,
  brand text,
  category text not null default 'CCTV',
  status text not null default 'draft' check (status in ('draft','active','inactive')),
  ppn_percent numeric(8,2) not null default 11,
  package_price numeric(18,2),
  discount_percent numeric(8,2) not null default 0,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.package_recipe_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.package_recipes(id) on delete cascade,
  sort_order integer not null default 0,
  item_type text not null default 'material' check (item_type in ('material','service','cost')),
  item_category text not null default 'other' check (item_category in ('camera','dvr','cable','other')),
  item_name text not null,
  brand text,
  qty numeric(18,4) not null default 1,
  unit text not null default 'pcs',
  hpp_unit numeric(18,2) not null default 0,
  markup_percent numeric(8,2) not null default 0,
  dvr_channels integer,
  cable_type text,
  is_optional boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_package_recipe_items_package_id
  on public.package_recipe_items(package_id, sort_order);

create table if not exists public.package_recipe_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.package_recipes(id) on delete cascade,
  revision_no integer not null,
  snapshot jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique(package_id, revision_no)
);

comment on table public.package_recipes is 'PXL-URG-0086 standalone CCTV package master. No SO/MR/WO integration in phase 1.';
comment on table public.package_recipe_items is 'Recipe breakdown for package_recipes.';
comment on table public.package_recipe_versions is 'Immutable snapshots of package recipe edits/copies.';
