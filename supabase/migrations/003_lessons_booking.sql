-- 003_lessons_booking.sql
-- Lesson scheduling, booking, and slot availability

CREATE TABLE lessons (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    teacher_id          UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT,
    scheduled_at        TIMESTAMPTZ NOT NULL,
    duration_minutes    INT NOT NULL DEFAULT 50,
    status              TEXT NOT NULL DEFAULT 'pending_payment'
                        CHECK (status IN (
                            'pending_payment',
                            'booked',
                            'in_progress',
                            'completed',
                            'cancelled',
                            'no_show'
                        )),
    jitsi_room_name     TEXT,
    price               INT NOT NULL,               -- kopecks
    cancelled_by        UUID REFERENCES profiles(id),
    cancellation_reason TEXT,
    teacher_notes       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lessons_student_id ON lessons(student_id);
CREATE INDEX idx_lessons_teacher_id ON lessons(teacher_id);
CREATE INDEX idx_lessons_scheduled_at ON lessons(scheduled_at);
CREATE INDEX idx_lessons_status ON lessons(status);
CREATE INDEX idx_lessons_upcoming
    ON lessons(teacher_id, scheduled_at)
    WHERE status IN ('booked', 'in_progress');

CREATE TRIGGER trg_lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check if a teacher slot is available (no overlapping booked/in_progress lessons)
CREATE OR REPLACE FUNCTION is_slot_available(
    p_teacher_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_duration INT DEFAULT 50
)
RETURNS BOOLEAN AS $$
DECLARE
    v_conflict_count INT;
BEGIN
    SELECT COUNT(*) INTO v_conflict_count
    FROM lessons
    WHERE teacher_id = p_teacher_id
      AND status IN ('booked', 'in_progress', 'pending_payment')
      AND scheduled_at < p_scheduled_at + (p_duration || ' minutes')::INTERVAL
      AND p_scheduled_at < scheduled_at + (duration_minutes || ' minutes')::INTERVAL;

    RETURN v_conflict_count = 0;
END;
$$ LANGUAGE plpgsql STABLE;
