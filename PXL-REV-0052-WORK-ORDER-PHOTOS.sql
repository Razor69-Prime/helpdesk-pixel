-- PXL-REV-0052 — Work Order Photos via Cloudinary
-- Jalankan satu kali pada Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.work_order_photos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  image_url text not null,
  secure_url text,
  cloudinary_public_id text not null unique,
  original_filename text,
  generated_filename text,
  caption text,
  visible_to_customer boolean not null default true,
  uploaded_by text,
  uploaded_by_id text,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by text
);

create index if not exists idx_work_order_photos_ticket
  on public.work_order_photos(ticket_id, uploaded_at);

create index if not exists idx_work_order_photos_public
  on public.work_order_photos(ticket_id, visible_to_customer)
  where deleted_at is null;

-- Aplikasi menggunakan Supabase service role dari backend.
alter table public.work_order_photos enable row level security;

-- Tidak membuat policy anon/public. Foto customer dibaca melalui endpoint tracking backend.
comment on table public.work_order_photos is
  'Metadata foto pekerjaan WO. File fisik berada di Cloudinary; Supabase menyimpan URL dan histori.';
