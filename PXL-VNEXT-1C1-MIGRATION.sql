-- PXL-VNEXT-1C1 — Sales Order customer source snapshot
-- Existing Sales Order rows are intentionally not rewritten.
alter table if exists public.sales_orders add column if not exists customer_source text;
