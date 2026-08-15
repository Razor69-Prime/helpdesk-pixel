-- PXL-PROD-0022A / PXL-PROD-0022B
-- Sales Order Site Structure + reusable Site Templates
-- Site structure itself is stored inside sales_orders.items JSON as site_id/site_name/site_order/site_item_order.
-- This migration only adds persistent reusable templates.

create table if not exists public.sales_order_site_templates (
  id uuid primary key,
  template_name text not null unique,
  description text null,
  items jsonb not null default '[]'::jsonb,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_order_site_templates_name
  on public.sales_order_site_templates (template_name);

comment on table public.sales_order_site_templates is
  'PXL-PROD-0022B reusable Sales Order Site templates. Material items retain Inventory UUID; service items remain manual.';
