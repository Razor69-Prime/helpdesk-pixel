-- PXL-VNEXT-3A2 — Project Multi-WO
-- Additive only. No Related WO backfill and no Project/WO row rewrite.

begin;

create table if not exists public.project_related_work_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id),
  created_by text,
  created_at timestamptz not null default now(),
  constraint project_related_work_orders_ticket_unique unique (ticket_id),
  constraint project_related_work_orders_project_ticket_unique unique (project_id, ticket_id)
);

create index if not exists idx_project_related_work_orders_project_id
  on public.project_related_work_orders(project_id, created_at);
create index if not exists idx_project_related_work_orders_ticket_id
  on public.project_related_work_orders(ticket_id);

alter table public.project_related_work_orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='project_related_work_orders'
      and policyname='Allow all for authenticated'
  ) then
    create policy "Allow all for authenticated"
      on public.project_related_work_orders
      for all using (true) with check (true);
  end if;
end $$;

-- One WO may belong to only one Project across Primary + Related relations.
-- The advisory xact lock serializes cross-table attempts for the same WO,
-- so concurrent Primary/Related requests cannot both pass the opposite-table check.
create or replace function public.pxl_vnext_3a2_guard_project_work_order_link()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if NEW.ticket_id is null then
    return NEW;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(NEW.ticket_id::text, 0));

  if TG_TABLE_NAME = 'project_primary_work_orders' then
    if exists (
      select 1
      from public.project_related_work_orders r
      where r.ticket_id = NEW.ticket_id
    ) then
      raise exception 'Work Order sudah terhubung ke Project lain sebagai Related WO.'
        using errcode='23505';
    end if;
  elsif TG_TABLE_NAME = 'project_related_work_orders' then
    if exists (
      select 1
      from public.project_primary_work_orders p
      where p.ticket_id = NEW.ticket_id
    ) then
      raise exception 'Work Order sudah terhubung ke Project lain sebagai Primary WO.'
        using errcode='23505';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_pxl_vnext_3a2_guard_primary_wo
  on public.project_primary_work_orders;
create trigger trg_pxl_vnext_3a2_guard_primary_wo
before insert or update of ticket_id on public.project_primary_work_orders
for each row execute function public.pxl_vnext_3a2_guard_project_work_order_link();

drop trigger if exists trg_pxl_vnext_3a2_guard_related_wo
  on public.project_related_work_orders;
create trigger trg_pxl_vnext_3a2_guard_related_wo
before insert or update of ticket_id on public.project_related_work_orders
for each row execute function public.pxl_vnext_3a2_guard_project_work_order_link();

commit;

notify pgrst, 'reload schema';
