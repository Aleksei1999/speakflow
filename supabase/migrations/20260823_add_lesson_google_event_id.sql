-- ==========================================================
-- 20260823 · lessons.google_event_id
-- ==========================================================
-- Хранит id события в Google Calendar, созданного через
-- pushEventToGoogle() при инсерте урока в `lessons`.
-- Нужен для того, чтобы при отмене (cancelLesson) можно было
-- параллельно удалить событие в Google (DELETE /calendars/primary/events/{id}).
--
-- Поле nullable: если пользователь не подключил Google Calendar,
-- или push упал fail-soft — просто NULL.

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Индекс: чтобы, если понадобится найти урок по event-id
-- (например, обратная синхронизация из webhook'а Google), лукап был
-- не seq-scan. Sparse: подавляющее большинство строк пока NULL.
CREATE INDEX IF NOT EXISTS lessons_google_event_id_idx
    ON lessons (google_event_id)
    WHERE google_event_id IS NOT NULL;

COMMENT ON COLUMN lessons.google_event_id IS
    'ID события в Google Calendar (calendars/primary/events/{id}). '
    'Заполняется при createLesson если у учителя подключён Google. '
    'При cancelLesson параллельно удаляется событие в Google.';
