-- ==========================================================
-- 058 · Phase 1.3 — Lesson transcripts
-- ==========================================================
-- Cron-pipeline берёт finalized lesson_recordings, прогоняет аудио
-- через OpenAI gpt-4o-transcribe (одна дорожка на роль) и складывает
-- сшитый текст в lesson_transcripts. Следующий шаг (миграция 059)
-- — генерация конспекта+квиза из этого транскрипта.

BEGIN;

-- ----------------------------------------------------------
-- 1. Таблица lesson_transcripts
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_transcripts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  recording_id    uuid NOT NULL REFERENCES public.lesson_recordings(id) ON DELETE CASCADE,
  -- Сшитый диалог: "Teacher: ...\nStudent: ...". Используется как
  -- основной input для GPT-саммари.
  full_text       text NOT NULL,
  -- Сегменты по ролям: [{role:'teacher'|'student', text:'...'}].
  -- gpt-4o-transcribe не отдаёт точных таймкодов, поэтому в MVP
  -- сегменты соответствуют дорожкам целиком.
  segments        jsonb NOT NULL DEFAULT '[]'::jsonb,
  language        text NOT NULL DEFAULT 'mixed',
  model           text NOT NULL DEFAULT 'gpt-4o-transcribe',
  duration_sec    int,
  prompt_tokens   int,
  -- При ошибке транскрипции сохраняем причину и оставляем строку,
  -- чтобы cron не зацикливался на ней.
  status          text NOT NULL DEFAULT 'ok'
                  CHECK (status IN ('ok','failed')),
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_transcripts_recording_idx
  ON public.lesson_transcripts (recording_id);
CREATE INDEX IF NOT EXISTS lesson_transcripts_status_idx
  ON public.lesson_transcripts (status, created_at);

ALTER TABLE public.lesson_transcripts ENABLE ROW LEVEL SECURITY;

-- SELECT для участников урока + админов через стандартный helper.
DROP POLICY IF EXISTS "lesson_transcripts_select_participant" ON public.lesson_transcripts;
CREATE POLICY "lesson_transcripts_select_participant"
  ON public.lesson_transcripts FOR SELECT
  TO authenticated
  USING (public.is_lesson_participant(lesson_id));

-- INSERT/UPDATE/DELETE — только service_role (cron-pipeline).

-- ----------------------------------------------------------
-- 2. Расширение lesson_summaries
-- ----------------------------------------------------------
-- Делаем таблицу совместимой с двумя источниками: ручной ввод
-- преподавателя (старый /api/ai/summary) и автоматическая генерация
-- из транскрипта (миграция 059, /api/internal/cron/summarize-...).
ALTER TABLE public.lesson_summaries
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','recording')),
  ADD COLUMN IF NOT EXISTS recording_id uuid REFERENCES public.lesson_recordings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transcript_id uuid REFERENCES public.lesson_transcripts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lesson_summaries_transcript_idx
  ON public.lesson_summaries (transcript_id);
CREATE INDEX IF NOT EXISTS lesson_summaries_source_idx
  ON public.lesson_summaries (source);

-- ----------------------------------------------------------
-- 3. pg_cron: дёргать /api/internal/cron/transcribe-recordings
-- ----------------------------------------------------------
-- pg_cron уже включён в миграции 020, pg_net — в 038. cron_secret
-- лежит в Supabase Vault (см. 038 для инструкций по rotation).

DO $$
DECLARE jid int;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'ai_transcribe_recordings' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'ai_transcribe_recordings',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://raw-english.com/api/internal/cron/transcribe-recordings',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
            FROM vault.decrypted_secrets
           WHERE name = 'cron_secret'
           LIMIT 1
        )
      ),
      -- Транскрипция 1 урока может занять до ~3 мин (50 мин аудио /
      -- 20x real-time). pg_net не блокирует ответ — функция отдаст
      -- 202 сразу. Таймаут просто гарантирует что HTTP-соединение
      -- закроется если endpoint завис.
      timeout_milliseconds := 300000
    );
  $cron$
);

COMMIT;
