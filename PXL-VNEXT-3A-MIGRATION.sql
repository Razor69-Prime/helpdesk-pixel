-- PXL-VNEXT-3A — Project Detail Core + Primary WO + Gantt Plan
-- Additive only. No Primary WO guessing/backfill and no automatic Gantt creation.

begin;

create table if not exists public.project_primary_work_orders (
  project_id uuid primary key references public.projects(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint project_primary_work_orders_ticket_unique unique (ticket_id)
);

create table if not exists public.project_gantt_plans (
  project_id uuid primary key references public.projects(id) on delete cascade,
  start_date date not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_gantt_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  duration_days integer not null check (duration_days between 1 and 3650),
  planned_start date not null,
  planned_end date not null,
  notes text,
  sort_order integer not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint project_gantt_stages_project_sort_unique unique (project_id, sort_order),
  constraint project_gantt_stages_date_order check (planned_end >= planned_start)
);

create index if not exists idx_project_primary_work_orders_ticket_id on public.project_primary_work_orders(ticket_id);
create index if not exists idx_project_gantt_stages_project_id on public.project_gantt_stages(project_id,sort_order);

alter table public.project_primary_work_orders enable row level security;
alter table public.project_gantt_plans enable row level security;
alter table public.project_gantt_stages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_primary_work_orders' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on public.project_primary_work_orders for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_gantt_plans' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on public.project_gantt_plans for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_gantt_stages' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on public.project_gantt_stages for all using (true) with check (true);
  end if;
end $$;

create or replace function public.pxl_vnext_3a_replace_project_gantt_plan(
  p_project_id uuid,
  p_start_date date,
  p_stages jsonb,
  p_actor text default 'System'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  stage jsonb;
  stage_count integer;
  actor text:=coalesce(nullif(trim(p_actor),''),'System');
  duration integer;
  stage_name text;
  stage_start date;
  stage_end date;
  stage_order integer;
begin
  if p_project_id is null or not exists(select 1 from public.projects where id=p_project_id) then
    raise exception 'Project tidak ditemukan.';
  end if;
  if p_start_date is null then raise exception 'Tanggal mulai Project wajib diisi.'; end if;
  if p_stages is null or jsonb_typeof(p_stages)<>'array' then raise exception 'Daftar tahap Gantt tidak valid.'; end if;
  stage_count:=jsonb_array_length(p_stages);
  if stage_count<1 or stage_count>100 then raise exception 'Gantt Plan harus memiliki 1 sampai 100 tahap.'; end if;

  insert into public.project_gantt_plans(project_id,start_date,created_by,created_at,updated_by,updated_at)
  values(p_project_id,p_start_date,actor,now(),actor,now())
  on conflict(project_id) do update set start_date=excluded.start_date,updated_by=actor,updated_at=now();

  delete from public.project_gantt_stages where project_id=p_project_id;

  for stage in select value from jsonb_array_elements(p_stages)
  loop
    stage_name:=trim(coalesce(stage->>'name',''));
    duration:=nullif(stage->>'duration_days','')::integer;
    stage_start:=nullif(stage->>'planned_start','')::date;
    stage_end:=nullif(stage->>'planned_end','')::date;
    stage_order:=coalesce(nullif(stage->>'sort_order','')::integer,0);
    if stage_name='' then raise exception 'Nama tahap Gantt wajib diisi.'; end if;
    if duration is null or duration<1 or duration>3650 then raise exception 'Durasi tahap Gantt harus 1 sampai 3650 hari.'; end if;
    if stage_start is null or stage_end is null or stage_end<stage_start then raise exception 'Tanggal tahap Gantt tidak valid.'; end if;

    insert into public.project_gantt_stages(
      project_id,name,duration_days,planned_start,planned_end,notes,sort_order,created_by,created_at,updated_by,updated_at
    ) values(
      p_project_id,stage_name,duration,stage_start,stage_end,nullif(stage->>'notes',''),stage_order,actor,now(),actor,now()
    );
  end loop;

  return jsonb_build_object('ok',true,'project_id',p_project_id,'stage_count',stage_count);
end;
$$;

-- Full VPS: PostgREST runs as table/function owner role `pixelapps`; no Supabase-role GRANT required.

commit;

-- Refresh PostgREST schema cache so the new tables/RPC are available immediately.
notify pgrst, 'reload schema';
