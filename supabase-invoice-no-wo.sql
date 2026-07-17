-- 1. Tambah kolom allow_invoice_no_wo ke tabel users
alter table users add column if not exists allow_invoice_no_wo boolean default false;

-- 2. Buat tabel standalone_invoices (invoice tanpa WO/tiket terkait)
create table if not exists standalone_invoices (
  id             uuid primary key default gen_random_uuid(),
  file_url       text,
  original_name  text,
  mime_type      text,
  uploaded_by    text,
  note           text,
  total_amount   numeric,
  sales_pic      text,
  uploaded_at    timestamptz default now()
);

alter table standalone_invoices enable row level security;

create policy "Allow all for authenticated" on standalone_invoices
  for all using (true) with check (true);
