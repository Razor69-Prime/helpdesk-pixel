-- ============================================================
-- PXL-STG-0004A
-- Relasi Sales Order -> CRM Work Order -> Material Request
-- Jalankan hanya pada Supabase STAGING
-- ============================================================

begin;

alter table public.sales_orders
  add column if not exists linked_crm_work_order_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_orders_linked_crm_work_order_id_fkey'
      and conrelid = 'public.sales_orders'::regclass
  ) then
    alter table public.sales_orders
      add constraint sales_orders_linked_crm_work_order_id_fkey
      foreign key (linked_crm_work_order_id)
      references public.crm_work_orders(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_sales_orders_linked_crm_wo
  on public.sales_orders(linked_crm_work_order_id);

update public.sales_orders so
set linked_crm_work_order_id = matched.crm_work_order_id
from (
  select distinct on (sales_order_id)
    sales_order_id,
    id as crm_work_order_id
  from public.crm_work_orders
  where sales_order_id is not null
  order by sales_order_id, created_at asc, id asc
) matched
where matched.sales_order_id = so.id
  and so.linked_crm_work_order_id is null;

create index if not exists idx_crm_work_orders_sales_order
  on public.crm_work_orders(sales_order_id);

create index if not exists idx_crm_material_requests_so_wo
  on public.crm_material_requests(sales_order_id, work_order_id);

commit;

-- Verification
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sales_orders'
  and column_name = 'linked_crm_work_order_id';

select
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.sales_orders'::regclass
  and conname = 'sales_orders_linked_crm_work_order_id_fkey';
