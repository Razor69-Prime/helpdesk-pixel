-- PXL-URG-0077 — Service Center Initial Module
-- Production migration. Apply once before enabling the module on VPS.

create extension if not exists pgcrypto;

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  service_number text not null unique,
  tracking_token text not null unique,
  customer_name text not null,
  customer_phone text not null,
  device_type text not null,
  brand text,
  model text,
  serial_number text,
  complaint text not null,
  initial_condition text,
  accessories jsonb not null default '[]'::jsonb,
  technician_user_id uuid,
  technician_name text,
  status text not null default 'received',
  estimated_done_date date,
  diagnosis text,
  customer_update text,
  estimated_cost numeric(14,2),
  final_cost numeric(14,2),
  received_at timestamptz not null default now(),
  ready_at timestamptz,
  picked_up_at timestamptz,
  closed_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_archived boolean not null default false
);

create index if not exists idx_service_orders_status on public.service_orders(status);
create index if not exists idx_service_orders_technician on public.service_orders(technician_user_id);
create index if not exists idx_service_orders_estimated_done on public.service_orders(estimated_done_date);
create index if not exists idx_service_orders_created_at on public.service_orders(created_at desc);

create table if not exists public.service_status_history (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_orders(id) on delete cascade,
  status text not null,
  note text,
  customer_visible boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_service_status_history_service on public.service_status_history(service_id,created_at);

create table if not exists public.service_photos (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_orders(id) on delete cascade,
  photo_type text not null default 'progress',
  image_url text not null,
  secure_url text not null,
  cloudinary_public_id text not null unique,
  original_filename text,
  generated_filename text,
  caption text,
  visible_to_customer boolean not null default true,
  uploaded_by text,
  uploaded_by_id uuid,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_service_photos_service on public.service_photos(service_id,uploaded_at);

grant select, insert, update, delete on public.service_orders to pixelapps;
grant select, insert, update, delete on public.service_status_history to pixelapps;
grant select, insert, update, delete on public.service_photos to pixelapps;

comment on table public.service_orders is 'PXL-URG-0077 Service Center / penerimaan service';
comment on table public.service_status_history is 'PXL-URG-0077 status timeline Service Center';
comment on table public.service_photos is 'PXL-URG-0077 Cloudinary photo metadata Service Center';
