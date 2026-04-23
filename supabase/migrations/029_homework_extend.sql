-- 029_homework_extend.sql
-- Extends `homework` table with fields required by the teacher/student
-- homework UI: submission timing, review timing, reminders, attachments,
-- and a 0..10 decimal score (prototype shows "9/10", "8.5/10").
--
-- The existing `grade integer (0..100)` constraint is preserved for backward
-- compatibility, but a new `score_10 NUMERIC(3,1)` column is used by the UI
-- going forward. Either column may be populated; UI prefers `score_10`.

BEGIN;

-- 1. Timing
ALTER TABLE homework
  ADD COLUMN IF NOT EXISTS submitted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reminded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminders_count    INT NOT NULL DEFAULT 0;

-- 2. Attachments (jsonb array of { name, url, size?, mime? })
ALTER TABLE homework
  ADD COLUMN IF NOT EXISTS attachments        JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. 0..10 decimal score (prototype uses this scale)
ALTER TABLE homework
  ADD COLUMN IF NOT EXISTS score_10           NUMERIC(3,1)
    CHECK (score_10 IS NULL OR (score_10 >= 0 AND score_10 <= 10));

-- 4. Helpful indexes for list filtering / sorting
CREATE INDEX IF NOT EXISTS idx_homework_due_date    ON homework(due_date);
CREATE INDEX IF NOT EXISTS idx_homework_submitted_at ON homework(submitted_at)
  WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_homework_status_teacher
  ON homework(teacher_id, status);

-- 5. Keep RLS as-is (defined in 20260410_add_homework_progress_calendar.sql):
--    - Students view/update own
--    - Teachers view/create/update assigned (teacher_id = auth.uid())
--    The new columns inherit the same row-level policies automatically.

COMMIT;
