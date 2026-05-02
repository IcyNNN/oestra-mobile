-- =============================================================================
-- Oestra (潮汐) — Schema upgrade v2.0
-- Target: Supabase (PostgreSQL)
-- Date: 2026-05-01
--
-- Safe re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS where applicable.
-- Does NOT alter or remove existing columns — only adds columns / creates objects.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- pgvector (required for knowledge_base.embedding)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- A-1. symptom_logs — add log_type for multi-type daily logs
-- =============================================================================
-- Usage:
--   症状: log_type='symptom', symptom='头痛', severity=3
--   情绪: log_type='mood', symptom='烦躁', severity=4
--   能量: log_type='energy', symptom=null, severity=3 (1-5)
--   睡眠: log_type='sleep', symptom='浅睡多梦', severity=2
--   运动: log_type='exercise', symptom='瑜伽30分钟', severity=null
-- Optional values: 'symptom' | 'mood' | 'energy' | 'sleep' | 'exercise' | 'diet' | 'other'
-- =============================================================================
ALTER TABLE public.symptom_logs
  ADD COLUMN IF NOT EXISTS log_type text NOT NULL DEFAULT 'symptom';

COMMENT ON COLUMN public.symptom_logs.log_type IS
  'Record kind: symptom | mood | energy | sleep | exercise | diet | other (default symptom for legacy rows).';

-- =============================================================================
-- A-2. chat_messages — structured extraction + proactive flag
-- =============================================================================
-- metadata example:
-- {
--   "extracted_mood": "烦躁",
--   "extracted_energy": 2,
--   "extracted_symptoms": ["失眠", "头痛"],
--   "is_aha_moment": true,
--   "topics": ["黄体期", "情绪", "失眠"],
--   "cycle_day_at_message": 22
-- }
-- =============================================================================
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_proactive boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.chat_messages.metadata IS 'Structured fields extracted from this message (mood, symptoms, topics, cycle context, etc.).';
COMMENT ON COLUMN public.chat_messages.is_proactive IS 'True if this message was initiated by AI (not user question).';

-- =============================================================================
-- A-3. hormone_profiles — life stage, cycle profile, onboarding, companion name
-- =============================================================================
-- life_stage: 'single' | 'dating' | 'married' | 'ttc' | 'pregnant' | 'postpartum' | 'perimenopausal' | 'unspecified'
-- cycle_regularity: 'regular' | 'irregular' | 'menopausal' | 'unknown'
-- medical_conditions: e.g. ARRAY['PCOS','甲减','子宫内膜异位症']
-- focus_areas: e.g. ARRAY['情绪管理','周期理解','备孕']
-- =============================================================================
ALTER TABLE public.hormone_profiles
  ADD COLUMN IF NOT EXISTS life_stage text;

ALTER TABLE public.hormone_profiles
  ADD COLUMN IF NOT EXISTS cycle_regularity text;

ALTER TABLE public.hormone_profiles
  ADD COLUMN IF NOT EXISTS medical_conditions text[];

ALTER TABLE public.hormone_profiles
  ADD COLUMN IF NOT EXISTS focus_areas text[];

ALTER TABLE public.hormone_profiles
  ADD COLUMN IF NOT EXISTS ai_companion_name text;

ALTER TABLE public.hormone_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.hormone_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.hormone_profiles.life_stage IS 'Life stage: single | dating | married | ttc | pregnant | postpartum | perimenopausal | unspecified';
COMMENT ON COLUMN public.hormone_profiles.cycle_regularity IS 'Cycle regularity: regular | irregular | menopausal | unknown';
COMMENT ON COLUMN public.hormone_profiles.medical_conditions IS 'Diagnosed conditions (array), e.g. PCOS, hypothyroidism.';
COMMENT ON COLUMN public.hormone_profiles.focus_areas IS 'Areas user wants support with (array).';
COMMENT ON COLUMN public.hormone_profiles.ai_companion_name IS 'User-chosen name for the AI companion.';
COMMENT ON COLUMN public.hormone_profiles.onboarding_completed IS 'Whether onboarding questionnaire/wizard is complete.';
COMMENT ON COLUMN public.hormone_profiles.onboarding_completed_at IS 'When onboarding was marked complete.';

