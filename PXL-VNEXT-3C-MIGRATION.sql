-- PXL-VNEXT-3C — Project Material Ledger override audit
-- Additive only. Project MR movement history and Operational MR are intentionally untouched.
begin;
create extension if not exists pgcrypto;

create table if not exists public.project_material_usage_overrides(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  project_boq_item_id uuid not null,
  primary_work_order_ticket_id uuid null,
  item_name_snapshot text not null,
  qty numeric(14,2) not null check(qty>0),
  reason text not null check(length(trim(reason))>0),
  created_by_user_id text,
  created_by text,
  created_at timestamptz not null default now(),
  reversed_at timestamptz null,
  reversed_by_user_id text null,
  reversed_by text null,
  reversal_reason text null
);

create index if not exists idx_project_material_usage_overrides_project
  on public.project_material_usage_overrides(project_id,created_at desc);
create index if not exists idx_project_material_usage_overrides_boq
  on public.project_material_usage_overrides(project_boq_item_id,created_at desc);

alter table public.project_material_usage_overrides enable row level security;
do $$ begin
  if not exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='project_material_usage_overrides'
      and policyname='Allow all for authenticated'
  ) then
    create policy "Allow all for authenticated"
      on public.project_material_usage_overrides
      for all using(true) with check(true);
  end if;
end $$;

-- Phase 3C active MR writes are BOQ Material only. Historical inventory_extra rows remain untouched.
create or replace function public.pxl_vnext_3b_replace_project_mr_items(p_request_id uuid,p_items jsonb,p_actor text,p_actor_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_mr public.project_material_requests%rowtype; r jsonb; v_source text; v_boq uuid; v_qty numeric(14,2); v_name text; v_unit text; v_order integer:=0; v_count integer:=0;
begin
  select * into v_mr from public.project_material_requests where id=p_request_id for update;
  if v_mr.id is null then raise exception 'MR Project tidak ditemukan.'; end if;
  if v_mr.status not in ('draft','rejected') then raise exception 'Item hanya dapat diedit saat Draft atau Rejected.'; end if;
  if coalesce(v_mr.created_by_user_id,'')<>coalesce(p_actor_id,'') then raise exception 'MR Project hanya dapat diedit oleh pembuatnya.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Daftar item MR Project tidak valid.'; end if;
  delete from public.project_material_request_items where project_material_request_id=p_request_id;
  for r in select value from jsonb_array_elements(p_items) loop
    v_source:=lower(trim(coalesce(r->>'source_type','')));
    if v_source<>'boq' then raise exception 'Phase 3C MR Project hanya menerima Material BOQ.'; end if;
    v_boq:=nullif(r->>'project_boq_item_id','')::uuid;
    v_qty:=coalesce(nullif(r->>'qty_requested','')::numeric,0);
    if v_boq is null then raise exception 'Item BOQ Project tidak valid.'; end if;
    if v_qty<=0 then raise exception 'Qty item harus lebih dari 0.'; end if;
    select pri.item_name,pri.unit into v_name,v_unit
      from public.project_report_items pri
      where pri.id=v_boq and pri.project_id=v_mr.project_id and pri.category='material';
    if v_name is null then raise exception 'Item BOQ Project harus Material dan berasal dari project yang sama.'; end if;
    insert into public.project_material_request_items(
      project_material_request_id,source_type,project_boq_item_id,inventory_item_id,item_name_snapshot,sku_snapshot,unit_snapshot,qty_requested,additional_reason,sort_order
    ) values(p_request_id,'boq',v_boq,null,v_name,null,v_unit,v_qty,null,v_order);
    v_order:=v_order+1; v_count:=v_count+1;
  end loop;
  update public.project_material_requests set updated_at=now() where id=p_request_id;
  insert into public.project_material_request_history(project_material_request_id,event_type,from_status,to_status,actor,actor_user_id)
    values(p_request_id,'items_updated',v_mr.status,v_mr.status,p_actor,p_actor_id);
  return jsonb_build_object('ok',true,'request_id',p_request_id,'item_count',v_count);
end; $$;

notify pgrst,'reload schema';
commit;
