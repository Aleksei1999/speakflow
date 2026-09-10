-- ---------------------------------------------------------------------------
-- Саммари урока из двух источников: заметки учителя (source='manual') и
-- транскрипт записи LiveKit (source='recording'). Старый UNIQUE(lesson_id)
-- из 007 позволял только одну строку на урок — первая созданная блокировала
-- вторую. Снимаем его; уникальность — по (lesson_id, source).
-- Применять в Supabase SQL Editor.
-- ---------------------------------------------------------------------------
ALTER TABLE public.lesson_summaries DROP CONSTRAINT IF EXISTS lesson_summaries_lesson_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS lesson_summaries_manual_unique
  ON public.lesson_summaries (lesson_id) WHERE source = 'manual';
-- lesson_summaries_recording_unique (20260904200000) уже есть.
