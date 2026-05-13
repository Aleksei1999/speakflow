-- ==========================================================
-- 065 · attempts cap для lesson_transcripts
-- ==========================================================
-- Без cap cron каждые 5 мин пытается транскрибировать те же чанки
-- → жжёт OpenAI quota бесконечно если контейнер реально невалидный.
-- Cap = 5 попыток, потом считаем endpoint мёртвым.

ALTER TABLE public.lesson_transcripts
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 1;
