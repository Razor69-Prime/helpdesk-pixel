-- PXL-URG-0109 — Align WO cancel status constraint with canonical application status.
-- Schema-only: no ticket rows are rewritten.
begin;

alter table public.tickets
  drop constraint if exists tickets_status_check;

alter table public.tickets
  add constraint tickets_status_check
  check (status = any (array[
    'assigned'::text,
    'travelling'::text,
    'ongoing'::text,
    'done'::text,
    'pending'::text,
    'progress'::text,
    'cancel'::text,
    'cancelled'::text
  ]));

commit;
notify pgrst, 'reload schema';
