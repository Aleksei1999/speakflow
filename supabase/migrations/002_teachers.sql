-- 002_teachers.sql
-- Teacher profiles and availability schedule

CREATE TABLE teacher_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    bio             TEXT,
    specializations TEXT[] NOT NULL DEFAULT '{}',
    experience_years INT,
    hourly_rate     INT NOT NULL,           -- kopecks
    trial_rate      INT,                    -- kopecks, nullable = no trial
    languages       TEXT[] NOT NULL DEFAULT '{en,ru}',
    education       TEXT,
    certificates    TEXT[] NOT NULL DEFAULT '{}',
    video_intro_url TEXT,
    rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
    total_reviews   INT NOT NULL DEFAULT 0,
    total_lessons   INT NOT NULL DEFAULT 0,
    is_verified     BOOLEAN NOT NULL DEFAULT false,
    is_listed       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_profiles_user_id ON teacher_profiles(user_id);
CREATE INDEX idx_teacher_profiles_specializations ON teacher_profiles USING GIN (specializations);
CREATE INDEX idx_teacher_profiles_rating ON teacher_profiles(rating DESC);
CREATE INDEX idx_teacher_profiles_hourly_rate ON teacher_profiles(hourly_rate);
CREATE INDEX idx_teacher_profiles_listed ON teacher_profiles(is_listed)
    WHERE is_listed = true;

CREATE TRIGGER trg_teacher_profiles_updated_at
    BEFORE UPDATE ON teacher_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Weekly availability slots
CREATE TABLE teacher_availability (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (teacher_id, day_of_week, start_time),
    CHECK (end_time > start_time)
);

CREATE INDEX idx_teacher_availability_teacher_id ON teacher_availability(teacher_id);
CREATE INDEX idx_teacher_availability_active ON teacher_availability(teacher_id, day_of_week)
    WHERE is_active = true;
