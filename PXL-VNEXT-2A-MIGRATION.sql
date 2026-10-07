-- PXL-VNEXT-2A — Work Order V2 type foundation
-- Priority: Survey > Project (exact CRM name + project keyword) > Operasional > Unclassified.
alter table if exists public.tickets add column if not exists work_order_type text;

update public.tickets t
set work_order_type = case
  when lower(coalesce(t.wo_number,'') || ' ' || coalesce(t.project_name,'') || ' ' || coalesce(t.description,'')) ~ '(^|[^a-z0-9])survey([^a-z0-9]|$)'
    then 'Survey'
  when exists (
    select 1 from public.crm_customers c
    where lower(btrim(c.name)) = lower(btrim(coalesce(t.customer_name,'')))
      and lower(c.name) ~ '(kantor[[:space:]]+desa|(^|[^a-z0-9])desa([^a-z0-9]|$)|(^|[^a-z0-9])bpn([^a-z0-9]|$))'
  ) then 'Project'
  when lower(coalesce(t.wo_number,'') || ' ' || coalesce(t.project_name,'') || ' ' || coalesce(t.description,'')) ~ '(^|[^a-z0-9])(instalasi|maintenance)([^a-z0-9]|$)'
    then 'Operasional'
  else 'Unclassified'
end
where t.work_order_type is null or btrim(t.work_order_type) = '';

alter table if exists public.tickets alter column work_order_type set default 'Unclassified';
