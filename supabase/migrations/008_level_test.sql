-- 008_level_test.sql
-- Placement tests and teacher materials

CREATE TABLE level_tests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    email           TEXT,
    answers         JSONB NOT NULL,
    score           INT NOT NULL,
    level           TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_level_tests_user_id ON level_tests(user_id)
    WHERE user_id IS NOT NULL;
CREATE INDEX idx_level_tests_email ON level_tests(email)
    WHERE email IS NOT NULL;

-- Teacher-uploaded lesson materials
CREATE TABLE materials (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    lesson_id   UUID REFERENCES lessons(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    description TEXT,
    file_url    TEXT NOT NULL,
    file_type   TEXT,
    file_size   INT,                -- bytes
    is_public   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_materials_teacher_id ON materials(teacher_id);
CREATE INDEX idx_materials_lesson_id ON materials(lesson_id)
    WHERE lesson_id IS NOT NULL;
CREATE INDEX idx_materials_public ON materials(created_at DESC)
    WHERE is_public = true;
