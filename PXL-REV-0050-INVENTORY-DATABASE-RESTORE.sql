-- PXL-REV-0050 — RESTORE INVENTORY DATABASE & API SUPPORT
-- Jalankan satu kali di Supabase SQL Editor. Aman dijalankan ulang.

begin;
create extension if not exists pgcrypto;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  product_number text,
  category text not null default 'Belum Dikategorikan',
  subcategory text not null default 'Umum',
  unit text not null default 'pcs',
  tracking_mode text not null default 'quantity',
  stock numeric(14,2) not null default 0 check (stock >= 0),
  min_stock numeric(14,2) not null default 0 check (min_stock >= 0),
  barcode text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inventory_items add column if not exists sku text;
alter table public.inventory_items add column if not exists subcategory text not null default 'Umum';
alter table public.inventory_items add column if not exists tracking_mode text not null default 'quantity';

do $$ begin
  if not exists(select 1 from pg_constraint where conname='inventory_items_tracking_mode_check') then
    alter table public.inventory_items add constraint inventory_items_tracking_mode_check check (tracking_mode in ('quantity','serial'));
  end if;
end $$;

create unique index if not exists inventory_items_sku_unique on public.inventory_items(lower(sku)) where sku is not null and btrim(sku)<>'';
create unique index if not exists inventory_items_product_number_uidx on public.inventory_items(lower(product_number)) where product_number is not null and btrim(product_number)<>'';
create unique index if not exists inventory_items_barcode_unique on public.inventory_items(lower(barcode)) where barcode is not null and btrim(barcode)<>'';
create index if not exists inventory_items_name_idx on public.inventory_items(lower(name));

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  transaction_type text not null,
  qty numeric(14,2) not null,
  balance_after numeric(14,2) not null check (balance_after >= 0),
  reference text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists inventory_transactions_item_idx on public.inventory_transactions(item_id);
create index if not exists inventory_transactions_created_idx on public.inventory_transactions(created_at desc);

