-- ============================================================
-- PXL-STG-0006A
-- FONDASI QUOTATION + JASA WO + CUSTOMER 360
-- HANYA UNTUK DATABASE STAGING
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- 1. Metadata quotation pada Sales Order
alter table public.sales_orders add column if not exists quotation_number text;
alter table public.sales_orders add column if not exists quotation_revision_no integer not null default 0;
alter table public.sales_orders add column if not exists quotation_status text not null default 'draft';
alter table public.sales_orders add column if not exists quotation_date date not null default current_date;
alter table public.sales_orders add column if not exists quotation_valid_until date not null default (current_date + 14);
alter table public.sales_orders add column if not exists quotation_title text;
alter table public.sales_orders add column if not exists material_subtotal numeric(18,2) not null default 0;
alter table public.sales_orders add column if not exists service_subtotal numeric(18,2) not null default 0;
alter table public.sales_orders add column if not exists quotation_total numeric(18,2) not null default 0;
alter table public.sales_orders add column if not exists quotation_locked_at timestamptz;
alter table public.sales_orders add column if not exists quotation_locked_by text;

-- 2. Autonumber quotation: QTNCK-00001
create sequence if not exists public.pxl_quotation_number_seq
  increment by 1 minvalue 1 start with 1 cache 1;

create or replace function public.pxl_next_quotation_number()
returns text
language plpgsql
as $$
begin
  return 'QTNCK-' || lpad(nextval('public.pxl_quotation_number_seq')::text, 5, '0');
end;
$$;

do $$
declare
  v_max_number bigint;
begin
  select coalesce(max(substring(quotation_number from '([0-9]+)$')::bigint), 0)
    into v_max_number
  from public.sales_orders
  where quotation_number ~ '^QTNCK-[0-9]+$';

  if v_max_number > 0 then
    perform setval('public.pxl_quotation_number_seq', v_max_number, true);
  else
    perform setval('public.pxl_quotation_number_seq', 1, false);
  end if;
end;
$$;

update public.sales_orders
set quotation_number = public.pxl_next_quotation_number()
where quotation_number is null or btrim(quotation_number) = '';

alter table public.sales_orders alter column quotation_number set default public.pxl_next_quotation_number();
alter table public.sales_orders alter column quotation_number set not null;

create unique index if not exists uq_sales_orders_quotation_number
  on public.sales_orders(quotation_number);
create index if not exists idx_sales_orders_quotation_status
  on public.sales_orders(quotation_status, created_at desc);

create or replace function public.pxl_set_sales_order_quotation_number()
returns trigger
language plpgsql
as $$
begin
  if new.quotation_number is null or btrim(new.quotation_number) = '' then
    new.quotation_number := public.pxl_next_quotation_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sales_orders_quotation_number on public.sales_orders;
create trigger trg_sales_orders_quotation_number
before insert or update of quotation_number on public.sales_orders
for each row execute function public.pxl_set_sales_order_quotation_number();

update public.sales_orders
set
  material_subtotal = coalesce(total_amount, 0),
  service_subtotal = 0,
  quotation_total = coalesce(total_amount, 0),
  quotation_title = coalesce(nullif(quotation_title, ''), nullif(project_name, ''), 'Penawaran')
where coalesce(material_subtotal, 0) = 0
  and coalesce(service_subtotal, 0) = 0
  and coalesce(quotation_total, 0) = 0;

-- 3. Snapshot revisi quotation
create table if not exists public.sales_order_quotation_revisions (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  quotation_number text not null,
  revision_no integer not null default 0,
  quotation_status text not null default 'draft',
  so_number text not null,
  customer_id uuid references public.crm_customers(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  sales_pic text,
  project_name text,
  quotation_title text,
  quotation_date date not null default current_date,
  valid_until date not null default (current_date + 14),
  material_items jsonb not null default '[]'::jsonb,
  service_items jsonb not null default '[]'::jsonb,
  material_subtotal numeric(18,2) not null default 0,
  service_subtotal numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  notes text,
  revision_reason text,
  snapshot jsonb not null default '{}'::jsonb,
  pdf_template_version text not null default 'PXL-STG-0006',
  created_by text,
  created_at timestamptz not null default now(),
  unique (sales_order_id, revision_no)
);

create index if not exists idx_quotation_revisions_number
  on public.sales_order_quotation_revisions(quotation_number, revision_no desc);
create index if not exists idx_quotation_revisions_so
  on public.sales_order_quotation_revisions(sales_order_id, revision_no desc);

-- 4. Daftar jasa pada WO; material tetap melalui MR
alter table public.tickets add column if not exists service_items jsonb not null default '[]'::jsonb;
alter table public.crm_work_orders add column if not exists service_items jsonb not null default '[]'::jsonb;
alter table public.crm_work_orders add column if not exists quotation_number text;
alter table public.crm_work_orders add column if not exists quotation_revision_no integer not null default 0;

create index if not exists idx_tickets_service_items on public.tickets using gin(service_items);
create index if not exists idx_crm_wo_service_items on public.crm_work_orders using gin(service_items);
create index if not exists idx_crm_wo_quotation on public.crm_work_orders(quotation_number);

-- 5. Customer 360 transaction header
create table if not exists public.crm_customer_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete restrict,
  so_number text not null,
  quotation_number text,
  quotation_revision_no integer not null default 0,
  transaction_at timestamptz not null default now(),
  status text not null default 'approved',
  sales_pic text,
  project_name text,
  location text,
  material_items jsonb not null default '[]'::jsonb,
  service_items jsonb not null default '[]'::jsonb,
  material_subtotal numeric(18,2) not null default 0,
  service_subtotal numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sales_order_id)
);

