-- PXL-REV-0013
begin;

alter table public.inventory_items add column if not exists sku text;
alter table public.inventory_items add column if not exists subcategory text default 'Umum';
create unique index if not exists inventory_items_sku_unique on public.inventory_items(lower(sku)) where sku is not null;

create table if not exists public.inventory_sku_counters(
  category_code text not null,
  subcategory_code text not null,
  last_number integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(category_code,subcategory_code)
);

create or replace function public.inventory_code_prefix(p_text text)
returns text language sql immutable as $$
  select upper(substr(regexp_replace(coalesce(nullif(trim(p_text),''),'UMUM'),'[^A-Za-z0-9]','','g'),1,3));
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
grant execute on function public.inventory_next_sku(text,text) to anon,authenticated,service_role;

do $$ declare r record; begin
  for r in select id,category,coalesce(subcategory,'Umum') subcategory from public.inventory_items where sku is null or trim(sku)='' loop
    update public.inventory_items set sku=public.inventory_next_sku(r.category,r.subcategory) where id=r.id;
  end loop;
end $$;

create or replace function public.inventory_apply_cutoff(p_rows jsonb,p_actor text default 'System') returns jsonb
language plpgsql security definer set search_path=public as $$
declare r jsonb; v_item public.inventory_items%rowtype; v_name text; v_sku text; v_pn text; v_barcode text; v_category text; v_subcategory text; v_unit text; v_stock numeric(14,2); v_min numeric(14,2); v_diff numeric(14,2); v_created int:=0; v_updated int:=0; v_adjusted int:=0; v_processed int:=0;
begin
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'Data import kosong.'; end if;
 if jsonb_array_length(p_rows)>3000 then raise exception 'Maksimum 3.000 baris per import.'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  v_name:=btrim(coalesce(r->>'name','')); v_sku:=nullif(btrim(coalesce(r->>'sku','')),''); v_pn:=nullif(btrim(coalesce(r->>'product_number','')),''); v_barcode:=nullif(btrim(coalesce(r->>'barcode','')),''); v_category:=coalesce(nullif(btrim(r->>'category'),''),'Aksesoris'); v_subcategory:=coalesce(nullif(btrim(r->>'subcategory'),''),'Umum'); v_unit:=lower(coalesce(nullif(btrim(r->>'unit'),''),'pcs'));
  begin v_stock:=(r->>'stock')::numeric; v_min:=coalesce(nullif(r->>'min_stock','')::numeric,0); exception when others then raise exception 'Nilai stok tidak valid pada barang %.',coalesce(nullif(v_name,''),'(tanpa nama)'); end;
  if v_name='' then raise exception 'Nama Barang wajib diisi.'; end if; if v_stock<0 or v_min<0 then raise exception 'Stok tidak boleh negatif pada %.',v_name; end if;
  v_item:=null;
  if v_sku is not null then select * into v_item from public.inventory_items where lower(sku)=lower(v_sku) limit 1; end if;
  if v_item.id is null and v_pn is not null then select * into v_item from public.inventory_items where lower(product_number)=lower(v_pn) limit 1; end if;
  if v_item.id is null and v_barcode is not null then select * into v_item from public.inventory_items where lower(barcode)=lower(v_barcode) limit 1; end if;
  if v_item.id is null then select * into v_item from public.inventory_items where lower(name)=lower(v_name) and is_active=true order by created_at limit 1; end if;
  if v_item.id is null then
    if v_sku is null then v_sku:=public.inventory_next_sku(v_category,v_subcategory); end if;
    insert into public.inventory_items(name,sku,product_number,barcode,category,subcategory,unit,stock,min_stock,is_active) values(v_name,v_sku,v_pn,coalesce(v_barcode,'PXL-INV-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),v_category,v_subcategory,v_unit,v_stock,v_min,true) returning * into v_item;
    if v_stock<>0 then insert into public.inventory_transactions(item_id,transaction_type,qty,balance_after,reference,notes,created_by) values(v_item.id,'RESTOCK',v_stock,v_stock,'Import Cut Off Excel','Stok awal dari import cut off',p_actor);v_adjusted:=v_adjusted+1;end if; v_created:=v_created+1;
  else
    v_diff:=v_stock-coalesce(v_item.stock,0); update public.inventory_items set name=v_name,sku=coalesce(v_sku,sku),product_number=v_pn,barcode=coalesce(v_barcode,barcode),category=v_category,subcategory=v_subcategory,unit=v_unit,stock=v_stock,min_stock=v_min,is_active=true,updated_at=now() where id=v_item.id returning * into v_item;
    if v_diff<>0 then insert into public.inventory_transactions(item_id,transaction_type,qty,balance_after,reference,notes,created_by) values(v_item.id,'OPNAME',v_diff,v_stock,'Import Cut Off Excel','Penyesuaian saldo melalui import Excel',p_actor);v_adjusted:=v_adjusted+1;end if; v_updated:=v_updated+1;
  end if; v_processed:=v_processed+1;
 end loop;
 return jsonb_build_object('processed',v_processed,'created',v_created,'updated',v_updated,'adjusted',v_adjusted);
end;$$;
grant execute on function public.inventory_apply_cutoff(jsonb,text) to anon,authenticated,service_role;
commit;
