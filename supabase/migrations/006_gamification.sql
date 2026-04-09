-- 006_gamification.sql
-- Achievements, XP, levels, and streaks

CREATE TABLE achievement_definitions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    icon_url    TEXT,
    category    TEXT NOT NULL
                CHECK (category IN ('lessons', 'streak', 'social', 'milestone')),
    threshold   INT NOT NULL DEFAULT 1,
    xp_reward   INT NOT NULL DEFAULT 0,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id  UUID NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

CREATE TABLE user_progress (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    total_xp            INT NOT NULL DEFAULT 0,
    current_level       INT NOT NULL DEFAULT 1,
    lessons_completed   INT NOT NULL DEFAULT 0,
    current_streak      INT NOT NULL DEFAULT 0,
    longest_streak      INT NOT NULL DEFAULT 0,
    last_lesson_date    DATE,
    english_level       TEXT CHECK (english_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_progress_total_xp ON user_progress(total_xp DESC);

CREATE TRIGGER trg_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
