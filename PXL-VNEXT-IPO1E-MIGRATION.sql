-- PXL-VNEXT-IPO1E — Per-item PPN 11% flag for Internal PO
-- Additive only. Existing rows default to non-PPN so current totals remain unchanged.

alter table public.project_internal_po_items
  add column if not exists is_ppn boolean not null default false;

create or replace function public.pxl_vnext_internal_po_save(
  p_project_id uuid,
  p_general_issue text,
  p_items jsonb,
  p_actor_id text,
  p_actor_name text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_header public.project_internal_po%rowtype;
  v_existing public.project_internal_po_items%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_source_type text;
  v_source_pr_id uuid;
  v_source_pr_number text;
  v_source_pr_item_index integer;
  v_source_boq_item_id uuid;
  v_item_name text;
  v_qty_po numeric;
  v_qty_arrived numeric;
  v_unit text;
  v_actual_unit_price numeric;
  v_is_ppn boolean;
  v_source_supplier_id uuid;
  v_supplier_name text;
  v_manual_state text;
  v_issue text;
  v_sort_order integer;
  v_before jsonb;
  v_after jsonb;
  v_keep_ids uuid[]:=array[]::uuid[];
  v_new_id uuid;
begin
  if not exists (select 1 from projects where id=p_project_id) then
    raise exception 'Project tidak ditemukan.';
  end if;
  if p_items is null then p_items:='[]'::jsonb; end if;
  if jsonb_typeof(p_items)<>'array' then raise exception 'Daftar item Internal PO tidak valid.'; end if;

  select * into v_header from project_internal_po where project_id=p_project_id for update;
  if not found then
    insert into project_internal_po(project_id,general_issue,created_by_id,created_by_name,updated_by_id,updated_by_name)
    values(p_project_id,nullif(trim(coalesce(p_general_issue,'')),''),p_actor_id,p_actor_name,p_actor_id,p_actor_name)
    returning * into v_header;
    if v_header.general_issue is not null then
      insert into project_internal_po_history(project_id,internal_po_id,change_type,field_name,before_value,after_value,actor_id,actor_name)
      values(p_project_id,v_header.id,'general_issue_changed','general_issue','null'::jsonb,to_jsonb(v_header.general_issue),p_actor_id,p_actor_name);
    end if;
  else
    if v_header.general_issue is distinct from nullif(trim(coalesce(p_general_issue,'')),'') then
      insert into project_internal_po_history(project_id,internal_po_id,change_type,field_name,before_value,after_value,actor_id,actor_name)
      values(p_project_id,v_header.id,'general_issue_changed','general_issue',to_jsonb(v_header.general_issue),to_jsonb(nullif(trim(coalesce(p_general_issue,'')),'')),p_actor_id,p_actor_name);
    end if;
    update project_internal_po set
      general_issue=nullif(trim(coalesce(p_general_issue,'')),''),
      updated_by_id=p_actor_id,updated_by_name=p_actor_name,updated_at=now()
    where id=v_header.id returning * into v_header;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_id:=nullif(v_item->>'id','')::uuid;
    v_source_type:=lower(trim(coalesce(v_item->>'source_type','')));
    v_source_pr_id:=nullif(v_item->>'source_pr_id','')::uuid;
    v_source_pr_number:=nullif(trim(coalesce(v_item->>'source_pr_number','')),'');
    v_source_pr_item_index:=case when nullif(v_item->>'source_pr_item_index','') is null then null else (v_item->>'source_pr_item_index')::integer end;
    v_source_boq_item_id:=nullif(v_item->>'source_boq_item_id','')::uuid;
    v_item_name:=trim(coalesce(v_item->>'item_name',''));
    v_qty_po:=nullif(v_item->>'qty_po','')::numeric;
    v_qty_arrived:=coalesce(nullif(v_item->>'qty_arrived','')::numeric,0);
    v_unit:=nullif(trim(coalesce(v_item->>'unit','')),'');
    v_actual_unit_price:=case when nullif(trim(coalesce(v_item->>'actual_unit_price','')),'') is null then null else (v_item->>'actual_unit_price')::numeric end;
    v_is_ppn:=coalesce(nullif(v_item->>'is_ppn','')::boolean,false);
    v_source_supplier_id:=nullif(v_item->>'source_supplier_id','')::uuid;
    v_supplier_name:=nullif(trim(coalesce(v_item->>'supplier_name','')),'');
    v_manual_state:=lower(trim(coalesce(v_item->>'manual_state','not_ordered')));
    v_issue:=nullif(trim(coalesce(v_item->>'issue','')),'');
    v_sort_order:=coalesce(nullif(v_item->>'sort_order','')::integer,0);

    if v_source_type not in ('pr','boq') then raise exception 'Sumber item Internal PO tidak valid.'; end if;
    if v_item_name='' then raise exception 'Nama barang wajib diisi.'; end if;
    if v_qty_po is null or v_qty_po<=0 then raise exception 'Qty PO harus lebih dari 0.'; end if;
    if v_qty_arrived<0 or v_qty_arrived>v_qty_po then raise exception 'Qty Arrived harus antara 0 dan Qty PO.'; end if;
    if v_actual_unit_price is not null and v_actual_unit_price<0 then raise exception 'Harga Beli Non-PPN tidak boleh negatif.'; end if;
    if v_manual_state not in ('not_ordered','ordered','hold','cancelled') then raise exception 'Status pembelian manual tidak valid.'; end if;
    if v_source_type='pr' and (v_source_pr_id is null or v_source_pr_item_index is null or v_source_pr_item_index<0) then
      raise exception 'Provenance Purchase Request tidak valid.';
    end if;
    if v_source_type='boq' and v_item_id is null then
      if v_source_boq_item_id is null or not exists (
        select 1 from project_report_items b where b.id=v_source_boq_item_id and b.project_id=p_project_id and lower(coalesce(b.category,''))='material'
      ) then raise exception 'Item BOQ harus Material dari Project yang sama.'; end if;
    end if;

    if v_item_id is not null then
      select * into v_existing from project_internal_po_items
      where id=v_item_id and internal_po_id=v_header.id and project_id=p_project_id and deleted_at is null for update;
      if not found then raise exception 'Item Internal PO tidak ditemukan atau bukan milik Project.'; end if;
      if v_existing.source_type<>v_source_type
         or coalesce(v_existing.source_pr_id::text,'')<>coalesce(v_source_pr_id::text,'')
         or coalesce(v_existing.source_pr_item_index,-1)<>coalesce(v_source_pr_item_index,-1)
         or coalesce(v_existing.source_boq_item_id::text,'')<>coalesce(v_source_boq_item_id::text,'') then
        raise exception 'Provenance item Internal PO tidak boleh diubah.';
      end if;
      v_before:=jsonb_build_object('item_name',v_existing.item_name,'qty_po',v_existing.qty_po,'qty_arrived',v_existing.qty_arrived,'unit',v_existing.unit,'actual_unit_price',v_existing.actual_unit_price,'is_ppn',coalesce(v_existing.is_ppn,false),'supplier_name',v_existing.supplier_name,'manual_state',v_existing.manual_state,'issue',v_existing.issue,'sort_order',v_existing.sort_order);
      v_after:=jsonb_build_object('item_name',v_item_name,'qty_po',v_qty_po,'qty_arrived',v_qty_arrived,'unit',v_unit,'actual_unit_price',v_actual_unit_price,'is_ppn',v_is_ppn,'supplier_name',v_supplier_name,'manual_state',v_manual_state,'issue',v_issue,'sort_order',v_sort_order);
      update project_internal_po_items set
        item_name=v_item_name,qty_po=v_qty_po,qty_arrived=v_qty_arrived,unit=v_unit,actual_unit_price=v_actual_unit_price,is_ppn=v_is_ppn,
        supplier_name=v_supplier_name,manual_state=v_manual_state,issue=v_issue,sort_order=v_sort_order,
        updated_by_id=p_actor_id,updated_by_name=p_actor_name,updated_at=now()
      where id=v_item_id;
      if v_before is distinct from v_after then
        insert into project_internal_po_history(project_id,internal_po_id,item_id,change_type,before_value,after_value,actor_id,actor_name)
        values(p_project_id,v_header.id,v_item_id,'row_edited',v_before,v_after,p_actor_id,p_actor_name);
      end if;
      v_keep_ids:=array_append(v_keep_ids,v_item_id);
    else
      v_new_id:=gen_random_uuid();
      insert into project_internal_po_items(
        id,internal_po_id,project_id,source_type,source_pr_id,source_pr_number,source_pr_item_index,source_boq_item_id,
        item_name,qty_po,qty_arrived,unit,actual_unit_price,is_ppn,source_supplier_id,supplier_name,manual_state,issue,sort_order,
        created_by_id,created_by_name,updated_by_id,updated_by_name
      ) values(
        v_new_id,v_header.id,p_project_id,v_source_type,v_source_pr_id,v_source_pr_number,v_source_pr_item_index,v_source_boq_item_id,
        v_item_name,v_qty_po,v_qty_arrived,v_unit,v_actual_unit_price,v_is_ppn,v_source_supplier_id,v_supplier_name,v_manual_state,v_issue,v_sort_order,
        p_actor_id,p_actor_name,p_actor_id,p_actor_name
      );
      v_after:=jsonb_build_object('item_name',v_item_name,'qty_po',v_qty_po,'qty_arrived',v_qty_arrived,'unit',v_unit,'actual_unit_price',v_actual_unit_price,'is_ppn',v_is_ppn,'supplier_name',v_supplier_name,'manual_state',v_manual_state,'issue',v_issue,'sort_order',v_sort_order,'source_type',v_source_type,'source_pr_id',v_source_pr_id,'source_pr_item_index',v_source_pr_item_index,'source_boq_item_id',v_source_boq_item_id);
      insert into project_internal_po_history(project_id,internal_po_id,item_id,change_type,after_value,actor_id,actor_name)
      values(p_project_id,v_header.id,v_new_id,'row_added',v_after,p_actor_id,p_actor_name);
      v_keep_ids:=array_append(v_keep_ids,v_new_id);
    end if;
  end loop;

  for v_existing in
    select * from project_internal_po_items
    where internal_po_id=v_header.id and project_id=p_project_id and deleted_at is null
      and not (id=any(v_keep_ids))
    for update
  loop
    v_before:=jsonb_build_object('item_name',v_existing.item_name,'qty_po',v_existing.qty_po,'qty_arrived',v_existing.qty_arrived,'unit',v_existing.unit,'actual_unit_price',v_existing.actual_unit_price,'is_ppn',coalesce(v_existing.is_ppn,false),'supplier_name',v_existing.supplier_name,'manual_state',v_existing.manual_state,'issue',v_existing.issue,'sort_order',v_existing.sort_order,'source_type',v_existing.source_type,'source_pr_id',v_existing.source_pr_id,'source_pr_item_index',v_existing.source_pr_item_index,'source_boq_item_id',v_existing.source_boq_item_id);
    update project_internal_po_items set deleted_at=now(),deleted_by_id=p_actor_id,deleted_by_name=p_actor_name,updated_by_id=p_actor_id,updated_by_name=p_actor_name,updated_at=now() where id=v_existing.id;
    insert into project_internal_po_history(project_id,internal_po_id,item_id,change_type,before_value,actor_id,actor_name)
    values(p_project_id,v_header.id,v_existing.id,'row_removed',v_before,p_actor_id,p_actor_name);
  end loop;

  update project_internal_po set updated_by_id=p_actor_id,updated_by_name=p_actor_name,updated_at=now() where id=v_header.id;
  return v_header.id;
end $$;


notify pgrst, 'reload schema';
