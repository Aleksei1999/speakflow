-- Явный лок для крона `transcribe-recordings`: колонка `locked_at`.
-- Раньше cron выбирал первую finalized-запись без транскрипта и сразу
-- начинал транскрибировать. Если через 5 мин запускался второй тик, а
-- предыдущий ещё не закончил — обе попытки транскрибировали одну и ту же
-- запись, сжигая OpenAI-токены и порождая дубли в `lesson_transcripts`.
--
-- Захват: `UPDATE lesson_recordings SET locked_at=NOW()
--          WHERE id=$1 AND status='finalized'
--            AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '15 min')
--          RETURNING id`.
-- Если 0 строк — кто-то уже захватил, worker пропускает.
-- 15-минутный recovery-window: если процесс упал, следующий тик подхватит.

ALTER TABLE public.lesson_recordings
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- Partial-index: только по активным лок'ам — быстрый lookup «истёкших».
CREATE INDEX IF NOT EXISTS lesson_recordings_locked_at_idx
  ON public.lesson_recordings (locked_at)
  WHERE locked_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- Аналогичный лок для крона `summarize-transcripts`.
-- Между SELECT и INSERT (генерация OpenAI 5-15 сек) параллельный тик
-- мог выбрать тот же transcript и тоже начать генерацию → двойной вызов
-- модели + дубль в `lesson_summaries`.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.lesson_transcripts
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

CREATE INDEX IF NOT EXISTS lesson_transcripts_locked_at_idx
  ON public.lesson_transcripts (locked_at)
  WHERE locked_at IS NOT NULL;

-- Safety-net: даже если lock-логика пропустит, БД не даст создать
-- два recording-summary на один урок. Manual-summary (source='manual')
-- под ограничение не попадают.
CREATE UNIQUE INDEX IF NOT EXISTS lesson_summaries_recording_unique
  ON public.lesson_summaries (lesson_id)
  WHERE source = 'recording';