-- =============================================================================
-- A-4. chat_sessions — session kind (chat vs onboarding vs proactive)
-- =============================================================================
-- session_type: 'chat' | 'onboarding' | 'proactive'
-- =============================================================================
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'chat';

COMMENT ON COLUMN public.chat_sessions.session_type IS 'chat | onboarding | proactive';

-- =============================================================================
-- A-5. daily_states — "今天的你" daily card (one row per user per calendar day)
-- =============================================================================
-- cycle_day: day index from period start (day 1 = first bleeding day)
-- cycle_phase: menstrual | follicular | ovulation | luteal
-- energy_prediction: AI predicted energy 1-5
-- state_text: poetic summary for home screen (<= ~50 chars recommended)
-- viewed_at: first time user opened home and saw this card (open-rate analytics)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.daily_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  cycle_day integer,
  cycle_phase text,
  energy_prediction integer,
  state_text text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  CONSTRAINT daily_states_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_states_user_date ON public.daily_states (user_id, date DESC);

COMMENT ON TABLE public.daily_states IS 'Daily "today you" card content; at most one row per user per calendar date.';
COMMENT ON COLUMN public.daily_states.cycle_day IS 'Cycle day from first day of menstruation.';
COMMENT ON COLUMN public.daily_states.cycle_phase IS 'menstrual | follicular | ovulation | luteal';
COMMENT ON COLUMN public.daily_states.energy_prediction IS 'Predicted energy level 1-5 for that day.';
COMMENT ON COLUMN public.daily_states.state_text IS 'Short poetic copy for the card.';
COMMENT ON COLUMN public.daily_states.viewed_at IS 'When user first viewed this card on home screen.';

