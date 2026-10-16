-- PXL-URG-0113 — temporarily allow Project photos without GPS metadata.
alter table public.project_report_item_photos
  alter column latitude drop not null,
  alter column longitude drop not null;
