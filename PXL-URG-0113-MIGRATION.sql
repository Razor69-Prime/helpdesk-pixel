-- PXL-URG-0113 — temporarily allow Project photos without GPS metadata.
alter table public.project_report_item_photos
  alter column latitude drop not null,
  alter column longitude drop not null;

create or replace function public.pxl_urg_0113_clear_disabled_gps()
returns trigger
language plpgsql
as $$
begin
  if new.address_text='GPS dinonaktifkan' then
    new.latitude:=null;
    new.longitude:=null;
  end if;
  return new;
end $$;

drop trigger if exists trg_pxl_urg_0113_clear_disabled_gps on public.project_report_item_photos;
create trigger trg_pxl_urg_0113_clear_disabled_gps
before insert or update on public.project_report_item_photos
for each row execute function public.pxl_urg_0113_clear_disabled_gps();
