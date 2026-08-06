-- PXL-STG-0008A37 — Tambah waktu pelunasan Invoice
-- Jalankan hanya pada Supabase STAGING melalui SQL Editor.

begin;

alter table public.invoices
  add column if not exists paid_at timestamptz;

comment on column public.invoices.paid_at is
  'Waktu ketika saldo Invoice pertama kali menjadi lunas.';

commit;

-- Meminta PostgREST/Supabase memuat ulang schema cache segera.
notify pgrst, 'reload schema';

