-- PXL-VNEXT-3A1 — Shared Gantt templates
-- Additive only. Existing project Gantt plans/stages are never rewritten or backfilled.

begin;

create table if not exists public.project_gantt_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_gantt_template_stages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_gantt_templates(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  duration_days integer not null check (duration_days between 1 and 3650),
  sort_order integer not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint project_gantt_template_stages_sort_unique unique (template_id, sort_order)
);

create index if not exists idx_project_gantt_template_stages_template_id
  on public.project_gantt_template_stages(template_id, sort_order);

alter table public.project_gantt_templates enable row level security;
alter table public.project_gantt_template_stages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='project_gantt_templates' and policyname='Allow all for authenticated'
  ) then
    create policy "Allow all for authenticated" on public.project_gantt_templates for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='project_gantt_template_stages' and policyname='Allow all for authenticated'
  ) then
    create policy "Allow all for authenticated" on public.project_gantt_template_stages for all using (true) with check (true);
  end if;
end $$;

create or replace function public.pxl_vnext_3a1_create_gantt_template(
  p_name text,
  p_stages jsonb,
  p_actor text default 'System'
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_template_id uuid;
  v_name text:=trim(coalesce(p_name,''));
  v_actor text:=coalesce(nullif(trim(p_actor),''),'System');
  v_stage jsonb;
  v_stage_count integer;
  v_stage_name text;
  v_duration integer;
  v_sort_order integer;
begin
  if length(v_name)<1 or length(v_name)>120 then
    raise exception 'Nama template wajib 1 sampai 120 karakter.';
  end if;
  if p_stages is null or jsonb_typeof(p_stages)<>'array' then
    raise exception 'Daftar tahap template tidak valid.';
  end if;
  v_stage_count:=jsonb_array_length(p_stages);
  if v_stage_count<1 or v_stage_count>100 then
    raise exception 'Template Gantt harus memiliki 1 sampai 100 tahap.';
  end if;

  insert into public.project_gantt_templates(name,created_by,created_at,updated_by,updated_at)
  values(v_name,v_actor,now(),v_actor,now())
  returning id into v_template_id;

  for v_stage in select value from jsonb_array_elements(p_stages)
  loop
    v_stage_name:=trim(coalesce(v_stage->>'name',''));
    begin
      v_duration:=(v_stage->>'duration_days')::integer;
      v_sort_order:=(v_stage->>'sort_order')::integer;
    exception when others then
      raise exception 'Durasi atau urutan tahap template tidak valid.';
    end;
    if v_stage_name='' then raise exception 'Nama tahap template wajib diisi.'; end if;
    if v_duration<1 or v_duration>3650 then raise exception 'Durasi tahap template harus 1 sampai 3650 hari.'; end if;
    if v_sort_order<0 or v_sort_order>=v_stage_count then raise exception 'Urutan tahap template tidak valid.'; end if;

    insert into public.project_gantt_template_stages(
      template_id,name,duration_days,sort_order,created_by,created_at,updated_by,updated_at
    ) values(
      v_template_id,v_stage_name,v_duration,v_sort_order,v_actor,now(),v_actor,now()
    );
  end loop;

  if (select count(*) from public.project_gantt_template_stages where template_id=v_template_id)<>v_stage_count then
    raise exception 'Urutan tahap template tidak lengkap atau duplikat.';
  end if;

  return v_template_id;
end;
$$;

-- Full VPS: PostgREST runs as owner role `pixelapps`; no Supabase-role GRANT required.
commit;
notify pgrst, 'reload schema';
