-- PXL-SALES-BILL-0001 — tracking only, independent from WO closing and invoice.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sales_wo_billing (
  wo_id uuid PRIMARY KEY REFERENCES public.tickets(id),
  status text NOT NULL CHECK(status IN ('needs_review','pending_note','noted','no_revenue')),
  revenue_amount numeric(18,2) CHECK(revenue_amount IS NULL OR revenue_amount >= 0),
  note_number text,
  note_date date,
  reason text,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status <> 'noted' OR (note_date IS NOT NULL AND revenue_amount > 0)),
  CHECK(status <> 'pending_note' OR revenue_amount > 0),
  CHECK(status <> 'no_revenue' OR nullif(btrim(reason),'') IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.sales_wo_billing_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wo_id uuid NOT NULL REFERENCES public.tickets(id),
  action text NOT NULL,
  status text NOT NULL,
  revenue_amount numeric(18,2),
  note_number text,
  note_date date,
  reason text,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_wo_billing_history_wo_idx ON public.sales_wo_billing_history(wo_id,created_at DESC);
CREATE OR REPLACE FUNCTION public.sales_wo_billing_record_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.sales_wo_billing_history(wo_id,action,status,revenue_amount,note_number,note_date,reason,actor)
  VALUES(NEW.wo_id,CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,NEW.status,NEW.revenue_amount,NEW.note_number,NEW.note_date,NEW.reason,NEW.updated_by);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sales_wo_billing_audit ON public.sales_wo_billing;
CREATE TRIGGER sales_wo_billing_audit AFTER INSERT OR UPDATE ON public.sales_wo_billing
FOR EACH ROW EXECUTE FUNCTION public.sales_wo_billing_record_history();
REVOKE ALL ON public.sales_wo_billing,public.sales_wo_billing_history FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT SELECT,INSERT,UPDATE ON public.sales_wo_billing TO service_role;
    GRANT SELECT ON public.sales_wo_billing_history TO service_role;
    GRANT INSERT ON public.sales_wo_billing_history TO service_role;
    GRANT USAGE,SELECT ON SEQUENCE public.sales_wo_billing_history_id_seq TO service_role;
  END IF;
END $$;
COMMIT;
NOTIFY pgrst,'reload schema';
