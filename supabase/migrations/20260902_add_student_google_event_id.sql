-- ==========================================================
-- 20260902 · lessons.student_google_event_id
-- ==========================================================
-- Хранит id события в Google Calendar ученика, созданного через
-- pushEventToGoogle() из /api/booking/create когда у ученика привязан
-- собственный Google Calendar (см. calendar-actions.ts).
--
-- Нужен для того, чтобы при отмене (booking/cancel) можно было
-- удалить событие и у ученика, а не только у учителя (google_event_id).
--
-- Поле nullable: если ученик не подключил Google Calendar
-- или push упал fail-soft — просто NULL.

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS student_google_event_id TEXT;

-- Индекс sparse: подавляющее большинство строк NULL.
CREATE INDEX IF NOT EXISTS lessons_student_google_event_id_idx
    ON lessons (student_google_event_id)
    WHERE student_google_event_id IS NOT NULL;

COMMENT ON COLUMN lessons.student_google_event_id IS
    'ID события в Google Calendar ученика (calendars/primary/events/{id}). '
    'Заполняется при createLesson если у ученика подключён Google Calendar. '
    'При cancelLesson параллельно удаляется событие в календаре ученика.';
