begin;

create or replace function public.pxl_vnext_3b_apply_project_mr_movement(p_request_id uuid,p_movement_type text,p_items jsonb,p_actor text,p_actor_id text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_mr public.project_material_requests%rowtype; v_type text:=lower(trim(coalesce(p_movement_type,''))); v_op public.project_material_request_operations%rowtype; r jsonb; v_item public.project_material_request_items%rowtype; v_inv public.inventory_items%rowtype; v_item_id uuid; v_requested_inventory_id uuid; v_qty numeric(14,2); v_out numeric(14,2); v_net numeric(14,2); v_count integer:=0; v_result jsonb;
begin
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'Idempotency key wajib diisi.'; end if;
  if v_type not in ('take','return','use') then raise exception 'Tipe movement MR Project tidak valid.'; end if;
  insert into public.project_material_request_operations(idempotency_key,project_material_request_id,movement_type,performed_by,performed_by_user_id)
  values(p_idempotency_key,p_request_id,v_type,p_actor,p_actor_id)
  on conflict(idempotency_key) do nothing
  returning * into v_op;
  if v_op.id is null then
    select * into v_op from public.project_material_request_operations where idempotency_key=p_idempotency_key for update;
    if v_op.project_material_request_id<>p_request_id or v_op.movement_type<>v_type then
      raise exception 'Idempotency key sudah digunakan untuk request atau movement berbeda.';
    end if;
    return coalesce(v_op.result_json,'{}'::jsonb) || jsonb_build_object('ok',true,'already_applied',true,'operation_id',v_op.id);
  end if;
  select * into v_mr from public.project_material_requests where id=p_request_id for update;
  if v_mr.id is null then raise exception 'MR Project tidak ditemukan.'; end if;
  if v_type='take' and v_mr.status not in ('approved','issued') then raise exception 'Material hanya dapat diambil setelah Approved.'; end if;
  if v_type in ('return','use') and v_mr.status<>'issued' then raise exception 'Return/Use hanya dapat dicatat setelah material Diambil.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 then raise exception 'Daftar movement material tidak valid.'; end if;
  for r in select value from jsonb_array_elements(p_items) loop
    v_item_id:=nullif(r->>'item_id','')::uuid; v_requested_inventory_id:=nullif(r->>'inventory_item_id','')::uuid; v_qty:=coalesce(nullif(r->>'qty','')::numeric,0);
    if v_item_id is null or v_qty<=0 then raise exception 'Item atau qty movement tidak valid.'; end if;
    select * into v_item from public.project_material_request_items where id=v_item_id and project_material_request_id=p_request_id for update;
    if v_item.id is null then raise exception 'Item MR Project tidak ditemukan.'; end if;
    v_out:=v_item.qty_taken-v_item.qty_returned-v_item.qty_used;
    if v_type='take' then
      if v_item.inventory_item_id is null then
        if v_requested_inventory_id is null then raise exception 'Pilih Inventory saat Take.'; end if;
        select * into v_inv from public.inventory_items where id=v_requested_inventory_id and is_active=true for update;
        if v_inv.id is null then raise exception 'Item Inventory tidak ditemukan atau tidak aktif.'; end if;
        update public.project_material_request_items set inventory_item_id=v_requested_inventory_id,sku_snapshot=coalesce(sku_snapshot,v_inv.sku),updated_at=now() where id=v_item.id;
        v_item.inventory_item_id:=v_requested_inventory_id;
      else
        if v_requested_inventory_id is not null and v_item.inventory_item_id<>v_requested_inventory_id then raise exception 'Inventory untuk item MR Project yang sudah pernah Take tidak dapat diganti.'; end if;
        select * into v_inv from public.inventory_items where id=v_item.inventory_item_id and is_active=true for update;
        if v_inv.id is null then raise exception 'Item Inventory tidak ditemukan atau tidak aktif.'; end if;
      end if;
      if coalesce(v_inv.tracking_mode,'quantity')='serial' then raise exception 'Item serial belum didukung untuk movement MR Project tanpa serial number.'; end if;
      v_net:=v_item.qty_taken-v_item.qty_returned;
      if v_net+v_qty>v_item.qty_requested then raise exception 'Qty pengambilan melebihi sisa qty request.'; end if;
      if v_inv.stock<v_qty then raise exception 'Stok Inventory tidak cukup untuk pengambilan.'; end if;
      update public.inventory_items set stock=stock-v_qty,updated_at=now() where id=v_inv.id;
      insert into public.inventory_transactions(item_id,transaction_type,qty,balance_after,reference,notes,created_by) values(v_inv.id,'PROJECT_MR_TAKE',-v_qty,v_inv.stock-v_qty,v_mr.mr_number,'Pengambilan MR Project '||v_mr.mr_number,p_actor);
      update public.project_material_request_items set qty_taken=qty_taken+v_qty,updated_at=now() where id=v_item.id;
    elsif v_type='return' then
      if v_qty>v_out then raise exception 'Qty return melebihi outstanding material.'; end if;
      if v_item.inventory_item_id is null then raise exception 'Item MR Project belum terhubung ke Inventory.'; end if;
      select * into v_inv from public.inventory_items where id=v_item.inventory_item_id for update;
      if v_inv.id is null then raise exception 'Item Inventory tidak ditemukan.'; end if;
      if coalesce(v_inv.tracking_mode,'quantity')='serial' then raise exception 'Item serial belum didukung untuk movement MR Project tanpa serial number.'; end if;
      update public.inventory_items set stock=stock+v_qty,updated_at=now() where id=v_inv.id;
      insert into public.inventory_transactions(item_id,transaction_type,qty,balance_after,reference,notes,created_by) values(v_inv.id,'PROJECT_MR_RETURN',v_qty,v_inv.stock+v_qty,v_mr.mr_number,'Pengembalian MR Project '||v_mr.mr_number,p_actor);
      update public.project_material_request_items set qty_returned=qty_returned+v_qty,updated_at=now() where id=v_item.id;
    else
      if v_qty>v_out then raise exception 'Qty terpakai melebihi outstanding material.'; end if;
      update public.project_material_request_items set qty_used=qty_used+v_qty,updated_at=now() where id=v_item.id;
    end if;
    insert into public.project_material_request_movements(project_material_request_id,project_material_request_item_id,movement_type,qty,operation_id,performed_by,performed_by_user_id) values(p_request_id,v_item.id,v_type,v_qty,v_op.id,p_actor,p_actor_id);
    v_count:=v_count+1;
  end loop;
  if v_type='take' and v_mr.status='approved' then update public.project_material_requests set status='issued',updated_at=now() where id=p_request_id; end if;
  insert into public.project_material_request_history(project_material_request_id,event_type,from_status,to_status,actor,actor_user_id) values(p_request_id,'movement_'||v_type,v_mr.status,case when v_type='take' and v_mr.status='approved' then 'issued' else v_mr.status end,p_actor,p_actor_id);
  v_result:=jsonb_build_object('ok',true,'operation_id',v_op.id,'request_id',p_request_id,'movement_type',v_type,'item_count',v_count,'status',case when v_type='take' and v_mr.status='approved' then 'issued' else v_mr.status end);
  update public.project_material_request_operations set result_json=v_result where id=v_op.id;
  return v_result;
end; $$;


notify pgrst,'reload schema';
commit;
