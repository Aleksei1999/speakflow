-- 007_ai_summaries.sql
-- AI-generated lesson summaries and student reviews

CREATE TABLE lesson_summaries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id           UUID NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
    student_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    teacher_id          UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT,
    teacher_input       TEXT,
    summary_text        TEXT NOT NULL,
    vocabulary          TEXT[] NOT NULL DEFAULT '{}',
    grammar_points      TEXT[] NOT NULL DEFAULT '{}',
    homework            TEXT,
    strengths           TEXT[] NOT NULL DEFAULT '{}',
    areas_to_improve    TEXT[] NOT NULL DEFAULT '{}',
    ai_model            TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    tokens_used         INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_summaries_student_id ON lesson_summaries(student_id);
CREATE INDEX idx_lesson_summaries_teacher_id ON lesson_summaries(teacher_id);

-- Student reviews of teachers
CREATE TABLE reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id   UUID NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    teacher_id  UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT,
    rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    is_visible  BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_teacher_id ON reviews(teacher_id);
CREATE INDEX idx_reviews_student_id ON reviews(student_id);

-- Recalculate teacher rating on review insert/update
CREATE OR REPLACE FUNCTION update_teacher_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE teacher_profiles
    SET
        rating = (
            SELECT COALESCE(ROUND(AVG(r.rating)::NUMERIC, 2), 0)
            FROM reviews r
            WHERE r.teacher_id = NEW.teacher_id
              AND r.is_visible = true
        ),
        total_reviews = (
            SELECT COUNT(*)
            FROM reviews r
            WHERE r.teacher_id = NEW.teacher_id
              AND r.is_visible = true
        ),
        updated_at = now()
    WHERE id = NEW.teacher_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_teacher_rating
    AFTER INSERT OR UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_teacher_rating();
