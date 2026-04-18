-- 20260418_trial_lesson_requests.sql
-- Queue of students awaiting a free trial lesson after signup.

CREATE TABLE IF NOT EXISTS trial_lesson_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    level_test_id   UUID REFERENCES level_tests(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'assigned', 'scheduled', 'completed', 'cancelled')),
    assigned_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_lesson_id  UUID REFERENCES lessons(id)  ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_requests_user
    ON trial_lesson_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_requests_status
    ON trial_lesson_requests(status, created_at DESC);

DROP TRIGGER IF EXISTS trg_trial_requests_updated_at ON trial_lesson_requests;
CREATE TRIGGER trg_trial_requests_updated_at
    BEFORE UPDATE ON trial_lesson_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE trial_lesson_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_requests_select_own_or_admin" ON trial_lesson_requests;
CREATE POLICY "trial_requests_select_own_or_admin"
    ON trial_lesson_requests FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

DROP POLICY IF EXISTS "trial_requests_insert_own" ON trial_lesson_requests;
CREATE POLICY "trial_requests_insert_own"
    ON trial_lesson_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "trial_requests_update_admin" ON trial_lesson_requests;
CREATE POLICY "trial_requests_update_admin"
    ON trial_lesson_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );
