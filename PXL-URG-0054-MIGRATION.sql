-- PXL-URG-0054 — CRM Transaction Starts at Invoice Issued
-- Production-safe compatibility migration.
-- Customer master may exist from SO/WO, but financial transaction starts at Invoice issued.

begin;

-- Invoice manual/direct sales must be allowed without Sales Order.
alter table public.crm_invoices
  alter column sales_order_id drop not null;

-- Legacy Customer 360 transaction rows were created from SO Approved.
-- They are kept as historical rows but excluded from transaction accounting.
update public.crm_customer_transactions
set status='legacy_so'
where status='approved';

-- Cached summary fields must reflect issued invoices only.
update public.crm_customers c
set
  transaction_count = coalesce((
    select count(*)::integer
    from public.crm_invoices i
    where i.customer_id=c.id
      and lower(coalesce(i.status,'')) in ('issued','partially_paid','paid','terbit','sebagian','lunas')
  ),0),
  lifetime_value = coalesce((
    select sum(coalesce(i.grand_total,0))
    from public.crm_invoices i
    where i.customer_id=c.id
      and lower(coalesce(i.status,'')) in ('issued','partially_paid','paid','terbit','sebagian','lunas')
  ),0),
  last_transaction_at = (
    select coalesce(i.invoice_date::timestamptz,i.updated_at,i.created_at)
    from public.crm_invoices i
    where i.customer_id=c.id
      and lower(coalesce(i.status,'')) in ('issued','partially_paid','paid','terbit','sebagian','lunas')
    order by coalesce(i.invoice_date::timestamptz,i.updated_at,i.created_at) desc
    limit 1
  ),
  last_transaction_amount = coalesce((
    select coalesce(i.grand_total,0)
    from public.crm_invoices i
    where i.customer_id=c.id
      and lower(coalesce(i.status,'')) in ('issued','partially_paid','paid','terbit','sebagian','lunas')
    order by coalesce(i.invoice_date::timestamptz,i.updated_at,i.created_at) desc
    limit 1
  ),0),
  last_sales_order_id = (
    select i.sales_order_id
    from public.crm_invoices i
    where i.customer_id=c.id
      and lower(coalesce(i.status,'')) in ('issued','partially_paid','paid','terbit','sebagian','lunas')
    order by coalesce(i.invoice_date::timestamptz,i.updated_at,i.created_at) desc
    limit 1
  ),
  last_so_number = (
    select i.so_number
    from public.crm_invoices i
    where i.customer_id=c.id
      and lower(coalesce(i.status,'')) in ('issued','partially_paid','paid','terbit','sebagian','lunas')
    order by coalesce(i.invoice_date::timestamptz,i.updated_at,i.created_at) desc
    limit 1
  );

-- Customer 360 summary now derives financial transaction totals from CRM invoices.
create or replace view public.crm_customer_360_summary as
select
  c.*,
  coalesce(s.computed_transaction_count,0) as computed_transaction_count,
  coalesce(s.computed_lifetime_value,0) as computed_lifetime_value,
  l.transaction_at as computed_last_transaction_at,
  l.sales_order_id as computed_last_sales_order_id,
  l.so_number as computed_last_so_number,
  null::text as computed_last_quotation_number,
  l.grand_total as computed_last_transaction_amount,
  null::text as computed_last_sales_pic,
  null::text as computed_last_project_name,
  l.location as computed_last_location
from public.crm_customers c
left join lateral (
  select
    count(*)::integer as computed_transaction_count,
    coalesce(sum(coalesce(i.grand_total,0)),0) as computed_lifetime_value
  from public.crm_invoices i
  where i.customer_id=c.id
    and lower(coalesce(i.status,'')) in ('issued','partially_paid','paid','terbit','sebagian','lunas')
) s on true
left join lateral (
  select
    coalesce(i.invoice_date::timestamptz,i.updated_at,i.created_at) as transaction_at,
    i.sales_order_id,
    i.so_number,
    coalesce(i.grand_total,0) as grand_total,
    i.billing_address as location
  from public.crm_invoices i
  where i.customer_id=c.id
    and lower(coalesce(i.status,'')) in ('issued','partially_paid','paid','terbit','sebagian','lunas')
  order by coalesce(i.invoice_date::timestamptz,i.updated_at,i.created_at) desc
  limit 1
) l on true;

commit;
