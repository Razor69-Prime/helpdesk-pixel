-- PXL-STG-0008 — Manual Invoice & Piutang Foundation
-- Sudah dijalankan pada Supabase STAGING.
-- File ini disimpan sebagai dokumentasi migrasi.

begin;

alter table invoices
  add column if not exists invoice_number text,
  add column if not exists temporary_number text,
  add column if not exists invoice_series text,
  add column if not exists invoice_year integer,
  add column if not exists invoice_sequence bigint,
  add column if not exists invoice_date date,
  add column if not exists due_date date,
  add column if not exists source_type text,
  add column if not exists source_so_id uuid,
  add column if not exists billing_group_id uuid,
  add column if not exists invoice_type text,
  add column if not exists term_name text,
  add column if not exists term_percent numeric(8,4),
  add column if not exists customer_id uuid,
  add column if not exists customer_name_snapshot text,
  add column if not exists billing_address_snapshot text,
  add column if not exists customer_pic_snapshot text,
  add column if not exists sales_pic_snapshot text,
  add column if not exists company_template text,
  add column if not exists tax_mode text,
  add column if not exists tax_percent numeric(8,4),
  add column if not exists subtotal_amount numeric(18,2) default 0,
  add column if not exists item_discount_amount numeric(18,2) default 0,
  add column if not exists invoice_discount_amount numeric(18,2) default 0,
  add column if not exists hg_amount numeric(18,2),
  add column if not exists dpp_amount numeric(18,2),
  add column if not exists ppn_amount numeric(18,2),
  add column if not exists pph_amount numeric(18,2),
  add column if not exists paid_amount numeric(18,2) default 0,
  add column if not exists balance_amount numeric(18,2) default 0,
  add column if not exists invoice_status text default 'draft',
  add column if not exists payment_status text default 'unpaid',
  add column if not exists approval_required boolean default false,
  add column if not exists approval_reason text,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists issued_by text,
  add column if not exists issued_at timestamptz,
  add column if not exists snapshot_json jsonb,
  add column if not exists pdf_snapshot_url text,
  add column if not exists corrected_from_invoice_id uuid,
  add column if not exists replacement_invoice_id uuid,
  add column if not exists cancelled_by text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists manual_number boolean default false,
  add column if not exists created_by text,
  add column if not exists updated_by text,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists uq_invoices_invoice_number on invoices(invoice_number) where invoice_number is not null;
create unique index if not exists uq_invoices_series_year_sequence on invoices(invoice_series, invoice_year, invoice_sequence) where invoice_series is not null and invoice_year is not null and invoice_sequence is not null;

create table if not exists invoice_sequences (
  id uuid default gen_random_uuid() primary key,
  series text not null check (series in ('INVCK','INVPIXEL')),
  invoice_year integer not null,
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  updated_at timestamptz default now(),
  updated_by text,
  unique(series, invoice_year)
);

create table if not exists invoice_work_orders (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  ticket_id uuid not null references tickets(id),
  override_unfinished boolean default false,
  override_reason text,
  created_at timestamptz default now(),
  unique(invoice_id, ticket_id)
);

create table if not exists invoice_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  line_no integer not null,
  source_type text not null default 'manual',
  source_id text,
  item_name text not null,
  description text,
  quantity numeric(18,4) not null default 1,
  unit text,
  unit_price numeric(18,2) not null default 0,
  discount_type text,
  discount_value numeric(18,4) default 0,
  discount_amount numeric(18,2) default 0,
  line_subtotal numeric(18,2) default 0,
  line_total numeric(18,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(invoice_id, line_no)
);

create table if not exists invoice_payments (
  id uuid default gen_random_uuid() primary key,
  payment_reference text not null unique,
  customer_id uuid,
  customer_name_snapshot text,
  payment_date date not null,
  amount numeric(18,2) not null check (amount > 0),
  accounting_note text,
  status text not null default 'active' check (status in ('active','cancelled')),
  manual_reference boolean default false,
  created_by text,
  created_at timestamptz default now(),
  cancelled_by text,
  cancelled_at timestamptz,
  cancellation_reason text
);

create table if not exists invoice_payment_allocations (
  id uuid default gen_random_uuid() primary key,
  payment_id uuid not null references invoice_payments(id) on delete cascade,
  invoice_id uuid not null references invoices(id),
  allocated_amount numeric(18,2) not null check (allocated_amount > 0),
  status text not null default 'active' check (status in ('active','cancelled')),
  created_at timestamptz default now(),
  cancelled_at timestamptz,
  unique(payment_id, invoice_id)
);

create table if not exists invoice_audit_logs (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references invoices(id) on delete cascade,
  payment_id uuid references invoice_payments(id) on delete cascade,
  action text not null,
  actor_id text,
  actor_name text,
  actor_role text,
  reason text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);

create table if not exists invoice_settings (
  id text primary key,
  value_json jsonb not null,
  updated_by text,
  updated_at timestamptz default now()
);

insert into invoice_settings(id, value_json)
values
  ('approval_threshold', '{"amount":50000000,"currency":"IDR"}'::jsonb),
  ('default_tax', '{"mode":"ppn","percent":12}'::jsonb)
on conflict (id) do nothing;

commit;
