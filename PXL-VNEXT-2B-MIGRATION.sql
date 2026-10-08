-- PXL-VNEXT-2B — Survey fields on existing Work Order flow
alter table if exists public.tickets add column if not exists survey_location text;
alter table if exists public.tickets add column if not exists survey_pic_name text;
alter table if exists public.tickets add column if not exists survey_pic_phone text;
alter table if exists public.tickets add column if not exists survey_notes text;
alter table if exists public.tickets add column if not exists survey_result text;
