-- PXL-WH-0001G: independent draft/final workflow, no triggers or stock mutations.
CREATE TABLE IF NOT EXISTS public.warehouse_usage_documents (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 warehouse_id bigint NOT NULL REFERENCES public.warehouse_monitor_records(id),
 source_key text NOT NULL,
 usage_date date NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','FINAL')),
 lines jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lines)='array'),
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 created_by text NOT NULL DEFAULT '',
 updated_by text NOT NULL DEFAULT '',
 finalized_by text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 finalized_at timestamptz
);
CREATE INDEX IF NOT EXISTS warehouse_usage_documents_date_idx ON public.warehouse_usage_documents(usage_date DESC,id DESC);
CREATE INDEX IF NOT EXISTS warehouse_usage_documents_wh_idx ON public.warehouse_usage_documents(warehouse_id,status);
REVOKE ALL ON public.warehouse_usage_documents FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
   GRANT SELECT,INSERT,UPDATE ON public.warehouse_usage_documents TO service_role;
   GRANT USAGE,SELECT ON SEQUENCE public.warehouse_usage_documents_id_seq TO service_role;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
