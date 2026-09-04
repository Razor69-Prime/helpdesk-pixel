-- PXL-URG-0051G — Atomic Bulk Merge Duplicate Inventory
-- Jalankan satu kali di Supabase SQL Editor sebelum memakai tombol Merge Massal 100%.

begin;

create or replace function public.inventory_merge_duplicates_bulk(
  p_merges jsonb,
  p_actor text default 'System'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_merge jsonb;
  v_target_id uuid;
  v_source_id uuid;
  v_target public.inventory_items%rowtype;
  v_source public.inventory_items%rowtype;
  v_source_stock numeric(14,2);
  v_after numeric(14,2);
  v_items integer := 0;
  v_groups integer := 0;
  v_stock numeric(14,2) := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_target_seen uuid[] := array[]::uuid[];
begin
  if p_merges is null or jsonb_typeof(p_merges) <> 'array' then
    raise exception 'p_merges wajib berupa array JSON.';
  end if;

  for v_merge in select value from jsonb_array_elements(p_merges)
  loop
    begin
      v_target_id := nullif(v_merge->>'target_id','')::uuid;
      v_source_id := nullif(v_merge->>'source_id','')::uuid;
    exception when others then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('reason','ID tidak valid'));
      continue;
    end;

    if v_target_id is null or v_source_id is null or v_target_id=v_source_id then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('reason','Target/source tidak valid'));
      continue;
    end if;

    select * into v_target from public.inventory_items
      where id=v_target_id and is_active=true for update;
    if not found then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('reason','Target tidak aktif/ditemukan','target_id',v_target_id,'source_id',v_source_id));
      continue;
    end if;

    select * into v_source from public.inventory_items
      where id=v_source_id and is_active=true for update;
    if not found then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('reason','Source tidak aktif/ditemukan','target_id',v_target_id,'source_id',v_source_id));
      continue;
    end if;

    if coalesce(v_target.tracking_mode,'quantity')='serial'
       or coalesce(v_source.tracking_mode,'quantity')='serial' then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('reason','Tracking Serial','target_id',v_target_id,'source_id',v_source_id));
      continue;
    end if;

    if lower(trim(coalesce(v_target.unit,'pcs'))) <> lower(trim(coalesce(v_source.unit,'pcs'))) then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('reason','Satuan berbeda','target_id',v_target_id,'source_id',v_source_id));
      continue;
    end if;

    v_source_stock := coalesce(v_source.stock,0);
    v_after := coalesce(v_target.stock,0)+v_source_stock;

    update public.inventory_items
      set stock=v_after,updated_at=now()
      where id=v_target_id;

    update public.inventory_items
      set stock=0,is_active=false,updated_at=now()
      where id=v_source_id;

    insert into public.inventory_transactions
      (item_id,transaction_type,qty,balance_after,reference,notes,created_by)
    values
      (v_target_id,'MERGE_IN',v_source_stock,v_after,'Merge Massal 100% RPC',
       'Gabung dari '||v_source.name||' ('||coalesce(v_source.sku,'-')||')',
       coalesce(nullif(trim(p_actor),''),'System'));

    insert into public.inventory_transactions
      (item_id,transaction_type,qty,balance_after,reference,notes,created_by)
    values
      (v_source_id,'MERGED_OUT',-v_source_stock,0,'Merge Massal 100% RPC',
       'Digabung ke '||v_target.name||' ('||coalesce(v_target.sku,'-')||')',
       coalesce(nullif(trim(p_actor),''),'System'));

    if to_regclass('public.master_pricelist_inventory_map') is not null then
      if exists(select 1 from public.master_pricelist_inventory_map where inventory_item_id=v_source_id) then
        if exists(select 1 from public.master_pricelist_inventory_map where inventory_item_id=v_target_id) then
          delete from public.master_pricelist_inventory_map where inventory_item_id=v_source_id;
        else
          update public.master_pricelist_inventory_map
             set inventory_item_id=v_target_id,
                 inventory_sku=v_target.sku,
                 inventory_name=v_target.name,
                 updated_at=now()
           where inventory_item_id=v_source_id;
        end if;
      end if;
    end if;

    if not (v_target_id=any(v_target_seen)) then
      v_target_seen := array_append(v_target_seen,v_target_id);
      v_groups := v_groups+1;
    end if;

    v_items := v_items+1;
    v_stock := v_stock+v_source_stock;
  end loop;

  return jsonb_build_object(
    'ok',true,
    'groups_total',coalesce(array_length(v_target_seen,1),0),
    'groups_merged',v_groups,
    'items_deactivated',v_items,
    'stock_moved',v_stock,
    'skipped',v_skipped
  );
end;
$$;

grant execute on function public.inventory_merge_duplicates_bulk(jsonb,text)
to authenticated,service_role;

commit;
