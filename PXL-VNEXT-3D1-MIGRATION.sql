-- PXL-VNEXT-3D1 — allow explicit manual Project MR items while BOQ ledger identity stays exact
begin;

alter table public.project_material_request_items
  drop constraint if exists project_material_request_items_source_type_check;

alter table public.project_material_request_items
  add constraint project_material_request_items_source_type_check
  check(source_type in ('boq','inventory_extra','manual'));

create or replace function public.pxl_vnext_3b_replace_project_mr_items(p_request_id uuid,p_items jsonb,p_actor text,p_actor_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_mr public.project_material_requests%rowtype;
  r jsonb;
  v_source text;
  v_boq uuid;
  v_qty numeric(14,2);
  v_name text;
  v_unit text;
  v_order integer:=0;
  v_count integer:=0;
begin
  select * into v_mr from public.project_material_requests where id=p_request_id for update;
  if v_mr.id is null then raise exception 'MR Project tidak ditemukan.'; end if;
  if v_mr.status not in ('draft','rejected') then raise exception 'Item hanya dapat diedit saat Draft atau Rejected.'; end if;
  if coalesce(v_mr.created_by_user_id,'')<>coalesce(p_actor_id,'') then raise exception 'MR Project hanya dapat diedit oleh pembuatnya.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Daftar item MR Project tidak valid.'; end if;

  delete from public.project_material_request_items where project_material_request_id=p_request_id;
  for r in select value from jsonb_array_elements(p_items) loop
    v_source:=lower(trim(coalesce(r->>'source_type','')));
    v_boq:=nullif(r->>'project_boq_item_id','')::uuid;
    v_qty:=coalesce(nullif(r->>'qty_requested','')::numeric,0);
    v_name:=null;
    v_unit:=null;

    if v_qty<=0 then raise exception 'Qty item harus lebih dari 0.'; end if;

    if v_source='boq' then
      if v_boq is null then raise exception 'Item BOQ Project tidak valid.'; end if;
      select pri.item_name,pri.unit into v_name,v_unit
        from public.project_report_items pri
        where pri.id=v_boq and pri.project_id=v_mr.project_id and pri.category='material';
      if v_name is null then raise exception 'Item BOQ Project harus Material dan berasal dari project yang sama.'; end if;
    elsif v_source='manual' then
      v_boq:=null;
      v_name:=nullif(trim(coalesce(r->>'item_name','')),'');
      v_unit:=nullif(trim(coalesce(r->>'unit','')),'');
      if v_name is null then raise exception 'Nama material manual wajib diisi.'; end if;
    else
      raise exception 'Sumber item MR Project harus BOQ Project atau Manual.';
    end if;

    insert into public.project_material_request_items(
      project_material_request_id,source_type,project_boq_item_id,inventory_item_id,item_name_snapshot,sku_snapshot,unit_snapshot,qty_requested,additional_reason,sort_order
    ) values(
      p_request_id,v_source,v_boq,null,v_name,null,v_unit,v_qty,null,v_order
    );
    v_order:=v_order+1;
    v_count:=v_count+1;
  end loop;

  update public.project_material_requests set updated_at=now() where id=p_request_id;
  insert into public.project_material_request_history(project_material_request_id,event_type,from_status,to_status,actor,actor_user_id)
    values(p_request_id,'items_updated',v_mr.status,v_mr.status,p_actor,p_actor_id);
  return jsonb_build_object('ok',true,'request_id',p_request_id,'item_count',v_count);
end; $$;

notify pgrst,'reload schema';
commit;
