begin;

create extension if not exists pgcrypto;

create table if not exists public.accounting_outlets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.accounting_outlets(code,name,is_active,sort_order)
values
  ('BUDUK','Buduk',true,10),
  ('LUKLUK','Lukluk',true,20),
  ('BANGLI','Bangli',true,30)
on conflict (code) do update
set name=excluded.name,is_active=excluded.is_active,sort_order=excluded.sort_order,updated_at=now();

alter table public.accounting_sales_transactions add column if not exists outlet_id uuid;
alter table public.accounting_customers add column if not exists outlet_id uuid;
alter table public.accounting_pics add column if not exists outlet_id uuid;
alter table public.accounting_product_categories add column if not exists outlet_id uuid;
alter table public.accounting_payment_methods add column if not exists outlet_id uuid;

-- Never guess ownership of existing business rows. Abort the whole transaction if any
-- transaction/customer/PIC from Accounting V1 is still unmapped.
do $$
begin
  if exists(select 1 from public.accounting_sales_transactions where outlet_id is null) then
    raise exception 'PXL-ACC-0002 unsafe migration: unmapped Accounting transactions exist';
  end if;
  if exists(select 1 from public.accounting_customers where outlet_id is null) then
    raise exception 'PXL-ACC-0002 unsafe migration: unmapped Accounting customers exist';
  end if;
  if exists(select 1 from public.accounting_pics where outlet_id is null) then
    raise exception 'PXL-ACC-0002 unsafe migration: unmapped Accounting PICs exist';
  end if;
end $$;

-- V1 categories/payment methods were shared seed masters. Preserve every existing name
-- by cloning it to all outlets instead of assigning business ownership heuristically.
alter table public.accounting_customers drop constraint if exists accounting_customers_name_key;
alter table public.accounting_pics drop constraint if exists accounting_pics_name_key;
alter table public.accounting_product_categories drop constraint if exists accounting_product_categories_name_key;
alter table public.accounting_payment_methods drop constraint if exists accounting_payment_methods_name_key;

create temporary table pxl_acc_0002_categories on commit drop as
select distinct name,is_active from public.accounting_product_categories;
create temporary table pxl_acc_0002_payments on commit drop as
select distinct name,is_active from public.accounting_payment_methods;

delete from public.accounting_product_categories where outlet_id is null;
delete from public.accounting_payment_methods where outlet_id is null;

insert into public.accounting_product_categories(name,is_active,outlet_id,created_at,updated_at)
select s.name,s.is_active,o.id,now(),now()
from pxl_acc_0002_categories s cross join public.accounting_outlets o
where o.code in ('BUDUK','LUKLUK','BANGLI')
and not exists (
  select 1 from public.accounting_product_categories c
  where c.outlet_id=o.id and lower(c.name)=lower(s.name)
);

insert into public.accounting_payment_methods(name,is_active,outlet_id,created_at,updated_at)
select s.name,s.is_active,o.id,now(),now()
from pxl_acc_0002_payments s cross join public.accounting_outlets o
where o.code in ('BUDUK','LUKLUK','BANGLI')
and not exists (
  select 1 from public.accounting_payment_methods p
  where p.outlet_id=o.id and lower(p.name)=lower(s.name)
);

-- If the migration is rerun after outlet-scoped data already exists, keep the standard
-- seeds present for each outlet without duplicating them.
insert into public.accounting_product_categories(name,is_active,outlet_id)
select seed.name,true,o.id
from public.accounting_outlets o
cross join (values ('CCTV'),('Jaringan'),('Perangkat Komputer dan Printer'),('Elektronik Lainnya')) seed(name)
where o.code in ('BUDUK','LUKLUK','BANGLI')
and not exists (
  select 1 from public.accounting_product_categories c
  where c.outlet_id=o.id and lower(c.name)=lower(seed.name)
);

insert into public.accounting_payment_methods(name,is_active,outlet_id)
select seed.name,true,o.id
from public.accounting_outlets o
cross join (values ('Transfer Bank'),('Piutang Usaha'),('Piutang Cash')) seed(name)
where o.code in ('BUDUK','LUKLUK','BANGLI')
and not exists (
  select 1 from public.accounting_payment_methods p
  where p.outlet_id=o.id and lower(p.name)=lower(seed.name)
);

do $$
begin
  if not exists(select 1 from pg_constraint where conname='accounting_sales_transactions_outlet_id_fkey') then
    alter table public.accounting_sales_transactions add constraint accounting_sales_transactions_outlet_id_fkey foreign key (outlet_id) references public.accounting_outlets(id);
  end if;
  if not exists(select 1 from pg_constraint where conname='accounting_customers_outlet_id_fkey') then
    alter table public.accounting_customers add constraint accounting_customers_outlet_id_fkey foreign key (outlet_id) references public.accounting_outlets(id);
  end if;
  if not exists(select 1 from pg_constraint where conname='accounting_pics_outlet_id_fkey') then
    alter table public.accounting_pics add constraint accounting_pics_outlet_id_fkey foreign key (outlet_id) references public.accounting_outlets(id);
  end if;
  if not exists(select 1 from pg_constraint where conname='accounting_product_categories_outlet_id_fkey') then
    alter table public.accounting_product_categories add constraint accounting_product_categories_outlet_id_fkey foreign key (outlet_id) references public.accounting_outlets(id);
  end if;
  if not exists(select 1 from pg_constraint where conname='accounting_payment_methods_outlet_id_fkey') then
    alter table public.accounting_payment_methods add constraint accounting_payment_methods_outlet_id_fkey foreign key (outlet_id) references public.accounting_outlets(id);
  end if;
end $$;

create unique index if not exists accounting_customers_outlet_name_ci_uq on public.accounting_customers(outlet_id, lower(name));
create unique index if not exists accounting_pics_outlet_name_ci_uq on public.accounting_pics(outlet_id, lower(name));
create unique index if not exists accounting_product_categories_outlet_name_ci_uq on public.accounting_product_categories(outlet_id, lower(name));
create unique index if not exists accounting_payment_methods_outlet_name_ci_uq on public.accounting_payment_methods(outlet_id, lower(name));
create index if not exists accounting_sales_transactions_outlet_period_idx on public.accounting_sales_transactions(outlet_id, transaction_date desc) where deleted_at is null;

alter table public.accounting_sales_transactions alter column outlet_id set not null;
alter table public.accounting_customers alter column outlet_id set not null;
alter table public.accounting_pics alter column outlet_id set not null;
alter table public.accounting_product_categories alter column outlet_id set not null;
alter table public.accounting_payment_methods alter column outlet_id set not null;

commit;
