-- PXL-WH-0001. Dedicated Warehouse metadata; no triggers on SO, WO, MR or inventory.
CREATE TABLE IF NOT EXISTS public.warehouse_monitor_records (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_key text NOT NULL UNIQUE,
 manual_items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(manual_items)='array'),
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warehouse_monitor_records_source_idx ON public.warehouse_monitor_records(source_key);
REVOKE ALL ON public.warehouse_monitor_records FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
 GRANT SELECT, INSERT, UPDATE ON public.warehouse_monitor_records TO service_role;
 GRANT USAGE, SELECT ON SEQUENCE public.warehouse_monitor_records_id_seq TO service_role;
 END IF;
END $$;
NOTIFY pgrst, 'reload schema';

-- Independent physical count audit, never updates inventory_items.
CREATE TABLE IF NOT EXISTS public.warehouse_stock_checks (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 inventory_item_id text NOT NULL,
 sku text NOT NULL DEFAULT '',
 item_name text NOT NULL,
 system_qty numeric(16,3) NOT NULL,
 physical_qty numeric(16,3) NOT NULL CHECK(physical_qty >= 0),
 actor_name text NOT NULL,
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warehouse_stock_checks_created_idx ON public.warehouse_stock_checks(created_at DESC);
REVOKE ALL ON public.warehouse_stock_checks FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
 GRANT SELECT, INSERT ON public.warehouse_stock_checks TO service_role;
 GRANT USAGE, SELECT ON SEQUENCE public.warehouse_stock_checks_id_seq TO service_role;
 END IF;
END $$;
NOTIFY pgrst, 'reload schema';