create table if not exists public.inventory_opnames (
  id uuid primary key default gen_random_uuid(), item_count integer not null default 0,
  matched_count integer not null default 0, difference_count integer not null default 0,
  notes text, created_by text, created_at timestamptz not null default now()
);
create table if not exists public.inventory_opname_items (
  id uuid primary key default gen_random_uuid(), opname_id uuid not null references public.inventory_opnames(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  system_stock numeric(14,2) not null, physical_stock numeric(14,2) not null check (physical_stock >= 0),
  difference numeric(14,2) not null, notes text, created_at timestamptz not null default now()
);
create index if not exists inventory_opname_items_opname_idx on public.inventory_opname_items(opname_id);

create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(), name text not null unique, code varchar(3) not null unique,
  sort_order integer not null default 0, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.inventory_subcategories (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.inventory_categories(id) on delete cascade,
  name text not null, code varchar(3) not null, sort_order integer not null default 0,
  is_active boolean not null default true, created_at timestamptz not null default now(),
  unique(category_id,name), unique(category_id,code)
);
create table if not exists public.inventory_sku_counters (
  category_code text not null, subcategory_code text not null, last_number integer not null default 0,
  updated_at timestamptz not null default now(), primary key(category_code,subcategory_code)
);
create table if not exists public.inventory_item_serials (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.inventory_items(id) on delete restrict,
  serial_number text not null unique, status text not null default 'in_stock', restock_reference text,
  created_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists inventory_item_serials_item_idx on public.inventory_item_serials(item_id,status);

create sequence if not exists public.inventory_barcode_seq start 1 increment 1 minvalue 1;

create or replace function public.inventory_code_prefix(p_text text)
returns text language sql immutable as $$
  select rpad(upper(substr(regexp_replace(coalesce(nullif(trim(p_text),''),'UMUM'),'[^A-Za-z0-9]','','g'),1,3)),3,'X');
$$;

create or replace function public.inventory_next_sku(p_category text,p_subcategory text)
returns text language plpgsql security definer set search_path=public as $$
declare c text; s text; n integer;
begin
  c:=public.inventory_code_prefix(p_category); s:=public.inventory_code_prefix(p_subcategory);
  insert into public.inventory_sku_counters(category_code,subcategory_code,last_number)
  values(c,s,1)
  on conflict(category_code,subcategory_code) do update set last_number=inventory_sku_counters.last_number+1,updated_at=now()
  returning last_number into n;
  return c||'-'||s||'-'||lpad(n::text,4,'0');
end;$$;

create or replace function public.inventory_next_barcode()
returns text language plpgsql security definer set search_path=public as $$
declare candidate text;
begin
  loop
    candidate := '25' || lpad(nextval('public.inventory_barcode_seq')::text,10,'0');
    exit when not exists(select 1 from public.inventory_items where barcode=candidate);
  end loop;
  return candidate;
end;$$;

create or replace function public.inventory_master_code(p_name text, p_scope text default 'category')
returns text language plpgsql immutable as $$
declare base text; alt text;
begin
  base:=public.inventory_code_prefix(p_name);
  alt:=upper(substr(md5(coalesce(p_scope,'')||':'||coalesce(p_name,'')),1,3));
  return coalesce(nullif(base,''),alt);
end;$$;

create or replace function public.inventory_apply_cutoff(p_rows jsonb,p_actor text default 'System')
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r jsonb; v_item public.inventory_items%rowtype; v_name text; v_sku text; v_pn text; v_barcode text;
  v_category text; v_subcategory text; v_unit text; v_stock numeric(14,2); v_min numeric(14,2); v_diff numeric(14,2);
  v_created int:=0; v_updated int:=0; v_adjusted int:=0; v_processed int:=0;
  v_category_id uuid; v_cat_code text; v_sub_code text;
begin
  if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'Data import kosong.'; end if;
  if jsonb_array_length(p_rows)>3000 then raise exception 'Maksimum 3.000 baris per import.'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    v_name:=btrim(coalesce(r->>'name','')); v_sku:=nullif(btrim(coalesce(r->>'sku','')),'');
    v_pn:=nullif(btrim(coalesce(r->>'product_number','')),''); v_barcode:=nullif(btrim(coalesce(r->>'barcode','')),'');
    v_category:=coalesce(nullif(btrim(r->>'category'),''),'Belum Dikategorikan');
    v_subcategory:=coalesce(nullif(btrim(r->>'subcategory'),''),'Umum');
    v_unit:=lower(coalesce(nullif(btrim(r->>'unit'),''),'pcs'));
    begin v_stock:=(r->>'stock')::numeric; v_min:=coalesce(nullif(r->>'min_stock','')::numeric,0);
    exception when others then raise exception 'Nilai stok tidak valid pada barang %.',coalesce(nullif(v_name,''),'(tanpa nama)'); end;
    if v_name='' then raise exception 'Nama Barang wajib diisi.'; end if;
    if v_stock<0 or v_min<0 then raise exception 'Stok tidak boleh negatif pada %.',v_name; end if;

    -- Tambahkan main/sub kategori hasil import ke master kategori.
    select id into v_category_id from public.inventory_categories where lower(name)=lower(v_category) limit 1;
    if v_category_id is null then
      v_cat_code:=public.inventory_master_code(v_category,'category');
      if exists(select 1 from public.inventory_categories where code=v_cat_code) then v_cat_code:=upper(substr(md5(v_category),1,3)); end if;
      insert into public.inventory_categories(name,code,sort_order,is_active)
      values(v_category,v_cat_code,100,true) returning id into v_category_id;
    end if;
    if not exists(select 1 from public.inventory_subcategories where category_id=v_category_id and lower(name)=lower(v_subcategory)) then
      v_sub_code:=public.inventory_master_code(v_subcategory,v_category);
      if exists(select 1 from public.inventory_subcategories where category_id=v_category_id and code=v_sub_code) then
        v_sub_code:=upper(substr(md5(v_category||':'||v_subcategory),1,3));
      end if;
      insert into public.inventory_subcategories(category_id,name,code,sort_order,is_active)
      values(v_category_id,v_subcategory,v_sub_code,100,true);
    end if;

    v_item:=null;
    if v_sku is not null then select * into v_item from public.inventory_items where lower(sku)=lower(v_sku) limit 1; end if;
    if v_item.id is null and v_pn is not null then select * into v_item from public.inventory_items where lower(product_number)=lower(v_pn) limit 1; end if;
    if v_item.id is null and v_barcode is not null then select * into v_item from public.inventory_items where lower(barcode)=lower(v_barcode) limit 1; end if;
    if v_item.id is null then select * into v_item from public.inventory_items where lower(name)=lower(v_name) and is_active=true order by created_at limit 1; end if;

    if v_item.id is null then
      if v_sku is null then v_sku:=public.inventory_next_sku(v_category,v_subcategory); end if;
      if v_barcode is null then v_barcode:=public.inventory_next_barcode(); end if;
      insert into public.inventory_items(name,sku,product_number,barcode,category,subcategory,unit,tracking_mode,stock,min_stock,is_active)
      values(v_name,v_sku,v_pn,v_barcode,v_category,v_subcategory,v_unit,'quantity',v_stock,v_min,true) returning * into v_item;
      if v_stock<>0 then
        insert into public.inventory_transactions(item_id,transaction_type,qty,balance_after,reference,notes,created_by)
        values(v_item.id,'RESTOCK',v_stock,v_stock,'Import Cut Off Excel','Stok awal dari import cut off',p_actor);
        v_adjusted:=v_adjusted+1;
      end if;
      v_created:=v_created+1;
    else
      v_diff:=v_stock-coalesce(v_item.stock,0);
      update public.inventory_items set name=v_name,sku=coalesce(v_sku,sku),product_number=coalesce(v_pn,product_number),
        barcode=coalesce(v_barcode,barcode),category=v_category,subcategory=v_subcategory,unit=v_unit,
        stock=v_stock,min_stock=v_min,is_active=true,updated_at=now() where id=v_item.id returning * into v_item;
      if v_diff<>0 then
        insert into public.inventory_transactions(item_id,transaction_type,qty,balance_after,reference,notes,created_by)
        values(v_item.id,'OPNAME',v_diff,v_stock,'Import Cut Off Excel','Penyesuaian saldo melalui import Excel',p_actor);
        v_adjusted:=v_adjusted+1;
      end if;
      v_updated:=v_updated+1;
    end if;
    v_processed:=v_processed+1;
  end loop;
  return jsonb_build_object('ok',true,'processed',v_processed,'created',v_created,'updated',v_updated,'adjusted',v_adjusted);
end;$$;

create or replace function public.inventory_soft_delete(p_item_id uuid,p_actor text default 'System')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item public.inventory_items%rowtype; v_stock numeric(14,2);
begin
  select * into v_item from public.inventory_items where id=p_item_id for update;
  if not found then return jsonb_build_object('ok',false,'error','Barang tidak ditemukan.'); end if;
  if v_item.is_active is false then return jsonb_build_object('ok',true,'id',v_item.id,'name',v_item.name,'already_deleted',true); end if;
  v_stock:=coalesce(v_item.stock,0);
  if v_stock<>0 then insert into public.inventory_transactions(item_id,transaction_type,qty,balance_after,reference,notes,created_by)
    values(v_item.id,'OPNAME',-v_stock,0,'Hapus Inventory','Stok dinolkan dan item dinonaktifkan',coalesce(nullif(trim(p_actor),''),'System')); end if;
  update public.inventory_items set stock=0,is_active=false,updated_at=now() where id=v_item.id;
  return jsonb_build_object('ok',true,'id',v_item.id,'name',v_item.name,'previous_stock',v_stock,'stock',0,'is_active',false);
end;$$;

create or replace function public.inventory_restock_batch(p_item_id uuid,p_qty numeric,p_serial_numbers text[] default array[]::text[],p_reference text default 'Restock',p_actor text default 'System')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item public.inventory_items%rowtype; v_qty numeric; v_balance numeric; v_serial text; v_count integer:=0;
begin
  select * into v_item from public.inventory_items where id=p_item_id and is_active=true for update;
  if not found then raise exception 'Barang tidak ditemukan atau sudah tidak aktif.'; end if;
  if v_item.tracking_mode='serial' then
    v_qty:=coalesce(array_length(p_serial_numbers,1),0); if v_qty<=0 then raise exception 'Barang serial wajib memiliki Serial Number.'; end if;
    foreach v_serial in array p_serial_numbers loop
      if exists(select 1 from public.inventory_item_serials where lower(serial_number)=lower(btrim(v_serial))) then raise exception 'Serial Number % sudah terdaftar.',v_serial; end if;
      insert into public.inventory_item_serials(item_id,serial_number,status,restock_reference,created_by)
      values(p_item_id,btrim(v_serial),'in_stock',nullif(btrim(p_reference),''),p_actor); v_count:=v_count+1;
    end loop;
  else
    v_qty:=coalesce(p_qty,0); if v_qty<=0 then raise exception 'Qty restock harus lebih dari 0.'; end if;
  end if;
  v_balance:=coalesce(v_item.stock,0)+v_qty;
  update public.inventory_items set stock=v_balance,updated_at=now() where id=p_item_id;
  insert into public.inventory_transactions(item_id,transaction_type,qty,balance_after,reference,notes,created_by)
  values(p_item_id,'RESTOCK',v_qty,v_balance,coalesce(nullif(btrim(p_reference),''),'Restock'),'Restock batch',p_actor);
  return jsonb_build_object('ok',true,'item_id',p_item_id,'tracking_mode',v_item.tracking_mode,'qty',v_qty,'balance_after',v_balance,'serial_count',v_count);
exception when others then return jsonb_build_object('ok',false,'error',sqlerrm); end;$$;

-- RLS terbatas pada tabel Inventory. Backend Express tetap memvalidasi JWT dan role.
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.inventory_opnames enable row level security;
alter table public.inventory_opname_items enable row level security;
alter table public.inventory_categories enable row level security;
alter table public.inventory_subcategories enable row level security;
alter table public.inventory_item_serials enable row level security;

grant select,insert,update,delete on public.inventory_items,public.inventory_transactions,public.inventory_opnames,public.inventory_opname_items to anon,authenticated,service_role;
grant select,insert,update,delete on public.inventory_categories,public.inventory_subcategories,public.inventory_item_serials to anon,authenticated,service_role;
grant select,insert,update,delete on public.inventory_sku_counters to anon,authenticated,service_role;
grant usage,select on sequence public.inventory_barcode_seq to anon,authenticated,service_role;
grant execute on function public.inventory_next_sku(text,text) to anon,authenticated,service_role;
grant execute on function public.inventory_next_barcode() to anon,authenticated,service_role;
grant execute on function public.inventory_apply_cutoff(jsonb,text) to anon,authenticated,service_role;
grant execute on function public.inventory_soft_delete(uuid,text) to anon,authenticated,service_role;
grant execute on function public.inventory_restock_batch(uuid,numeric,text[],text,text) to anon,authenticated,service_role;

do $$ declare t text; begin
  foreach t in array array['inventory_items','inventory_transactions','inventory_opnames','inventory_opname_items','inventory_categories','inventory_subcategories','inventory_item_serials'] loop
    execute format('drop policy if exists %I on public.%I',t||'_select_app',t);
    execute format('drop policy if exists %I on public.%I',t||'_insert_app',t);
    execute format('drop policy if exists %I on public.%I',t||'_update_app',t);
    execute format('drop policy if exists %I on public.%I',t||'_delete_app',t);
    execute format('create policy %I on public.%I for select to anon,authenticated using(true)',t||'_select_app',t);
    execute format('create policy %I on public.%I for insert to anon,authenticated with check(true)',t||'_insert_app',t);
    execute format('create policy %I on public.%I for update to anon,authenticated using(true) with check(true)',t||'_update_app',t);
    execute format('create policy %I on public.%I for delete to anon,authenticated using(true)',t||'_delete_app',t);
  end loop;
end $$;

commit;
