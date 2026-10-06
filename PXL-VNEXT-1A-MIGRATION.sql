-- PXL-VNEXT-1A — CRM Customer Classification Foundation
alter table if exists public.crm_customers add column if not exists market_segment text;
alter table if exists public.crm_customers add column if not exists sector text;
update public.crm_customers set market_segment='Unclassified' where market_segment is null or btrim(market_segment)='';
alter table if exists public.crm_customers alter column market_segment set default 'Unclassified';