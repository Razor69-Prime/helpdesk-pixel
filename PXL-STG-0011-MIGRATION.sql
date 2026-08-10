-- PXL-STG-0011 — Project Report Detail Material + Jasa
-- STAGING ONLY. Jalankan hanya pada database Supabase STAGING.

create table if not exists project_report_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  category text not null check (category in ('material','jasa')),
  item_name text not null,
  boq_qty numeric not null check (boq_qty > 0),
  unit text,
  notes text,
  sort_order integer not null default 0,
  status_override text check (status_override is null or status_override in ('Not Started','On Progress','Done')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_report_item_achievements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references project_report_items(id) on delete cascade,
  achievement_date date not null default current_date,
  achievement numeric not null check (achievement > 0),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_report_items_project_id on project_report_items(project_id);
create index if not exists idx_project_report_items_category on project_report_items(project_id,category,sort_order);
create index if not exists idx_project_report_item_ach_item_id on project_report_item_achievements(item_id);
create index if not exists idx_project_report_item_ach_date on project_report_item_achievements(achievement_date desc);

alter table project_report_items enable row level security;
alter table project_report_item_achievements enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_report_items' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on project_report_items for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_report_item_achievements' and policyname='Allow all for authenticated') then
    create policy "Allow all for authenticated" on project_report_item_achievements for all using (true) with check (true);
  end if;
end $$;

-- Seed detail BOQ pada dummy [DUMMY] CCTV Desa Tumbak Bayuh.
-- Aman dijalankan ulang: hanya seed PXL-STG-0011 yang dihapus/dibuat ulang.
delete from project_report_items
where created_by='PXL-STG-0011'
  and project_id in (select id from projects where nama_project='[DUMMY] CCTV Desa Tumbak Bayuh');

insert into project_report_items(project_id,category,item_name,boq_qty,unit,notes,sort_order,status_override,created_by)
select p.id,'material',v.item_name,v.boq_qty,v.unit,v.notes,v.sort_order,v.status_override,'PXL-STG-0011'
from projects p
cross join (values
  ('DS-96128NI-M8 128-ch 2U 4K NVR',1::numeric,'unit',null,1,null),
  ('OLT HA7304C 1U 4PON OLT EPON',1::numeric,'unit',null,2,null),
  ('EPON OLT SFP Module PX20+ SC/UPC Tx+5.5dBm ~ 7dBm Dis.20km',4::numeric,'unit',null,3,null),
  ('HDD 8TB',1::numeric,'unit',null,4,null),
  ('DS-2CD2T46G2H-4I 4MP Fixed Bullet Network Camera',17::numeric,'unit',null,5,null),
  ('Pole Galvanized 7m',8::numeric,'unit',null,6,null),
  ('Box Panel Outdoor 30x40x20 Galvanized + Bracket 4"',8::numeric,'unit',null,7,null),
  ('Bracket CCTV Polemount Galvanized 1 Meter',8::numeric,'unit',null,8,null),
  ('DPFO 16C PAZ',8::numeric,'unit',null,9,null),
  ('Fixing Slack',24::numeric,'unit','Sesuai kebutuhan di lapangan',10,null),
  ('Amprah Listrik Kwh-Meter 900VA',8::numeric,'unit',null,11,null),
  ('Switch PoE 4 Port',8::numeric,'unit',null,12,'On Progress'),
  ('ONT XPON/EPON',8::numeric,'unit',null,13,'On Progress')
) as v(item_name,boq_qty,unit,notes,sort_order,status_override)
where p.nama_project='[DUMMY] CCTV Desa Tumbak Bayuh';

-- Dummy Jasa agar persentase Material dan Jasa dapat diuji terpisah.
insert into project_report_items(project_id,category,item_name,boq_qty,unit,notes,sort_order,status_override,created_by)
select p.id,'jasa',v.item_name,v.boq_qty,v.unit,v.notes,v.sort_order,v.status_override,'PXL-STG-0011'
from projects p
cross join (values
  ('Instalasi Kamera CCTV',17::numeric,'titik',null,1,null),
  ('Instalasi Tiang Galvanized',8::numeric,'titik',null,2,null),
  ('Splicing dan Terminasi Fiber Optic',8::numeric,'titik',null,3,null),
  ('Konfigurasi Network dan NVR',1::numeric,'lot',null,4,'On Progress'),
  ('Testing & Commissioning',1::numeric,'lot',null,5,null)
) as v(item_name,boq_qty,unit,notes,sort_order,status_override)
where p.nama_project='[DUMMY] CCTV Desa Tumbak Bayuh';

-- Seed achievement Material. Item selesai diinput sebagai progress hari sebelumnya,
-- sedangkan Switch PoE dan ONT memakai Today Achievement 6 untuk testing.
insert into project_report_item_achievements(item_id,achievement_date,achievement,notes,created_by)
select i.id,current_date-1,
  case i.item_name
    when 'DS-96128NI-M8 128-ch 2U 4K NVR' then 1
    when 'OLT HA7304C 1U 4PON OLT EPON' then 1
    when 'EPON OLT SFP Module PX20+ SC/UPC Tx+5.5dBm ~ 7dBm Dis.20km' then 4
    when 'HDD 8TB' then 1
    when 'DS-2CD2T46G2H-4I 4MP Fixed Bullet Network Camera' then 17
    when 'Pole Galvanized 7m' then 8
    when 'Box Panel Outdoor 30x40x20 Galvanized + Bracket 4"' then 8
    when 'Bracket CCTV Polemount Galvanized 1 Meter' then 8
    when 'DPFO 16C PAZ' then 8
    when 'Fixing Slack' then 8
    when 'Amprah Listrik Kwh-Meter 900VA' then 8
  end,
  'Dummy progress material','PXL-STG-0011'
from project_report_items i
join projects p on p.id=i.project_id
where p.nama_project='[DUMMY] CCTV Desa Tumbak Bayuh'
  and i.created_by='PXL-STG-0011'
  and i.category='material'
  and i.item_name not in ('Switch PoE 4 Port','ONT XPON/EPON');

insert into project_report_item_achievements(item_id,achievement_date,achievement,notes,created_by)
select i.id,current_date,6,'Dummy today achievement','PXL-STG-0011'
from project_report_items i
join projects p on p.id=i.project_id
where p.nama_project='[DUMMY] CCTV Desa Tumbak Bayuh'
  and i.created_by='PXL-STG-0011'
  and i.item_name in ('Switch PoE 4 Port','ONT XPON/EPON');

-- Seed achievement Jasa: sebagian selesai dan sebagian masih progress.
insert into project_report_item_achievements(item_id,achievement_date,achievement,notes,created_by)
select i.id,current_date-1,
  case i.item_name
    when 'Instalasi Kamera CCTV' then 12
    when 'Instalasi Tiang Galvanized' then 8
    when 'Splicing dan Terminasi Fiber Optic' then 4
  end,
  'Dummy progress jasa','PXL-STG-0011'
from project_report_items i
join projects p on p.id=i.project_id
where p.nama_project='[DUMMY] CCTV Desa Tumbak Bayuh'
  and i.created_by='PXL-STG-0011'
  and i.category='jasa'
  and i.item_name in ('Instalasi Kamera CCTV','Instalasi Tiang Galvanized','Splicing dan Terminasi Fiber Optic');
