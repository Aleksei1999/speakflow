-- ==========================================================
-- 20260830 · lectures + lecture_registrations
-- ==========================================================
-- «Лекторий» — публичные лекции/события платформы. Ученик выбирает
-- из списка в модалке «Добавить новый урок» → «Записаться на урок»
-- либо на конкретную лекцию.
--
-- Модель:
--   lectures                — событие с датой/описанием/спикером
--   lecture_registrations   — запись ученика на событие
--
-- Лекции создаёт admin (пока без UI — вручную через SQL / Studio).
-- RLS: SELECT публичный (все published видят); INSERT/UPDATE/DELETE
-- только admin. Regs — свои для ученика, все для admin.

CREATE TABLE IF NOT EXISTS lectures (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title            TEXT NOT NULL,
    description      TEXT,
    host_name        TEXT,
    scheduled_at     TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    cover_url        TEXT,
    tag              TEXT,
    capacity         INTEGER,
    is_published     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lectures_published_scheduled
    ON lectures (is_published, scheduled_at ASC);

DROP TRIGGER IF EXISTS trg_lectures_updated_at ON lectures;
CREATE TRIGGER trg_lectures_updated_at
    BEFORE UPDATE ON lectures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS lecture_registrations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id   UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    student_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (lecture_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_lecture_regs_student
    ON lecture_registrations (student_id, created_at DESC);

-- ---------- RLS: lectures ----------
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lectures_select_published" ON lectures;
CREATE POLICY "lectures_select_published"
    ON lectures FOR SELECT
    USING (
        is_published = TRUE
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "lectures_admin_write" ON lectures;
CREATE POLICY "lectures_admin_write"
    ON lectures FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

-- ---------- RLS: lecture_registrations ----------
ALTER TABLE lecture_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecture_regs_select_own_or_admin" ON lecture_registrations;
CREATE POLICY "lecture_regs_select_own_or_admin"
    ON lecture_registrations FOR SELECT
    USING (
        auth.uid() = student_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "lecture_regs_insert_own" ON lecture_registrations;
CREATE POLICY "lecture_regs_insert_own"
    ON lecture_registrations FOR INSERT
    WITH CHECK (
        auth.uid() = student_id
        AND EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'student'
        )
    );

DROP POLICY IF EXISTS "lecture_regs_delete_own_or_admin" ON lecture_registrations;
CREATE POLICY "lecture_regs_delete_own_or_admin"
    ON lecture_registrations FOR DELETE
    USING (
        auth.uid() = student_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

COMMENT ON TABLE lectures IS
    'Публичные лекции/события платформы (лекторий). Ученики регистрируются '
    'через lecture_registrations. Создаёт admin.';

COMMENT ON TABLE lecture_registrations IS
    'Регистрация ученика на лекцию. UNIQUE(lecture_id, student_id) исключает '
    'дубль-регистрацию.';
