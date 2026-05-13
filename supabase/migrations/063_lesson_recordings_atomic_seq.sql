-- ==========================================================
-- 063 · HIGH: atomic seq per role в lesson_recordings
-- ==========================================================
-- Раньше seq приходил с клиента в /api/lesson/recording/chunk-url.
-- Студент мог послать seq=99999 или повторить teacher'ский seq и
-- затереть его chunk через upsert:true. Делаем seq серверной
-- ответственностью: атомарный UPDATE с RETURNING на колонке
-- next_seq_t / next_seq_s в lesson_recordings.

ALTER TABLE public.lesson_recordings
  ADD COLUMN IF NOT EXISTS next_seq_t int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_seq_s int NOT NULL DEFAULT 0;
