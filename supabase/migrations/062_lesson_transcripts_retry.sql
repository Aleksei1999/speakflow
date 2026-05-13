-- ==========================================================
-- 062 · CRIT fix: lesson_transcripts должен поддерживать retry
-- ==========================================================
-- Миграция 058 поставила UNIQUE на lesson_transcripts.lesson_id.
-- Как только cron вставил failed-row для урока, повторная попытка
-- через 5 мин падала на duplicate key (или фильтр done.has(c.id)
-- исключал recording навсегда). Урок навсегда без саммари.
--
-- Решение: убрать UNIQUE на lesson_id, поставить partial unique
-- WHERE status='ok' — только один УСПЕШНЫЙ транскрипт на урок,
-- failed может быть сколько угодно. Cron в transcribe-recordings
-- теперь фильтрует по status='ok', failed получит retry.
--
-- Очищаем висящие failed-rows одним движением — после деплоя
-- pipeline возьмёт записи в работу заново.

BEGIN;

ALTER TABLE public.lesson_transcripts
  DROP CONSTRAINT IF EXISTS lesson_transcripts_lesson_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS lesson_transcripts_lesson_id_ok_idx
  ON public.lesson_transcripts (lesson_id)
  WHERE status = 'ok';

DELETE FROM public.lesson_transcripts WHERE status = 'failed';

COMMIT;
