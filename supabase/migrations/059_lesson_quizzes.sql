-- ==========================================================
-- 059 · Phase 1.4 — Lesson quizzes + summarize cron
-- ==========================================================
-- Из lesson_transcripts GPT-4o собирает структурированный конспект
-- (lesson_summaries.source='recording') и прилагает мини-тест на
-- закрепление. Студент проходит тест → начисляется XP через award_xp.

BEGIN;

-- ----------------------------------------------------------
-- 1. Таблица lesson_quizzes
-- ----------------------------------------------------------
-- Одна викторина на summary. questions — массив объектов:
--   { q: text, choices: [text,...], correct_index: int,
--     explanation: text? }
CREATE TABLE IF NOT EXISTS public.lesson_quizzes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id      uuid NOT NULL UNIQUE REFERENCES public.lesson_summaries(id) ON DELETE CASCADE,
  lesson_id       uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  questions       jsonb NOT NULL,
  question_count  int  NOT NULL CHECK (question_count BETWEEN 1 AND 20),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_quizzes_lesson_idx
  ON public.lesson_quizzes (lesson_id);

ALTER TABLE public.lesson_quizzes ENABLE ROW LEVEL SECURITY;

-- SELECT — студент урока + админ. Препод тоже может видеть.
DROP POLICY IF EXISTS "lesson_quizzes_select_participant" ON public.lesson_quizzes;
CREATE POLICY "lesson_quizzes_select_participant"
  ON public.lesson_quizzes FOR SELECT
  TO authenticated
  USING (public.is_lesson_participant(lesson_id));

-- ----------------------------------------------------------
-- 2. Таблица lesson_quiz_attempts
-- ----------------------------------------------------------
-- Один attempt на (quiz, student). При сабмите /api/lesson/quiz/submit
-- пишем строку и зовём award_xp.
CREATE TABLE IF NOT EXISTS public.lesson_quiz_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES public.lesson_quizzes(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score           int  NOT NULL CHECK (score >= 0),
  total           int  NOT NULL CHECK (total > 0),
  -- [{question_index, chosen_index, correct}]
  answers         jsonb NOT NULL,
  xp_awarded      int  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id)
);

CREATE INDEX IF NOT EXISTS lesson_quiz_attempts_student_idx
  ON public.lesson_quiz_attempts (student_id);

ALTER TABLE public.lesson_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- SELECT — только сам студент свои попытки.
DROP POLICY IF EXISTS "lesson_quiz_attempts_select_self" ON public.lesson_quiz_attempts;
CREATE POLICY "lesson_quiz_attempts_select_self"
  ON public.lesson_quiz_attempts FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- INSERT — service_role only (через /api/lesson/quiz/submit после
-- проверки требований). Без INSERT policy = anon/authenticated не могут.

-- ----------------------------------------------------------
-- 3. pg_cron — /api/internal/cron/summarize-transcripts
-- ----------------------------------------------------------
DO $$
DECLARE jid int;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'ai_summarize_transcripts' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'ai_summarize_transcripts',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://raw-english.com/api/internal/cron/summarize-transcripts',
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
      timeout_milliseconds := 300000
    );
  $cron$
);

COMMIT;
