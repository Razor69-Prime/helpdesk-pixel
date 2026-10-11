-- PXL-VNEXT-3B — Project Material Request
-- Additive only. Legacy material_request_forms / CRM MR are intentionally untouched.
begin;
create extension if not exists pgcrypto;

alter table public.projects add column if not exists project_number text;
create unique index if not exists projects_project_number_uidx on public.projects(project_number) where project_number is not null;

create table if not exists public.project_number_counters(
  project_year integer primary key,
  last_number integer not null default 0 check(last_number>=0),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_material_request_counters(
  project_id uuid primary key references public.projects(id) on delete cascade,
  last_number integer not null default 0 check(last_number>=0),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_material_requests(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  mr_number text not null unique,
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','issued','final')),
  created_by text,
  created_by_user_id text,
  submitted_by text,
  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  rejected_by text,
  rejected_at timestamptz,
  reject_reason text,
  finalized_by text,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_project_mr_project on public.project_material_requests(project_id,created_at desc);
create index if not exists idx_project_mr_status on public.project_material_requests(status,created_at desc);

create table if not exists public.project_material_request_items(
  id uuid primary key default gen_random_uuid(),
  project_material_request_id uuid not null references public.project_material_requests(id) on delete cascade,
  source_type text not null check(source_type in ('boq','inventory_extra')),
  project_boq_item_id uuid references public.project_report_items(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete restrict,
  item_name_snapshot text not null,
  sku_snapshot text,
  unit_snapshot text,
  qty_requested numeric(14,2) not null check(qty_requested>0),
  qty_taken numeric(14,2) not null default 0 check(qty_taken>=0),
  qty_returned numeric(14,2) not null default 0 check(qty_returned>=0),
  qty_used numeric(14,2) not null default 0 check(qty_used>=0),
  qty_outstanding numeric(14,2) generated always as (qty_taken-qty_returned-qty_used) stored,
  additional_reason text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_mr_item_outstanding_nonnegative check(qty_outstanding>=0),
  constraint project_mr_extra_reason_check check(source_type<>'inventory_extra' or (inventory_item_id is not null and length(trim(coalesce(additional_reason,'')))>0)),
  constraint project_mr_boq_source_check check(source_type<>'boq' or project_boq_item_id is not null)
);
create index if not exists idx_project_mr_items_request on public.project_material_request_items(project_material_request_id,sort_order);

create table if not exists public.project_material_request_operations(
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  project_material_request_id uuid not null references public.project_material_requests(id) on delete cascade,
  movement_type text not null check(movement_type in ('take','return','use')),
  performed_by text,
  performed_by_user_id text,
  performed_at timestamptz not null default now(),
  result_json jsonb
);

create table if not exists public.project_material_request_movements(
  id uuid primary key default gen_random_uuid(),
  project_material_request_id uuid not null references public.project_material_requests(id) on delete cascade,
  project_material_request_item_id uuid not null references public.project_material_request_items(id) on delete restrict,
  movement_type text not null check(movement_type in ('take','return','use')),
  qty numeric(14,2) not null check(qty>0),
  operation_id uuid not null references public.project_material_request_operations(id) on delete restrict,
  performed_by text,
  performed_by_user_id text,
  performed_at timestamptz not null default now()
);
create index if not exists idx_project_mr_movements_request on public.project_material_request_movements(project_material_request_id,performed_at desc);

create table if not exists public.project_material_request_history(
  id uuid primary key default gen_random_uuid(),
  project_material_request_id uuid not null references public.project_material_requests(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  actor text,
  actor_user_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_project_mr_history_request on public.project_material_request_history(project_material_request_id,created_at asc);

alter table public.project_material_requests enable row level security;
alter table public.project_material_request_items enable row level security;
alter table public.project_material_request_operations enable row level security;
alter table public.project_material_request_movements enable row level security;
alter table public.project_material_request_history enable row level security;

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='project_material_requests' and policyname='Allow all for authenticated') then create policy "Allow all for authenticated" on public.project_material_requests for all using(true) with check(true); end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='project_material_request_items' and policyname='Allow all for authenticated') then create policy "Allow all for authenticated" on public.project_material_request_items for all using(true) with check(true); end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='project_material_request_operations' and policyname='Allow all for authenticated') then create policy "Allow all for authenticated" on public.project_material_request_operations for all using(true) with check(true); end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='project_material_request_movements' and policyname='Allow all for authenticated') then create policy "Allow all for authenticated" on public.project_material_request_movements for all using(true) with check(true); end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='project_material_request_history' and policyname='Allow all for authenticated') then create policy "Allow all for authenticated" on public.project_material_request_history for all using(true) with check(true); end if;
end $$;

create or replace function public.pxl_vnext_3b_ensure_project_number(p_project_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_project public.projects%rowtype; v_year integer; v_next integer; v_number text;
begin
  select * into v_project from public.projects where id=p_project_id for update;
  if v_project.id is null then raise exception 'Project tidak ditemukan.'; end if;
  if v_project.project_number ~ '^PRJ-[0-9]{2}-[0-9]{3,}$' then return v_project.project_number; end if;
  v_year:=extract(year from coalesce(v_project.created_at,now()))::integer % 100;
  insert into public.project_number_counters(project_year,last_number) values(v_year,0) on conflict(project_year) do nothing;
  select last_number into v_next from public.project_number_counters where project_year=v_year for update;
  v_next:=v_next+1;
  update public.project_number_counters set last_number=v_next,updated_at=now() where project_year=v_year;
  v_number:=format('PRJ-%s-%s',lpad(v_year::text,2,'0'),lpad(v_next::text,3,'0'));
  update public.projects set project_number=v_number where id=p_project_id;
  return v_number;
end; $$;

do $$ declare r record; begin
  for r in select id from public.projects where project_number is null order by created_at,id loop
    perform public.pxl_vnext_3b_ensure_project_number(r.id);
  end loop;
end $$;

create or replace function public.pxl_vnext_3b_create_project_mr(p_project_id uuid,p_actor text,p_actor_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_project_number text; v_seq integer; v_mr_number text; v_id uuid:=gen_random_uuid();
begin
  v_project_number:=public.pxl_vnext_3b_ensure_project_number(p_project_id);
  insert into public.project_material_request_counters(project_id,last_number) values(p_project_id,0) on conflict(project_id) do nothing;
  select last_number into v_seq from public.project_material_request_counters where project_id=p_project_id for update;
  v_seq:=v_seq+1;
  update public.project_material_request_counters set last_number=v_seq,updated_at=now() where project_id=p_project_id;
  v_mr_number:=format('MRP-%s-%s',v_project_number,lpad(v_seq::text,3,'0'));
  insert into public.project_material_requests(id,project_id,mr_number,status,created_by,created_by_user_id) values(v_id,p_project_id,v_mr_number,'draft',p_actor,p_actor_id);
  insert into public.project_material_request_history(project_material_request_id,event_type,to_status,actor,actor_user_id) values(v_id,'created','draft',p_actor,p_actor_id);
  return jsonb_build_object('ok',true,'id',v_id,'project_id',p_project_id,'project_number',v_project_number,'mr_number',v_mr_number,'status','draft');
end; $$;

create or replace function public.pxl_vnext_3b_replace_project_mr_items(p_request_id uuid,p_items jsonb,p_actor text,p_actor_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_mr public.project_material_requests%rowtype; r jsonb; v_source text; v_boq uuid; v_inv uuid; v_qty numeric(14,2); v_name text; v_sku text; v_unit text; v_reason text; v_order integer:=0; v_count integer:=0;
begin
  select * into v_mr from public.project_material_requests where id=p_request_id for update;
  if v_mr.id is null then raise exception 'MR Project tidak ditemukan.'; end if;
  if v_mr.status not in ('draft','rejected') then raise exception 'Item hanya dapat diedit saat Draft atau Rejected.'; end if;
  if coalesce(v_mr.created_by_user_id,'')<>coalesce(p_actor_id,'') then raise exception 'MR Project hanya dapat diedit oleh pembuatnya.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Daftar item MR Project tidak valid.'; end if;
  delete from public.project_material_request_items where project_material_request_id=p_request_id;
  for r in select value from jsonb_array_elements(p_items) loop
    v_source:=lower(trim(coalesce(r->>'source_type',''))); v_boq:=nullif(r->>'project_boq_item_id','')::uuid; v_inv:=nullif(r->>'inventory_item_id','')::uuid; v_qty:=coalesce(nullif(r->>'qty_requested','')::numeric,0); v_reason:=nullif(trim(coalesce(r->>'additional_reason','')),'');
    if v_qty<=0 then raise exception 'Qty item harus lebih dari 0.'; end if;
    if v_source='boq' then
      select pri.item_name,pri.unit into v_name,v_unit from public.project_report_items pri where pri.id=v_boq and pri.project_id=v_mr.project_id and pri.category='material';
      if v_name is null then raise exception 'Item BOQ Project tidak valid.'; end if;
    elsif v_source='inventory_extra' then
      if v_inv is null or v_reason is null then raise exception 'Material tambahan wajib memilih Inventory dan mengisi alasan.'; end if;
      select ii.name,ii.sku,ii.unit into v_name,v_sku,v_unit from public.inventory_items ii where ii.id=v_inv and ii.is_active=true;
      if v_name is null then raise exception 'Item Inventory tidak ditemukan atau tidak aktif.'; end if;
    else raise exception 'Sumber item MR Project tidak valid.'; end if;
    if v_inv is not null and v_source='boq' then
      perform 1 from public.inventory_items ii where ii.id=v_inv and ii.is_active=true;
      if not found then raise exception 'Mapping Inventory untuk item BOQ tidak ditemukan atau tidak aktif.'; end if;
      select ii.sku into v_sku from public.inventory_items ii where ii.id=v_inv;
    end if;
    insert into public.project_material_request_items(project_material_request_id,source_type,project_boq_item_id,inventory_item_id,item_name_snapshot,sku_snapshot,unit_snapshot,qty_requested,additional_reason,sort_order) values(p_request_id,v_source,v_boq,v_inv,coalesce(v_name,'Material'),v_sku,v_unit,v_qty,v_reason,v_order);
    v_order:=v_order+1; v_count:=v_count+1;
  end loop;
  update public.project_material_requests set updated_at=now() where id=p_request_id;
  insert into public.project_material_request_history(project_material_request_id,event_type,from_status,to_status,actor,actor_user_id) values(p_request_id,'items_updated',v_mr.status,v_mr.status,p_actor,p_actor_id);
  return jsonb_build_object('ok',true,'request_id',p_request_id,'item_count',v_count);
end; $$;

create or replace function public.pxl_vnext_3b_transition_project_mr(p_request_id uuid,p_action text,p_actor text,p_actor_id text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_mr public.project_material_requests%rowtype; v_action text:=lower(trim(coalesce(p_action,''))); v_next text; v_count integer; v_out numeric(14,2);
begin
  select * into v_mr from public.project_material_requests where id=p_request_id for update;
  if v_mr.id is null then raise exception 'MR Project tidak ditemukan.'; end if;
  if v_action='submit' then
    if v_mr.status not in ('draft','rejected') then raise exception 'MR Project tidak dapat diajukan dari status ini.'; end if;
    if coalesce(v_mr.created_by_user_id,'')<>coalesce(p_actor_id,'') then raise exception 'MR Project hanya dapat diajukan oleh pembuatnya.'; end if;
    select count(*) into v_count from public.project_material_request_items where project_material_request_id=p_request_id;
    if v_count<1 then raise exception 'Minimal satu item MR Project wajib diisi.'; end if;
    v_next:='submitted';
    update public.project_material_requests set status=v_next,submitted_by=p_actor,submitted_at=now(),rejected_by=null,rejected_at=null,reject_reason=null,updated_at=now() where id=p_request_id;
  elsif v_action='approve' then
    if v_mr.status<>'submitted' then raise exception 'MR Project hanya dapat disetujui dari status Diajukan.'; end if;
    v_next:='approved';
    update public.project_material_requests set status=v_next,approved_by=p_actor,approved_at=now(),updated_at=now() where id=p_request_id;
  elsif v_action='reject' then
    if v_mr.status<>'submitted' then raise exception 'MR Project hanya dapat ditolak dari status Diajukan.'; end if;
    v_next:='rejected';
    update public.project_material_requests set status=v_next,rejected_by=p_actor,rejected_at=now(),reject_reason=nullif(trim(coalesce(p_reason,'')),''),updated_at=now() where id=p_request_id;
  elsif v_action='finalize' then
    if v_mr.status<>'issued' then raise exception 'MR Project hanya dapat difinalkan setelah material Diambil.'; end if;
    select coalesce(sum(qty_outstanding),0) into v_out from public.project_material_request_items where project_material_request_id=p_request_id;
    if v_out>0 then raise exception 'MR Project belum dapat Final karena masih ada outstanding material.'; end if;
    v_next:='final';
    update public.project_material_requests set status=v_next,finalized_by=p_actor,finalized_at=now(),updated_at=now() where id=p_request_id;
  else raise exception 'Aksi status MR Project tidak valid.'; end if;
  insert into public.project_material_request_history(project_material_request_id,event_type,from_status,to_status,note,actor,actor_user_id) values(p_request_id,v_action,v_mr.status,v_next,nullif(trim(coalesce(p_reason,'')),''),p_actor,p_actor_id);
  return jsonb_build_object('ok',true,'request_id',p_request_id,'from_status',v_mr.status,'status',v_next);
end; $$;

create or replace function public.pxl_vnext_3b_apply_project_mr_movement(p_request_id uuid,p_movement_type text,p_items jsonb,p_actor text,p_actor_id text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_mr public.project_material_requests%rowtype; v_type text:=lower(trim(coalesce(p_movement_type,''))); v_op public.project_material_request_operations%rowtype; r jsonb; v_item public.project_material_request_items%rowtype; v_inv public.inventory_items%rowtype; v_item_id uuid; v_qty numeric(14,2); v_out numeric(14,2); v_net numeric(14,2); v_count integer:=0; v_result jsonb;
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
    v_item_id:=nullif(r->>'item_id','')::uuid; v_qty:=coalesce(nullif(r->>'qty','')::numeric,0);
    if v_item_id is null or v_qty<=0 then raise exception 'Item atau qty movement tidak valid.'; end if;
    select * into v_item from public.project_material_request_items where id=v_item_id and project_material_request_id=p_request_id for update;
    if v_item.id is null then raise exception 'Item MR Project tidak ditemukan.'; end if;
    v_out:=v_item.qty_taken-v_item.qty_returned-v_item.qty_used;
    if v_type='take' then
      if v_item.inventory_item_id is null then raise exception 'Item MR Project belum terhubung ke Inventory.'; end if;
      select * into v_inv from public.inventory_items where id=v_item.inventory_item_id and is_active=true for update;
      if v_inv.id is null then raise exception 'Item Inventory tidak ditemukan atau tidak aktif.'; end if;
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
