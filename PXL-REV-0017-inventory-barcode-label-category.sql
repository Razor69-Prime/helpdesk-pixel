-- PXL-REV-0017
-- Barcode angka 12 digit + master kategori/subkategori Inventory

begin;

create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code varchar(3) not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.inventory_categories(id) on delete cascade,
  name text not null,
  code varchar(3) not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(category_id,name),
  unique(category_id,code)
);

insert into public.inventory_categories(name,code,sort_order) values
 ('Material Kabel','MAT',10),
 ('Perangkat Jaringan','PER',20),
 ('Aksesoris','AKS',30)
on conflict(name) do update set code=excluded.code, sort_order=excluded.sort_order, is_active=true;

insert into public.inventory_subcategories(category_id,name,code,sort_order)
select c.id,v.name,v.code,v.sort_order
from public.inventory_categories c
join (values
 ('Material Kabel','Kabel LAN','LAN',10),
 ('Material Kabel','Kabel Fiber','FIB',20),
 ('Material Kabel','Kabel CCTV','CCT',30),
 ('Material Kabel','Patch Cord','PAT',40),
 ('Perangkat Jaringan','Router','ROU',10),
 ('Perangkat Jaringan','Switch','SWI',20),
 ('Perangkat Jaringan','Access Point','APO',30),
 ('Perangkat Jaringan','Network Adapter','NAD',40),
 ('Aksesoris','Konektor','KON',10),
 ('Aksesoris','Adaptor','ADA',20),
 ('Aksesoris','Bracket','BRA',30),
 ('Aksesoris','Consumable','CON',40)
) as v(category_name,name,code,sort_order) on v.category_name=c.name
on conflict(category_id,name) do update set code=excluded.code, sort_order=excluded.sort_order, is_active=true;

create sequence if not exists public.inventory_barcode_seq start 1 increment 1 minvalue 1;

create or replace function public.inventory_next_barcode()
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  candidate text;
begin
  loop
    candidate := '25' || lpad(nextval('public.inventory_barcode_seq')::text,10,'0');
    exit when not exists(select 1 from public.inventory_items where barcode=candidate);
  end loop;
  return candidate;
end;
$$;

grant usage, select on sequence public.inventory_barcode_seq to anon, authenticated;
grant execute on function public.inventory_next_barcode() to anon, authenticated;
grant select on public.inventory_categories, public.inventory_subcategories to anon, authenticated;

alter table public.inventory_categories enable row level security;
alter table public.inventory_subcategories enable row level security;

drop policy if exists inventory_categories_select_app on public.inventory_categories;
create policy inventory_categories_select_app on public.inventory_categories for select to anon, authenticated using(true);
drop policy if exists inventory_subcategories_select_app on public.inventory_subcategories;
create policy inventory_subcategories_select_app on public.inventory_subcategories for select to anon, authenticated using(true);

-- Pastikan barcode tidak boleh duplikat ketika terisi.
create unique index if not exists inventory_items_barcode_unique
on public.inventory_items(barcode)
where barcode is not null and btrim(barcode) <> '';

commit;
