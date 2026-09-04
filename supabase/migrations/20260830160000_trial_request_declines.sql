-- ==========================================================
-- 20260830 · trial_request_declines
-- ==========================================================
-- Учитель может «отклонить» заявку на пробный урок — она пропадёт из
-- его дашборда, но останется pending для других учителей.
-- Ключ (teacher_id, request_id) — teacher_id это teacher_profiles.id.

CREATE TABLE IF NOT EXISTS trial_request_declines (
    teacher_id  UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    request_id  UUID NOT NULL REFERENCES trial_lesson_requests(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (teacher_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_trial_request_declines_teacher
    ON trial_request_declines (teacher_id);

ALTER TABLE trial_request_declines ENABLE ROW LEVEL SECURITY;

-- Учитель видит свои own declines; админ видит все.
DROP POLICY IF EXISTS "trial_declines_select_own" ON trial_request_declines;
CREATE POLICY "trial_declines_select_own"
    ON trial_request_declines FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM teacher_profiles tp
             WHERE tp.id = trial_request_declines.teacher_id
               AND tp.user_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

DROP POLICY IF EXISTS "trial_declines_insert_own" ON trial_request_declines;
CREATE POLICY "trial_declines_insert_own"
    ON trial_request_declines FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM teacher_profiles tp
             WHERE tp.id = trial_request_declines.teacher_id
               AND tp.user_id = auth.uid()
        )
    );

COMMENT ON TABLE trial_request_declines IS
    'Отметка «отклонил заявку» — учитель N не хочет брать trial-request R. '
    'Дашборд учителя фильтрует такие заявки из своего списка.';
