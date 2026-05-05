-- 054_lessons_insert_teacher_allowed.sql
-- ============================================================
-- Расширяем lessons_insert на учителя и админа.
--
-- До этого политика lessons_insert_student разрешала INSERT только
-- студенту, который сам становится student_id. Эндпоинт
-- /api/booking/teacher-create (учитель назначает урок ученику)
-- падал с 42501 row-level security violation, потому что INSERT
-- идёт от user-context'а учителя.
--
-- Новая политика lessons_insert_participant пускает:
--   • студента, если student_id = auth.uid()
--   • учителя, если teacher_id = get_teacher_profile_id()
--   • админа без ограничений
-- ============================================================

DROP POLICY IF EXISTS "lessons_insert_student" ON lessons;

CREATE POLICY "lessons_insert_participant"
    ON lessons FOR INSERT
    WITH CHECK (
        student_id = auth.uid()
        OR teacher_id = get_teacher_profile_id()
        OR get_user_role() = 'admin'
    );
