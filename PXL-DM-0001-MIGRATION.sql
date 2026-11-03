BEGIN;
CREATE TABLE IF NOT EXISTS public.digital_marketing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL UNIQUE CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  source_name text NOT NULL DEFAULT 'Marketing Apps',
  source_read_only boolean NOT NULL DEFAULT true CHECK (source_read_only = true),
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_hash text,
  pull_mode text NOT NULL DEFAULT 'manual' CHECK (pull_mode IN ('manual','auto','backfill')),
  pulled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.digital_marketing_pull_history (
  id bigserial PRIMARY KEY,
  period text NOT NULL,
  pull_mode text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed','skipped_closed')),
  message text,
  source_hash text,
  pulled_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_marketing_pull_history_period_idx ON public.digital_marketing_pull_history(period,pulled_at DESC);
COMMIT;
