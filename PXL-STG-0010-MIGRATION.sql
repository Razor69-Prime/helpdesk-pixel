-- PXL-STG-0010 — Project Tracker > Project Report
-- STAGING ONLY. Jalankan hanya di database Supabase STAGING.

create table if not exists project_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  total_boq numeric not null check (total_boq > 0),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_report_achievements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  achievement_date date not null default current_date,
  achievement numeric not null check (achievement > 0),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_reports_project_id on project_reports(project_id);
create index if not exists idx_project_report_ach_project_id on project_report_achievements(project_id);
create index if not exists idx_project_report_ach_date on project_report_achievements(achievement_date desc);

alter table project_reports enable row level security;
alter table project_report_achievements enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_reports' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on project_reports for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_report_achievements' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on project_report_achievements for all using (true) with check (true);
  end if;
end $$;

-- 3 dummy project khusus testing STAGING. Tidak menduplikasi jika migration dijalankan ulang.
insert into projects (prioritas,nama_project,pic,status,target_week,created_by)
select 'P1','[DUMMY] CCTV Desa Tumbak Bayuh','Testing Project Report','On Progress','Testing','PXL-STG-0010'
where not exists (select 1 from projects where nama_project='[DUMMY] CCTV Desa Tumbak Bayuh');

insert into projects (prioritas,nama_project,pic,status,target_week,created_by)
select 'P2','[DUMMY] Jaringan Villa Cemagi','Testing Project Report','On Progress','Testing','PXL-STG-0010'
where not exists (select 1 from projects where nama_project='[DUMMY] Jaringan Villa Cemagi');

insert into projects (prioritas,nama_project,pic,status,target_week,created_by)
select 'P2','[DUMMY] CCTV Restaurant Canggu','Testing Project Report','On Progress','Testing','PXL-STG-0010'
where not exists (select 1 from projects where nama_project='[DUMMY] CCTV Restaurant Canggu');

insert into project_reports(project_id,total_boq,updated_by)
select id,120,'PXL-STG-0010' from projects where nama_project='[DUMMY] CCTV Desa Tumbak Bayuh'
on conflict(project_id) do update set total_boq=excluded.total_boq,updated_by=excluded.updated_by,updated_at=now();
insert into project_reports(project_id,total_boq,updated_by)
select id,80,'PXL-STG-0010' from projects where nama_project='[DUMMY] Jaringan Villa Cemagi'
on conflict(project_id) do update set total_boq=excluded.total_boq,updated_by=excluded.updated_by,updated_at=now();
insert into project_reports(project_id,total_boq,updated_by)
select id,50,'PXL-STG-0010' from projects where nama_project='[DUMMY] CCTV Restaurant Canggu'
on conflict(project_id) do update set total_boq=excluded.total_boq,updated_by=excluded.updated_by,updated_at=now();

-- Bersihkan history dummy PXL-STG-0010 bila migration diulang, lalu seed kondisi testing yang konsisten.
delete from project_report_achievements where created_by='PXL-STG-0010';

insert into project_report_achievements(project_id,achievement_date,achievement,notes,created_by)
select id,current_date-1,45,'Dummy progress sebelumnya','PXL-STG-0010' from projects where nama_project='[DUMMY] CCTV Desa Tumbak Bayuh';
insert into project_report_achievements(project_id,achievement_date,achievement,notes,created_by)
select id,current_date,15,'Dummy today achievement','PXL-STG-0010' from projects where nama_project='[DUMMY] CCTV Desa Tumbak Bayuh';

insert into project_report_achievements(project_id,achievement_date,achievement,notes,created_by)
select id,current_date-1,56,'Dummy progress sebelumnya','PXL-STG-0010' from projects where nama_project='[DUMMY] Jaringan Villa Cemagi';
insert into project_report_achievements(project_id,achievement_date,achievement,notes,created_by)
select id,current_date,8,'Dummy today achievement','PXL-STG-0010' from projects where nama_project='[DUMMY] Jaringan Villa Cemagi';

insert into project_report_achievements(project_id,achievement_date,achievement,notes,created_by)
select id,current_date-1,15,'Dummy progress sebelumnya','PXL-STG-0010' from projects where nama_project='[DUMMY] CCTV Restaurant Canggu';
insert into project_report_achievements(project_id,achievement_date,achievement,notes,created_by)
select id,current_date,5,'Dummy today achievement','PXL-STG-0010' from projects where nama_project='[DUMMY] CCTV Restaurant Canggu';