-- =============================================================================
-- A-6. user_insights — versioned L1 user understanding (Second Me–style memory)
-- =============================================================================
-- insight_data example (JSON): cycle_characteristics, emotional_patterns,
-- communication_preferences, key_relationships, key_moments[], current_focus[],
-- health_summary, etc.
-- Only one row per user may have is_current = true (partial unique index).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  insight_data jsonb NOT NULL,
  data_sources_summary text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_insights_current ON public.user_insights (user_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_user_insights_user_version ON public.user_insights (user_id, version DESC);

COMMENT ON TABLE public.user_insights IS 'Weekly distilled structured understanding of the user; versioned (is_current marks active prompt injection row).';

-- =============================================================================
-- A-7. self_book_chapters — generative "book of self" chapters unlocked over time
-- =============================================================================
-- chapter_number: 1=Day7, 2=Day30, 3=Day90, 4=Day180, 5+=annual refresh
-- triggered_by: day_7 | day_30 | day_90 | day_180 | birthday | annual
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.self_book_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  chapter_number integer NOT NULL,
  chapter_title text NOT NULL,
  content text NOT NULL,
  triggered_by text NOT NULL,
  based_on_insight_version integer,
  generated_at timestamptz NOT NULL DEFAULT now(),
  is_unlocked boolean NOT NULL DEFAULT false,
  unlocked_at timestamptz,
  user_viewed_at timestamptz,
  CONSTRAINT self_book_chapters_user_chapter_unique UNIQUE (user_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_self_book_user ON public.self_book_chapters (user_id, chapter_number);

COMMENT ON TABLE public.self_book_chapters IS 'Narrative self-portrait chapters generated by AI over milestones.';
COMMENT ON COLUMN public.self_book_chapters.based_on_insight_version IS 'user_insights.version used when generating this chapter.';

-- =============================================================================
-- A-8. ai_proactive_log — outbound proactive care / nudges from AI
-- =============================================================================
-- trigger_type: silence_3days | low_energy_streak | pms_incoming | followup |
--               milestone_unlock | cycle_prediction
-- delivery_channel: in_app | push | email
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_proactive_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  trigger_context jsonb,
  message_content text NOT NULL,
  delivery_channel text NOT NULL DEFAULT 'in_app',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  user_responded boolean DEFAULT false,
  response_at timestamptz,
  linked_session_id uuid REFERENCES public.chat_sessions (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proactive_user_date ON public.ai_proactive_log (user_id, scheduled_for DESC);

COMMENT ON TABLE public.ai_proactive_log IS 'Each proactive outreach from AI to user and engagement outcomes.';
COMMENT ON COLUMN public.ai_proactive_log.linked_session_id IS 'If user replies in-app, link to the resulting chat session.';

-- =============================================================================
-- A-9. knowledge_base — RAG chunks + embeddings (OpenAI text-embedding-3-small: 1536 dims)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  category text NOT NULL,
  subcategory text,
  title text NOT NULL,
  content text NOT NULL,
  content_tokens integer,
  embedding vector (1536),
  reviewed_by text,
  reviewed_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_category ON public.knowledge_base (category, is_active);

CREATE INDEX IF NOT EXISTS idx_kb_embedding ON public.knowledge_base
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON TABLE public.knowledge_base IS 'Curated medical/educational passages for vector retrieval; not user-owned rows.';

-- =============================================================================
-- Row Level Security (new tables only)
-- =============================================================================

ALTER TABLE public.daily_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_book_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_proactive_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- daily_states
DROP POLICY IF EXISTS "daily_states_select_own" ON public.daily_states;
DROP POLICY IF EXISTS "daily_states_insert_own" ON public.daily_states;
DROP POLICY IF EXISTS "daily_states_update_own" ON public.daily_states;
DROP POLICY IF EXISTS "daily_states_delete_own" ON public.daily_states;

CREATE POLICY "daily_states_select_own" ON public.daily_states FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "daily_states_insert_own" ON public.daily_states FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_states_update_own" ON public.daily_states FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_states_delete_own" ON public.daily_states FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- user_insights
DROP POLICY IF EXISTS "user_insights_select_own" ON public.user_insights;
DROP POLICY IF EXISTS "user_insights_insert_own" ON public.user_insights;
DROP POLICY IF EXISTS "user_insights_update_own" ON public.user_insights;
DROP POLICY IF EXISTS "user_insights_delete_own" ON public.user_insights;

CREATE POLICY "user_insights_select_own" ON public.user_insights FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "user_insights_insert_own" ON public.user_insights FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_insights_update_own" ON public.user_insights FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_insights_delete_own" ON public.user_insights FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- self_book_chapters
DROP POLICY IF EXISTS "self_book_chapters_select_own" ON public.self_book_chapters;
DROP POLICY IF EXISTS "self_book_chapters_insert_own" ON public.self_book_chapters;
DROP POLICY IF EXISTS "self_book_chapters_update_own" ON public.self_book_chapters;
DROP POLICY IF EXISTS "self_book_chapters_delete_own" ON public.self_book_chapters;

CREATE POLICY "self_book_chapters_select_own" ON public.self_book_chapters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "self_book_chapters_insert_own" ON public.self_book_chapters FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "self_book_chapters_update_own" ON public.self_book_chapters FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "self_book_chapters_delete_own" ON public.self_book_chapters FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ai_proactive_log
DROP POLICY IF EXISTS "ai_proactive_log_select_own" ON public.ai_proactive_log;
DROP POLICY IF EXISTS "ai_proactive_log_insert_own" ON public.ai_proactive_log;
DROP POLICY IF EXISTS "ai_proactive_log_update_own" ON public.ai_proactive_log;
DROP POLICY IF EXISTS "ai_proactive_log_delete_own" ON public.ai_proactive_log;

CREATE POLICY "ai_proactive_log_select_own" ON public.ai_proactive_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "ai_proactive_log_insert_own" ON public.ai_proactive_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_proactive_log_update_own" ON public.ai_proactive_log FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_proactive_log_delete_own" ON public.ai_proactive_log FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- knowledge_base: all authenticated users may read active rows (no user writes via client)
DROP POLICY IF EXISTS "knowledge_base_select_active_authenticated" ON public.knowledge_base;

CREATE POLICY "knowledge_base_select_active_authenticated" ON public.knowledge_base FOR SELECT TO authenticated
  USING (coalesce(is_active, true));

-- Optional: service role / dashboard ingestion bypasses RLS; end-users typically do not INSERT.

-- =============================================================================
-- Validation: list public tables and column counts
-- =============================================================================
SELECT
  table_name,
  count(column_name) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
