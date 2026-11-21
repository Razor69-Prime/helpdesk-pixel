-- PXL-WH-0001C: append-only daily usage, independent of inventory stock transactions.
CREATE TABLE IF NOT EXISTS public.warehouse_daily_usage (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 usage_date date NOT NULL,
 warehouse_id bigint NOT NULL REFERENCES public.warehouse_monitor_records(id),
 source_key text NOT NULL,
 inventory_item_id text,
 sku text NOT NULL CHECK (sku LIKE 'PX-%'),
 item_name text NOT NULL,
 unit text NOT NULL DEFAULT 'pcs',
 qty_used numeric(16,3) NOT NULL CHECK (qty_used > 0 AND qty_used <= 1000000),
 note text NOT NULL DEFAULT '',
 actor_name text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warehouse_daily_usage_date_idx ON public.warehouse_daily_usage(usage_date DESC,id DESC);
CREATE INDEX IF NOT EXISTS warehouse_daily_usage_wh_idx ON public.warehouse_daily_usage(warehouse_id);
REVOKE ALL ON public.warehouse_daily_usage FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT SELECT,INSERT ON public.warehouse_daily_usage TO service_role;
  GRANT USAGE,SELECT ON SEQUENCE public.warehouse_daily_usage_id_seq TO service_role;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
