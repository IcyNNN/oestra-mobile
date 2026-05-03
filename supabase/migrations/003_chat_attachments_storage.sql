-- =============================================================================
-- Storage RLS for bucket `chat-attachments`
--
-- Supabase SQL Editor runs as `postgres` and CANNOT insert into `storage.buckets`
-- (ownership is `supabase_storage_admin`). Create the bucket in the Dashboard first.
--
-- STEP 1 — Dashboard: Storage → New bucket
--   • Bucket name: chat-attachments
--   • Public bucket: OFF
--   • Optional file size limit: 52428800 (50 MB)
--
-- STEP 2 — Run this migration (policies + symptom_logs.source if missing).
--
-- If you never ran `002_symptom_logs_source.sql`, `source` does not exist yet.
-- =============================================================================

ALTER TABLE public.symptom_logs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.symptom_logs.source IS 'manual | healthkit | health_connect | chat_import';

CREATE UNIQUE INDEX IF NOT EXISTS idx_symptom_logs_health_sync
  ON public.symptom_logs (user_id, logged_on, log_type, source)
  WHERE source IN ('healthkit', 'health_connect');

DROP POLICY IF EXISTS "chat_attachments_insert_own" ON storage.objects;
CREATE POLICY "chat_attachments_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat_attachments_select_own" ON storage.objects;
CREATE POLICY "chat_attachments_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat_attachments_delete_own" ON storage.objects;
CREATE POLICY "chat_attachments_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
