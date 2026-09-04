-- ==========================================================
-- 20260901030000 · student_shared_notes
-- ==========================================================
-- «Об ученике» — короткая заметка, общая для всех учителей.
-- Пример из дизайна: «Интересуется баснями и поэзией».
-- Одна строка на ученика; любой teacher/admin может UPSERT-ить,
-- перезаписывая предыдущую (тред-историю не ведём — простая замена).
-- Тэг «кто последний менял» + timestamp — для UI (авторство).
-- ==========================================================

CREATE TABLE IF NOT EXISTS student_shared_notes (
    student_id   UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    content      TEXT NOT NULL CHECK (char_length(content) <= 500),
    updated_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_shared_notes_updated_by
    ON student_shared_notes(updated_by);

ALTER TABLE student_shared_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: teacher/admin — все; сам student — свою.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='student_shared_notes' AND policyname='ssn_select_teacher_or_own'
    ) THEN
        CREATE POLICY ssn_select_teacher_or_own ON student_shared_notes
            FOR SELECT
            USING (
                auth.uid() = student_id
                OR EXISTS (
                    SELECT 1 FROM profiles p
                     WHERE p.id = auth.uid()
                       AND p.role IN ('teacher','admin')
                )
            );
    END IF;
END $$;

-- INSERT/UPDATE: только teacher/admin, при условии что updated_by = auth.uid().
-- (Дополнительный owner-check «это мой ученик» делаем на app-уровне в API.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='student_shared_notes' AND policyname='ssn_write_teacher_admin'
    ) THEN
        CREATE POLICY ssn_write_teacher_admin ON student_shared_notes
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles p
                     WHERE p.id = auth.uid()
                       AND p.role IN ('teacher','admin')
                )
            )
            WITH CHECK (
                updated_by = auth.uid()
                AND EXISTS (
                    SELECT 1 FROM profiles p
                     WHERE p.id = auth.uid()
                       AND p.role IN ('teacher','admin')
                )
            );
    END IF;
END $$;
