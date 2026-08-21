-- PXL-PROD-0022INV2
-- Final production numbering baseline for PixelApps Invoice.
-- INVPIXEL tahun 2026 dimulai dari sequence 131.
-- Artinya invoice INVPIXEL baru berikutnya pada Agustus 2026 menjadi:
-- INVPIXEL-082026131
--
-- Existing invoice tidak diubah.
-- Jalankan sekali di Supabase SQL Editor production.

begin;

-- Guard: jangan reset mundur jika production ternyata sudah mempunyai
-- invoice INVPIXEL sequence 131 atau lebih besar.
do $$
declare
  v_max bigint;
begin
  select coalesce(max(invoice_sequence),0)
    into v_max
  from public.invoices
  where invoice_series='INVPIXEL'
    and invoice_year=2026;

  if v_max >= 131 then
    raise exception 'ABORT: INVPIXEL 2026 sudah memiliki invoice sequence % (>=131). Counter tidak diubah.', v_max;
  end if;
end $$;

-- Counter menyimpan nomor TERAKHIR yang sudah dipakai.
-- Maka 130 menghasilkan nomor berikutnya 131.
insert into public.invoice_sequences(
  series,
  invoice_year,
  last_sequence,
  updated_at,
  updated_by
)
values(
  'INVPIXEL',
  2026,
  130,
  now(),
  'PXL-PROD-0022INV2'
)
on conflict (series, invoice_year)
do update set
  last_sequence=130,
  updated_at=now(),
  updated_by='PXL-PROD-0022INV2';

commit;

-- VERIFIKASI
-- last_sequence harus 130; nomor INVPIXEL berikutnya otomatis sequence 131.
select
  series,
  invoice_year,
  last_sequence,
  updated_at,
  updated_by
from public.invoice_sequences
where series='INVPIXEL'
  and invoice_year=2026;
