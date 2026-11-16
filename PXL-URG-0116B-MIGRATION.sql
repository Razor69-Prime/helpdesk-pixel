-- PXL-URG-0116B — staging only. Inspection records do not change inventory stock.
CREATE TABLE IF NOT EXISTS public.warehouse_mr_inspection_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source text NOT NULL CHECK (source IN ('mr_form','crm_mr')),
 mr_id text NOT NULL,
 outcome text NOT NULL CHECK (outcome IN ('checked','discrepancy')),
 note text NOT NULL,
 quantity_checked numeric(16,3) NOT NULL CHECK (quantity_checked >= 0),
 actor_id text NOT NULL,
 actor_name text NOT NULL,
 snapshot_status text NOT NULL DEFAULT '',
 snapshot_warehouse_status text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warehouse_mr_inspection_ref ON public.warehouse_mr_inspection_audit(source,mr_id,created_at DESC);
REVOKE ALL ON public.warehouse_mr_inspection_audit FROM PUBLIC;
-- Only the server-side PostgREST role may access this table.
-- Adjust the role during staging UAT if your PostgREST JWT maps to a different role.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT SELECT, INSERT ON public.warehouse_mr_inspection_audit TO service_role;
    GRANT USAGE, SELECT ON SEQUENCE public.warehouse_mr_inspection_audit_id_seq TO service_role;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
