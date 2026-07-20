-- PXL-REV-0035 CUMULATIVE: CRM + SO + WO + MR + Invoice + Reports
create extension if not exists pgcrypto;

create table if not exists crm_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text default 'B2B',
  sales_pic text,
  phone text,
  email text,
  address text,
  status text default 'active',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  so_number text not null unique,
  customer_id uuid references crm_customers(id) on delete set null,
  customer_name text not null,
  sales_pic text,
  location text,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(18,2) default 0,
  status text default 'draft',
  revision_no integer default 0,
  history jsonb not null default '[]'::jsonb,
  is_deleted boolean default false,
  approved_by text,
  approved_at timestamptz,
  void_reason text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_work_orders (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id) on delete restrict,
  so_number text,
  wo_number text not null unique,
  number_source text not null check (number_source in ('auto','manual')),
  external_system_name text,
  external_reference text,
  project_id uuid,
  project_name text,
  technician text,
  status text default 'draft',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_material_requests (
  id uuid primary key default gen_random_uuid(),
  mr_number text not null unique,
  sales_order_id uuid not null references sales_orders(id) on delete restrict,
  so_number text,
  work_order_id uuid references crm_work_orders(id) on delete set null,
  wo_number text,
  customer_name text,
  items jsonb not null default '[]'::jsonb,
  verified_items jsonb,
  status text default 'waiting_technician_verification',
  technician text,
  technician_note text,
  technician_signature text,
  verified_at timestamptz,
  warehouse_processed_by text,
  warehouse_processed_at timestamptz,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists additional_material_requests (
  id uuid primary key default gen_random_uuid(),
  amr_number text not null unique,
  sales_order_id uuid not null references sales_orders(id) on delete restrict,
  so_number text,
  work_order_id uuid not null references crm_work_orders(id) on delete restrict,
  wo_number text,
  items jsonb not null default '[]'::jsonb,
  reason text,
  status text default 'waiting_internal_approval',
  requested_by text,
  internal_approved_by text,
  internal_approved_at timestamptz,
  customer_approval_name text,
  customer_approved_at timestamptz,
  invoice_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  sales_order_id uuid not null references sales_orders(id) on delete restrict,
  so_number text,
  customer_id uuid references crm_customers(id) on delete set null,
  customer_name text,
  work_order_ids jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb,
  additional_items jsonb not null default '[]'::jsonb,
  base_total numeric(18,2) default 0,
  additional_total numeric(18,2) default 0,
  grand_total numeric(18,2) default 0,
  status text default 'draft',
  invoice_date date default current_date,
  due_date date,
  down_payment numeric(18,2) default 0,
  redemption numeric(18,2) default 0,
  balance_due numeric(18,2) default 0,
  payment_method text,
  remark text,
  billing_address text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Kolom kompatibilitas jika tabel pernah dibuat dari mockup/paket lama.
alter table crm_invoices add column if not exists invoice_date date default current_date;
alter table crm_invoices add column if not exists due_date date;
alter table crm_invoices add column if not exists down_payment numeric(18,2) default 0;
alter table crm_invoices add column if not exists redemption numeric(18,2) default 0;
alter table crm_invoices add column if not exists balance_due numeric(18,2) default 0;
alter table crm_invoices add column if not exists payment_method text;
alter table crm_invoices add column if not exists remark text;
alter table crm_invoices add column if not exists billing_address text;

create index if not exists idx_so_customer on sales_orders(customer_id);
create index if not exists idx_wo_so on crm_work_orders(sales_order_id);
create index if not exists idx_mr_so_wo on crm_material_requests(sales_order_id,work_order_id);
create index if not exists idx_amr_so_wo on additional_material_requests(sales_order_id,work_order_id);
create index if not exists idx_inv_customer on crm_invoices(customer_id,created_at desc);

alter table crm_customers enable row level security;
alter table sales_orders enable row level security;
alter table crm_work_orders enable row level security;
alter table crm_material_requests enable row level security;
alter table additional_material_requests enable row level security;
alter table crm_invoices enable row level security;

do $$
declare t text;
begin
  foreach t in array array['crm_customers','sales_orders','crm_work_orders','crm_material_requests','additional_material_requests','crm_invoices'] loop
    execute format('drop policy if exists %I on %I', 'service_full_access_'||t, t);
    execute format('create policy %I on %I for all using (true) with check (true)', 'service_full_access_'||t, t);
  end loop;
end $$;
