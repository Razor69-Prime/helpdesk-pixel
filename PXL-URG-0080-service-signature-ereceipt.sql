-- PXL-URG-0080 — Service Center Signature & E-Receipt
-- Apply once on production database before enabling the new signature/e-receipt UI.

alter table public.service_orders
  add column if not exists intake_customer_name text,
  add column if not exists intake_customer_signature text,
  add column if not exists intake_pixel_user_id uuid,
  add column if not exists intake_pixel_name text,
  add column if not exists intake_pixel_signature text,
  add column if not exists intake_signed_at timestamptz,
  add column if not exists handover_customer_name text,
  add column if not exists handover_customer_signature text,
  add column if not exists handover_pixel_user_id uuid,
  add column if not exists handover_pixel_name text,
  add column if not exists handover_pixel_signature text,
  add column if not exists handover_signed_at timestamptz;

comment on column public.service_orders.intake_customer_signature is 'Base64/data URL signature of party handing device to Pixel';
comment on column public.service_orders.intake_pixel_signature is 'Base64/data URL signature of Pixel receiver';
comment on column public.service_orders.handover_customer_signature is 'Base64/data URL signature of party receiving device back';
comment on column public.service_orders.handover_pixel_signature is 'Base64/data URL signature of Pixel staff handing device back';
