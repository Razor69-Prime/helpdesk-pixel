-- PXL-URG-0081 — Service Center Optional Fields + Manual Address

alter table public.service_orders
  add column if not exists customer_address text;

alter table public.service_orders
  alter column customer_name drop not null,
  alter column customer_phone drop not null,
  alter column device_type drop not null,
  alter column complaint drop not null;

comment on column public.service_orders.customer_address is 'Manual customer/service address input';
