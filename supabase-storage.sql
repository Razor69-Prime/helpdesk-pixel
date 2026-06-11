-- Buat bucket untuk invoice di Supabase Storage
-- Jalankan di: Supabase Dashboard → SQL Editor → Run

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

-- Policy: allow upload dan read
create policy "Allow public read invoices"
  on storage.objects for select
  using ( bucket_id = 'invoices' );

create policy "Allow authenticated upload invoices"
  on storage.objects for insert
  with check ( bucket_id = 'invoices' );

create policy "Allow delete invoices"
  on storage.objects for delete
  using ( bucket_id = 'invoices' );