create index if not exists idx_customer_transactions_customer
  on public.crm_customer_transactions(customer_id, transaction_at desc);
create index if not exists idx_customer_transactions_quotation
  on public.crm_customer_transactions(quotation_number);

-- 6. Customer 360 transaction lines dan last price
create table if not exists public.crm_customer_transaction_lines (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.crm_customer_transactions(id) on delete cascade,
  customer_id uuid not null references public.crm_customers(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete restrict,
  line_no integer not null,
  item_type text not null,
  item_key text not null,
  inventory_item_id text,
  item_name text not null,
  sku text,
  qty numeric(18,2) not null default 0,
  unit text,
  unit_price numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (transaction_id, line_no)
);

create index if not exists idx_customer_transaction_lines_lookup
  on public.crm_customer_transaction_lines(customer_id, item_type, item_key, created_at desc);
create index if not exists idx_customer_transaction_lines_so
  on public.crm_customer_transaction_lines(sales_order_id);

-- 7. Kolom ringkasan Customer 360
alter table public.crm_customers add column if not exists last_transaction_at timestamptz;
alter table public.crm_customers add column if not exists last_sales_order_id uuid references public.sales_orders(id) on delete set null;
alter table public.crm_customers add column if not exists last_so_number text;
alter table public.crm_customers add column if not exists last_quotation_number text;
alter table public.crm_customers add column if not exists last_transaction_amount numeric(18,2) not null default 0;
alter table public.crm_customers add column if not exists transaction_count integer not null default 0;
alter table public.crm_customers add column if not exists lifetime_value numeric(18,2) not null default 0;
alter table public.crm_customers add column if not exists last_sales_pic text;
alter table public.crm_customers add column if not exists last_project_name text;
alter table public.crm_customers add column if not exists last_location text;

create index if not exists idx_crm_customers_last_transaction
  on public.crm_customers(last_transaction_at desc);

-- 8. View Customer 360 dan harga terakhir
create or replace view public.crm_customer_360_summary as
select
  customer.*,
  coalesce(statistics.computed_transaction_count, 0) as computed_transaction_count,
  coalesce(statistics.computed_lifetime_value, 0) as computed_lifetime_value,
  latest.transaction_at as computed_last_transaction_at,
  latest.sales_order_id as computed_last_sales_order_id,
  latest.so_number as computed_last_so_number,
  latest.quotation_number as computed_last_quotation_number,
  latest.grand_total as computed_last_transaction_amount,
  latest.sales_pic as computed_last_sales_pic,
  latest.project_name as computed_last_project_name,
  latest.location as computed_last_location
from public.crm_customers customer
left join lateral (
  select
    count(*)::integer as computed_transaction_count,
    coalesce(sum(transaction.grand_total), 0) as computed_lifetime_value
  from public.crm_customer_transactions transaction
  where transaction.customer_id = customer.id and transaction.status = 'approved'
) statistics on true
left join lateral (
  select transaction_at, sales_order_id, so_number, quotation_number, grand_total,
         sales_pic, project_name, location
  from public.crm_customer_transactions transaction
  where transaction.customer_id = customer.id and transaction.status = 'approved'
  order by transaction.transaction_at desc, transaction.created_at desc
  limit 1
) latest on true;

create or replace view public.crm_customer_last_prices as
select distinct on (line.customer_id, line.item_type, line.item_key)
  line.customer_id,
  line.item_type,
  line.item_key,
  line.inventory_item_id,
  line.item_name,
  line.sku,
  line.qty,
  line.unit,
  line.unit_price,
  line.line_total,
  transaction.transaction_at,
  transaction.sales_order_id,
  transaction.so_number,
  transaction.quotation_number,
  transaction.quotation_revision_no
from public.crm_customer_transaction_lines line
join public.crm_customer_transactions transaction on transaction.id = line.transaction_id
where transaction.status = 'approved'
order by line.customer_id, line.item_type, line.item_key,
         transaction.transaction_at desc, line.created_at desc;

-- 9. RLS dan akses service role
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'sales_order_quotation_revisions',
    'crm_customer_transactions',
    'crm_customer_transaction_lines'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'service_full_access_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all using (true) with check (true)',
      'service_full_access_' || table_name,
      table_name
    );
  end loop;
end;
$$;

grant usage, select on sequence public.pxl_quotation_number_seq to service_role;
grant execute on function public.pxl_next_quotation_number() to service_role;
grant all on table public.sales_order_quotation_revisions to service_role;
grant all on table public.crm_customer_transactions to service_role;
grant all on table public.crm_customer_transaction_lines to service_role;
grant select on public.crm_customer_360_summary to service_role;
grant select on public.crm_customer_last_prices to service_role;

commit;

-- Validasi ringkas
select so_number, quotation_number, quotation_revision_no, quotation_status,
       quotation_date, quotation_valid_until, material_subtotal,
       service_subtotal, quotation_total
from public.sales_orders
order by created_at desc
limit 10;
