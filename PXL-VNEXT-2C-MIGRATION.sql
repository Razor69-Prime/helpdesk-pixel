-- PXL-VNEXT-2C — Manual WO Survey → Sales Order source flow
-- Scope: manual WO location/type, survey report snapshot, WO cancel audit, survey source link to SO.
-- Existing SO → WO and WO → MR flows are intentionally not changed.

alter table if exists public.tickets add column if not exists google_maps_url text;
alter table if exists public.tickets add column if not exists survey_status text;
alter table if exists public.tickets add column if not exists survey_conditions text;
alter table if exists public.tickets add column if not exists survey_customer_needs text;
alter table if exists public.tickets add column if not exists survey_technical_notes text;
alter table if exists public.tickets add column if not exists survey_recommendation text;
alter table if exists public.tickets add column if not exists survey_constraints text;
alter table if exists public.tickets add column if not exists survey_materials jsonb not null default '[]'::jsonb;
alter table if exists public.tickets add column if not exists survey_services jsonb not null default '[]'::jsonb;
alter table if exists public.tickets add column if not exists survey_completed_at timestamptz;
alter table if exists public.tickets add column if not exists survey_completed_by text;
alter table if exists public.tickets add column if not exists survey_sales_order_id text;
alter table if exists public.tickets add column if not exists survey_so_number text;
alter table if exists public.tickets add column if not exists cancelled_at timestamptz;
alter table if exists public.tickets add column if not exists cancelled_by text;
alter table if exists public.tickets add column if not exists cancel_reason text;

alter table if exists public.sales_orders add column if not exists survey_source_ticket_id text;
alter table if exists public.sales_orders add column if not exists survey_source_wo_number text;

-- Existing data remains untouched. Survey status is populated only after a technician submits a survey report.
