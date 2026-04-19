-- 018_courses.sql
-- Self-paced, paid courses (separate from 1-on-1 lessons).
-- Course = ordered list of lessons with markdown + optional video/audio.
-- Users pay once, enroll, progress through lessons, earn XP on completion.

CREATE TABLE courses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    level           TEXT
                    CHECK (level IS NULL OR level IN (
                        'Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'
                    )),
    goal_tag        TEXT NOT NULL DEFAULT 'conversation'
                    CHECK (goal_tag IN ('work', 'relocation', 'conversation', 'exam', 'other')),
    duration_hours  NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (duration_hours >= 0),
    lesson_count    INT NOT NULL DEFAULT 0 CHECK (lesson_count >= 0),
    author_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
    cover_variant   TEXT NOT NULL DEFAULT 'red'
                    CHECK (cover_variant IN ('red', 'lime', 'dark', 'purple', 'cyan', 'gold')),
    cover_word      TEXT,                          -- big display word on the card ("meetings", "phrasal"...)
    price_kopecks   INT NOT NULL DEFAULT 0 CHECK (price_kopecks >= 0),
    xp_reward       INT NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
    required_level  TEXT
                    CHECK (required_level IS NULL OR required_level IN (
                        'Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'
                    )),
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    released_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_published ON courses(is_published, released_at DESC) WHERE is_published;
CREATE INDEX idx_courses_level     ON courses(level);
CREATE INDEX idx_courses_goal      ON courses(goal_tag);

DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- Lessons (ordered content blocks)
-- ==========================================================
CREATE TABLE course_lessons (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id          UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    position           INT NOT NULL CHECK (position > 0),
    title              TEXT NOT NULL,
    content_md         TEXT,                         -- markdown body
    video_url          TEXT,
    audio_url          TEXT,
    estimated_minutes  INT CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
    xp_reward          INT NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, position)
);

CREATE INDEX idx_course_lessons_course ON course_lessons(course_id, position);

DROP TRIGGER IF EXISTS trg_course_lessons_updated_at ON course_lessons;
CREATE TRIGGER trg_course_lessons_updated_at
    BEFORE UPDATE ON course_lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Keep courses.lesson_count in sync
CREATE OR REPLACE FUNCTION recalc_course_lesson_count() RETURNS TRIGGER AS $$
DECLARE
    v_course_id UUID;
BEGIN
    v_course_id := COALESCE(NEW.course_id, OLD.course_id);
    UPDATE courses
       SET lesson_count = (
           SELECT COUNT(*) FROM course_lessons WHERE course_id = v_course_id
       ),
       updated_at = now()
     WHERE id = v_course_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_course_lessons_count ON course_lessons;
CREATE TRIGGER trg_course_lessons_count
    AFTER INSERT OR DELETE ON course_lessons
    FOR EACH ROW
    EXECUTE FUNCTION recalc_course_lesson_count();

-- ==========================================================
-- Enrollments (paid access)
-- ==========================================================
CREATE TABLE course_enrollments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_id          UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    status             TEXT NOT NULL DEFAULT 'pending_payment'
                       CHECK (status IN (
                           'pending_payment', 'active', 'completed', 'refunded', 'revoked'
                       )),
    started_at         TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    current_lesson_id  UUID REFERENCES course_lessons(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, course_id)
);

CREATE INDEX idx_course_enrolls_user   ON course_enrollments(user_id, status);
CREATE INDEX idx_course_enrolls_course ON course_enrollments(course_id, status);

DROP TRIGGER IF EXISTS trg_course_enrollments_updated_at ON course_enrollments;
CREATE TRIGGER trg_course_enrollments_updated_at
    BEFORE UPDATE ON course_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- Per-lesson progress
-- ==========================================================
CREATE TABLE course_lesson_progress (
    user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    course_lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    time_spent_sec   INT,
    PRIMARY KEY (user_id, course_lesson_id)
);

CREATE INDEX idx_course_lesson_prog_user_course ON course_lesson_progress(user_id, course_id);

-- ==========================================================
-- Course payments (YooKassa, analogous to club_payments)
-- ==========================================================
CREATE TABLE course_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id       UUID NOT NULL UNIQUE REFERENCES course_enrollments(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    yookassa_payment_id TEXT UNIQUE,
    amount_kopecks      INT NOT NULL CHECK (amount_kopecks >= 0),
    currency            TEXT NOT NULL DEFAULT 'RUB',
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending', 'waiting_for_capture', 'succeeded',
                            'cancelled', 'refunded'
                        )),
    paid_at             TIMESTAMPTZ,
    refunded_at         TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_payments_user   ON course_payments(user_id);
CREATE INDEX idx_course_payments_status ON course_payments(status);
CREATE INDEX idx_course_payments_yk     ON course_payments(yookassa_payment_id)
    WHERE yookassa_payment_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_course_payments_updated_at ON course_payments;
CREATE TRIGGER trg_course_payments_updated_at
    BEFORE UPDATE ON course_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- RLS
-- ==========================================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_select_published_or_staff"
    ON courses FOR SELECT
    USING (
        is_published = TRUE
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
        OR auth.uid() = author_id
    );

CREATE POLICY "courses_admin_write"
    ON courses FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;

-- Lessons readable only by enrolled users (or staff). Prevents content theft.
CREATE POLICY "course_lessons_select_enrolled_or_staff"
    ON course_lessons FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM course_enrollments e
             WHERE e.course_id = course_lessons.course_id
               AND e.user_id   = auth.uid()
               AND e.status IN ('active', 'completed')
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

CREATE POLICY "course_lessons_admin_write"
    ON course_lessons FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_enrolls_select_own_or_staff"
    ON course_enrollments FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

CREATE POLICY "course_enrolls_insert_own"
    ON course_enrollments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "course_enrolls_update_own_or_staff"
    ON course_enrollments FOR UPDATE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

ALTER TABLE course_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_lesson_prog_select_own_or_staff"
    ON course_lesson_progress FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

CREATE POLICY "course_lesson_prog_insert_own"
    ON course_lesson_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

ALTER TABLE course_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_payments_select_own_or_staff"
    ON course_payments FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

CREATE POLICY "course_payments_admin_write"
    ON course_payments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );
