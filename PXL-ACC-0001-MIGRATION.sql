begin;

create extension if not exists pgcrypto;

create table if not exists public.accounting_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_classification text check (default_classification in ('B2C','B2B','B2G','B2BG')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_pics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_classification text check (default_classification in ('B2C','B2B','B2G','B2BG')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_sales_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  classification text not null check (classification in ('B2C','B2B','B2G','B2BG')),
  sub_classification text not null check (sub_classification in ('Perdagangan','Project','Operasional')),
  customer_name text not null default '',
  job_name text not null default '',
  transaction_description text not null default '',
  gross_amount bigint not null check (gross_amount >= 0),
  hpp_amount bigint not null check (hpp_amount >= 0),
  net_amount bigint not null,
  dpp_amount bigint not null,
  ppn_amount bigint not null,
  product_category text not null default '',
  payment_method text not null default '',
  paid_status text not null check (paid_status in ('PAID','UNPAID')),
  sales_type text not null check (sales_type in ('BARANG','JASA')),
  goods_amount bigint not null default 0 check (goods_amount >= 0),
  service_amount bigint not null default 0 check (service_amount >= 0),
  pic_name text not null default '',
  classification_source text not null default 'MANUAL',
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  deleted_by text,
  deleted_at timestamptz
);

create index if not exists accounting_sales_transactions_period_idx on public.accounting_sales_transactions(transaction_date desc) where deleted_at is null;
create index if not exists accounting_sales_transactions_class_idx on public.accounting_sales_transactions(classification, sub_classification) where deleted_at is null;

create table if not exists public.accounting_sales_transaction_audit (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null,
  action text not null check (action in ('DELETE')),
  snapshot jsonb not null,
  actor text not null default '',
  created_at timestamptz not null default now()
);

insert into public.accounting_product_categories(name)
select x from unnest(array['CCTV','Jaringan','Perangkat Komputer dan Printer','Elektronik Lainnya']) x
on conflict (name) do nothing;

insert into public.accounting_payment_methods(name)
select x from unnest(array['Transfer Bank','Piutang Usaha','Piutang Cash']) x
on conflict (name) do nothing;

commit;
