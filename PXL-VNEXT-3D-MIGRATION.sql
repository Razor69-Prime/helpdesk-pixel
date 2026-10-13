-- PXL-VNEXT-3D — Project item photo documentation
create extension if not exists pgcrypto;

create table if not exists public.project_report_item_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  project_report_item_id uuid not null references project_report_items(id) on delete cascade,
  secure_url text not null,
  cloudinary_public_id text not null unique,
  original_filename text,
  generated_filename text,
  source_type text not null check (source_type in ('camera','gallery')),
  project_number_snapshot text not null,
  latitude numeric not null,
  longitude numeric not null,
  address_text text not null default 'Alamat tidak tersedia',
  location_label text,
  evidence_time timestamptz not null,
  time_semantics text not null check (time_semantics in ('documentation','upload')),
  uploaded_by_user_id text,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_user_id text,
  deleted_by text
);
create index if not exists idx_project_report_item_photos_item on public.project_report_item_photos(project_report_item_id,uploaded_at desc);
create index if not exists idx_project_report_item_photos_project on public.project_report_item_photos(project_id,uploaded_at desc);
create index if not exists idx_project_report_item_photos_active on public.project_report_item_photos(project_report_item_id) where deleted_at is null;

create table if not exists public.project_report_achievement_photos (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid not null references project_report_item_achievements(id) on delete cascade,
  photo_id uuid not null references project_report_item_photos(id) on delete restrict,
  linked_by_user_id text,
  linked_by text not null,
  created_at timestamptz not null default now(),
  unique (achievement_id, photo_id)
);
create index if not exists idx_project_report_achievement_photos_achievement on public.project_report_achievement_photos(achievement_id);
create index if not exists idx_project_report_achievement_photos_photo on public.project_report_achievement_photos(photo_id);

alter table public.project_report_item_photos enable row level security;
alter table public.project_report_achievement_photos enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_report_item_photos' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on public.project_report_item_photos for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_report_achievement_photos' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on public.project_report_achievement_photos for all using (true) with check (true);
  end if;
end $$;

create or replace function public.pxl_vnext_3d_create_project_achievement_with_photos(
  p_item_id uuid,
  p_achievement numeric,
  p_achievement_date date,
  p_notes text,
  p_actor text,
  p_actor_id text,
  p_photo_ids jsonb
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_achievement_id uuid:=gen_random_uuid();
  v_photo_id uuid;
  v_ids uuid[]:=array[]::uuid[];
  v_count integer;
begin
  if p_achievement is null or p_achievement<=0 then raise exception 'Achievement wajib lebih dari 0.'; end if;
  if p_photo_ids is null or jsonb_typeof(p_photo_ids)<>'array' then raise exception 'Minimal 1 foto Project wajib dipilih.'; end if;
  select coalesce(array_agg(distinct value::uuid),array[]::uuid[]) into v_ids from jsonb_array_elements_text(p_photo_ids);
  if cardinality(v_ids)=0 then raise exception 'Minimal 1 foto Project wajib dipilih.'; end if;
  select count(*) into v_count from project_report_item_photos p where p.id=any(v_ids) and p.project_report_item_id=p_item_id and p.deleted_at is null;
  if v_count<>cardinality(v_ids) then raise exception 'Foto Project tidak valid atau bukan milik item BOQ yang sama.'; end if;
  insert into project_report_item_achievements(id,item_id,achievement_date,achievement,notes,created_by,created_at,updated_at)
  values(v_achievement_id,p_item_id,coalesce(p_achievement_date,current_date),p_achievement,p_notes,p_actor,now(),now());
  foreach v_photo_id in array v_ids loop
    insert into project_report_achievement_photos(achievement_id,photo_id,linked_by_user_id,linked_by)
    values(v_achievement_id,v_photo_id,p_actor_id,p_actor);
  end loop;
  return v_achievement_id;
end $$;
