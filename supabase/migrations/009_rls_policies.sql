-- 009_rls_policies.sql
-- Row Level Security policies for all tables

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get current user's teacher_profile id
CREATE OR REPLACE FUNCTION get_teacher_profile_id()
RETURNS UUID AS $$
    SELECT id FROM teacher_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- profiles
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================================
-- teacher_profiles
-- ============================================================
ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_profiles_select_all"
    ON teacher_profiles FOR SELECT
    USING (true);

CREATE POLICY "teacher_profiles_update_own"
    ON teacher_profiles FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================================
-- teacher_availability
-- ============================================================
ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_availability_select_all"
    ON teacher_availability FOR SELECT
    USING (true);

CREATE POLICY "teacher_availability_insert_own"
    ON teacher_availability FOR INSERT
    WITH CHECK (teacher_id = get_teacher_profile_id());

CREATE POLICY "teacher_availability_update_own"
    ON teacher_availability FOR UPDATE
    USING (teacher_id = get_teacher_profile_id())
    WITH CHECK (teacher_id = get_teacher_profile_id());

CREATE POLICY "teacher_availability_delete_own"
    ON teacher_availability FOR DELETE
    USING (teacher_id = get_teacher_profile_id());

-- ============================================================
-- lessons
-- ============================================================
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lessons_select_own_or_admin"
    ON lessons FOR SELECT
    USING (
        student_id = auth.uid()
        OR teacher_id = get_teacher_profile_id()
        OR get_user_role() = 'admin'
    );

CREATE POLICY "lessons_insert_student"
    ON lessons FOR INSERT
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "lessons_update_participant_or_admin"
    ON lessons FOR UPDATE
    USING (
        student_id = auth.uid()
        OR teacher_id = get_teacher_profile_id()
        OR get_user_role() = 'admin'
    )
    WITH CHECK (
        student_id = auth.uid()
        OR teacher_id = get_teacher_profile_id()
        OR get_user_role() = 'admin'
    );

-- ============================================================
-- payments
-- ============================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_own_or_admin"
    ON payments FOR SELECT
    USING (
        student_id = auth.uid()
        OR get_user_role() = 'admin'
    );

-- ============================================================
-- teacher_earnings
-- ============================================================
ALTER TABLE teacher_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_earnings_select_own_or_admin"
    ON teacher_earnings FOR SELECT
    USING (
        teacher_id = get_teacher_profile_id()
        OR get_user_role() = 'admin'
    );

-- ============================================================
-- notifications
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================================
-- achievement_definitions
-- ============================================================
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievement_definitions_select_all"
    ON achievement_definitions FOR SELECT
    USING (true);

-- ============================================================
-- user_achievements
-- ============================================================
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_achievements_select_all"
    ON user_achievements FOR SELECT
    USING (true);

-- ============================================================
-- user_progress
-- ============================================================
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_progress_select_all"
    ON user_progress FOR SELECT
    USING (true);

-- ============================================================
-- lesson_summaries
-- ============================================================
ALTER TABLE lesson_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_summaries_select_participant"
    ON lesson_summaries FOR SELECT
    USING (
        student_id = auth.uid()
        OR teacher_id = get_teacher_profile_id()
        OR get_user_role() = 'admin'
    );

-- ============================================================
-- reviews
-- ============================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_all"
    ON reviews FOR SELECT
    USING (true);

CREATE POLICY "reviews_insert_student_of_lesson"
    ON reviews FOR INSERT
    WITH CHECK (
        student_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM lessons
            WHERE lessons.id = lesson_id
              AND lessons.student_id = auth.uid()
              AND lessons.status = 'completed'
        )
    );

-- ============================================================
-- level_tests
-- ============================================================
ALTER TABLE level_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "level_tests_select_own_or_anon"
    ON level_tests FOR SELECT
    USING (
        user_id = auth.uid()
        OR user_id IS NULL
    );

CREATE POLICY "level_tests_insert_own_or_anon"
    ON level_tests FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR user_id IS NULL
    );

-- ============================================================
-- materials
-- ============================================================
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materials_select_public_or_participant"
    ON materials FOR SELECT
    USING (
        is_public = true
        OR teacher_id = get_teacher_profile_id()
        OR get_user_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM lessons
            WHERE lessons.id = materials.lesson_id
              AND lessons.student_id = auth.uid()
        )
    );

CREATE POLICY "materials_insert_own_teacher"
    ON materials FOR INSERT
    WITH CHECK (teacher_id = get_teacher_profile_id());

CREATE POLICY "materials_update_own_teacher"
    ON materials FOR UPDATE
    USING (teacher_id = get_teacher_profile_id())
    WITH CHECK (teacher_id = get_teacher_profile_id());

CREATE POLICY "materials_delete_own_teacher"
    ON materials FOR DELETE
    USING (teacher_id = get_teacher_profile_id());
