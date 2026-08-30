-- ==========================================================
-- 20260823 · lesson_requests
-- ==========================================================
-- «Запрос на урок» — студент отправляет учителю пожелание урока
-- в конкретное время. Учитель видит очередь запросов в дашборде
-- и принимает / отклоняет. При acceptLessonRequest создаётся строка
-- в `lessons` (см. src/app/(teacher-full)/teacher/request-actions.ts).
--
-- Отделено от `trial_lesson_requests`, потому что:
--   • trial_lesson_requests — очередь бесплатных пробников после
--     регистрации, назначает админ;
--   • lesson_requests    — обычные запросы от существующих учеников
--     конкретному учителю, обрабатывает сам учитель.
--
-- FK teacher_id ссылается на teacher_profiles.id (а не profiles.id) —
-- симметрично lessons.teacher_id, чтобы reuse createLesson-логики.

CREATE TABLE IF NOT EXISTS lesson_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    requested_at    TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    message         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sparse-friendly композитный индекс: почти всегда query — «pending для
-- teacher X, отсортированные по requested_at ASC». Учитель редко
-- смотрит accepted/rejected список.
CREATE INDEX IF NOT EXISTS idx_lesson_requests_teacher_status
    ON lesson_requests (teacher_id, status, requested_at ASC);

-- Часто нужно показать студенту его запросы («мои запросы»).
CREATE INDEX IF NOT EXISTS idx_lesson_requests_student
    ON lesson_requests (student_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_lesson_requests_updated_at ON lesson_requests;
CREATE TRIGGER trg_lesson_requests_updated_at
    BEFORE UPDATE ON lesson_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ---------- RLS ----------
ALTER TABLE lesson_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: студент видит свои запросы; учитель — запросы адресованные ему
-- (teacher_id = teacher_profiles.id, где teacher_profiles.user_id = auth.uid()).
-- Админ видит всё.
DROP POLICY IF EXISTS "lesson_requests_select_own_or_teacher" ON lesson_requests;
CREATE POLICY "lesson_requests_select_own_or_teacher"
    ON lesson_requests FOR SELECT
    USING (
        auth.uid() = student_id
        OR EXISTS (
            SELECT 1 FROM teacher_profiles tp
             WHERE tp.id = lesson_requests.teacher_id
               AND tp.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

-- INSERT: только сам студент может создать запрос от своего имени.
-- Дополнительно проверяем, что student_id принадлежит роли 'student'
-- (защита от учителя, посылающего сам себе).
DROP POLICY IF EXISTS "lesson_requests_insert_own" ON lesson_requests;
CREATE POLICY "lesson_requests_insert_own"
    ON lesson_requests FOR INSERT
    WITH CHECK (
        auth.uid() = student_id
        AND EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'student'
        )
    );

-- UPDATE:
--   • учитель может менять статус запросов, адресованных ему
--     (pending → accepted / rejected);
--   • студент может отменить собственный запрос (pending → cancelled)
--     — с check-условием status='cancelled' проще на app-уровне;
--   • админ может всё.
DROP POLICY IF EXISTS "lesson_requests_update_teacher_or_student" ON lesson_requests;
CREATE POLICY "lesson_requests_update_teacher_or_student"
    ON lesson_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM teacher_profiles tp
             WHERE tp.id = lesson_requests.teacher_id
               AND tp.user_id = auth.uid()
        )
        OR auth.uid() = student_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

COMMENT ON TABLE lesson_requests IS
    'Запросы на урок от студентов конкретному учителю. Учитель принимает '
    '(создаётся lessons-строка) или отклоняет. См. request-actions.ts.';
