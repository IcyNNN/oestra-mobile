-- =============================================================================
-- symptom_logs.source — distinguish manual entries vs Apple Health / Health Connect
-- Partial unique index enables daily upsert per (user, date, log_type, source).
-- =============================================================================

ALTER TABLE public.symptom_logs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.symptom_logs.source IS
  'manual | healthkit | health_connect | chat_import';

CREATE UNIQUE INDEX IF NOT EXISTS idx_symptom_logs_health_sync
  ON public.symptom_logs (user_id, logged_on, log_type, source)
  WHERE source IN ('healthkit', 'health_connect');
