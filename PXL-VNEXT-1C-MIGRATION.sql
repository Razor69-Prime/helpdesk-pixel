-- PXL-VNEXT-1C — Sales Order market classification snapshot
-- Existing Sales Order rows are intentionally not reclassified automatically.
alter table if exists public.sales_orders add column if not exists market_segment text;
alter table if exists public.sales_orders add column if not exists sector text;
alter table if exists public.sales_orders alter column market_segment set default 'Unclassified';
