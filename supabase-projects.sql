-- Tabel Project Tracker
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  prioritas       text default 'P2',              -- P1 / P2
  nama_project    text not null,
  pic             text,                            -- PIC internal (mis. Pak Eka, Budha)
  harga_pokok     numeric,
  omset           numeric,
  issue           text,                            -- issue terakhir (ringkasan cepat)
  action_plan     text,                            -- action plan terakhir (ringkasan cepat)
  status          text default 'On Plan',          -- On Plan / On Progress / Hold
  pic_desa        text,
  pic_desa_phone  text,
  target_week     text,                            -- mis. "Week-27"
  history         jsonb default '[]'::jsonb,        -- array histori update: [{date, issue, action_plan, by}]
  created_by      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_projects_status on projects(status);
create index if not exists idx_projects_prioritas on projects(prioritas);

alter table projects enable row level security;

create policy "Allow all for authenticated" on projects
  for all using (true) with check (true);
