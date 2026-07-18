-- PXL-REV-0024
-- Tanda tangan Form Material Request mengikuti pola Purchase Request.
-- Jalankan di Supabase SQL Editor.

begin;

alter table public.material_request_forms
  add column if not exists requester_signature text,
  add column if not exists requester_signed_by text,
  add column if not exists requester_signed_at timestamptz,
  add column if not exists technician_signature text,
  add column if not exists technician_signed_by text,
  add column if not exists technician_signed_at timestamptz,
  add column if not exists prepared_signature text,
  add column if not exists prepared_by text,
  add column if not exists prepared_at timestamptz;

commit;
