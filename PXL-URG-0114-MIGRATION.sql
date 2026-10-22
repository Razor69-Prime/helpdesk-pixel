begin;

create or replace function public.pxl_urg_0114_sync_manual_mr_report_items(
  p_request_id uuid,
  p_actor text default null
) returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_mr public.project_material_requests%rowtype;
  v_item public.project_material_request_items%rowtype;
  v_report_item_id uuid;
  v_sort integer;
  v_count integer:=0;
begin
  select * into v_mr
  from public.project_material_requests
  where id=p_request_id
  for update;

  if v_mr.id is null then
    raise exception 'MR Project tidak ditemukan.';
  end if;
  if v_mr.status<>'approved' then
    return 0;
  end if;

  for v_item in
    select *
    from public.project_material_request_items
    where project_material_request_id=p_request_id
      and source_type='manual'
      and project_boq_item_id is null
    order by sort_order,created_at,id
    for update
  loop
    select coalesce(max(sort_order),-1)+1 into v_sort
    from public.project_report_items
    where project_id=v_mr.project_id;

    insert into public.project_report_items(
      project_id,category,item_name,boq_qty,unit,notes,sort_order,status_override,created_by
    ) values(
      v_mr.project_id,
      'material',
      v_item.item_name_snapshot,
      v_item.qty_requested,
      v_item.unit_snapshot,
      'Sumber: MR Manual · '||coalesce(v_mr.mr_number,'MR Project'),
      v_sort,
      null,
      coalesce(nullif(trim(p_actor),''),v_mr.approved_by,v_mr.created_by,'System')
    ) returning id into v_report_item_id;

    update public.project_material_request_items
    set project_boq_item_id=v_report_item_id,
        updated_at=now()
    where id=v_item.id;

    v_count:=v_count+1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.pxl_urg_0114_manual_mr_report_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status='approved' and old.status is distinct from new.status then
    perform public.pxl_urg_0114_sync_manual_mr_report_items(new.id,new.approved_by);
  end if;
  return new;
end;
$$;

drop trigger if exists pxl_urg_0114_manual_mr_report_sync on public.project_material_requests;
create trigger pxl_urg_0114_manual_mr_report_sync
after update of status on public.project_material_requests
for each row
execute function public.pxl_urg_0114_manual_mr_report_sync_trigger();

do $$
declare
  v_request record;
begin
  for v_request in
    select id,coalesce(approved_by,created_by,'System') as actor
    from public.project_material_requests
    where status='approved'
    order by created_at,id
  loop
    perform public.pxl_urg_0114_sync_manual_mr_report_items(v_request.id,v_request.actor);
  end loop;
end;
$$;

notify pgrst,'reload schema';
commit;
