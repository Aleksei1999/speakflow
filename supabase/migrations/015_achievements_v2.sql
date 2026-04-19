-- 015_achievements_v2.sql
-- Extend achievements model to match the new product design:
-- rarity tiers, emoji icons, digital/physical rewards, progress bars.
-- Category CHECK repointed to prototype's six groups.
-- Seeds 19 achievements that are explicitly defined in the prototype
-- (streaks, speaking, xp). Remaining 18 (levels, community, special)
-- are numbered slots in the prototype (37 total) but not spelled out —
-- add them in a follow-up once product defines them.

-- ==========================================================
-- Extend schema
-- ==========================================================
ALTER TABLE achievement_definitions
    ADD COLUMN IF NOT EXISTS rarity       TEXT NOT NULL DEFAULT 'common',
    ADD COLUMN IF NOT EXISTS icon_emoji   TEXT,
    ADD COLUMN IF NOT EXISTS reward_type  TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS reward_label TEXT,
    ADD COLUMN IF NOT EXISTS is_hidden    BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE achievement_definitions DROP CONSTRAINT IF EXISTS achievement_definitions_rarity_check;
ALTER TABLE achievement_definitions
    ADD CONSTRAINT achievement_definitions_rarity_check
    CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'));

ALTER TABLE achievement_definitions DROP CONSTRAINT IF EXISTS achievement_definitions_reward_type_check;
ALTER TABLE achievement_definitions
    ADD CONSTRAINT achievement_definitions_reward_type_check
    CHECK (reward_type IN ('none', 'digital', 'physical'));

-- Repoint category CHECK to the prototype groups.
ALTER TABLE achievement_definitions DROP CONSTRAINT IF EXISTS achievement_definitions_category_check;

UPDATE achievement_definitions SET category = CASE category
    WHEN 'lessons'   THEN 'levels'
    WHEN 'streak'    THEN 'streak'
    WHEN 'social'    THEN 'community'
    WHEN 'milestone' THEN 'special'
    ELSE category
END;

ALTER TABLE achievement_definitions
    ADD CONSTRAINT achievement_definitions_category_check
    CHECK (category IN ('streak', 'speaking', 'levels', 'xp', 'community', 'special'));

-- ==========================================================
-- Per-user progress toward each achievement (for progress bars
-- on not-yet-earned achievements)
-- ==========================================================
CREATE TABLE IF NOT EXISTS user_achievement_progress (
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id  UUID NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
    current_value   INT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_ach_progress_user ON user_achievement_progress(user_id);

DROP TRIGGER IF EXISTS trg_user_ach_progress_updated_at ON user_achievement_progress;
CREATE TRIGGER trg_user_ach_progress_updated_at
    BEFORE UPDATE ON user_achievement_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_achievement_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_ach_progress_select_own_or_staff" ON user_achievement_progress;
CREATE POLICY "user_ach_progress_select_own_or_staff"
    ON user_achievement_progress FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

-- achievement_definitions: readable by everyone, writable by admin
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ach_defs_select_all" ON achievement_definitions;
CREATE POLICY "ach_defs_select_all"
    ON achievement_definitions FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "ach_defs_admin_write" ON achievement_definitions;
CREATE POLICY "ach_defs_admin_write"
    ON achievement_definitions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

-- user_achievements RLS
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_ach_select_own_or_staff" ON user_achievements;
CREATE POLICY "user_ach_select_own_or_staff"
    ON user_achievements FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

-- ==========================================================
-- Seed: 19 achievements explicitly shown in the prototype
-- (streak ×6, speaking ×7, xp ×6). Remaining 18 slots
-- (levels, community, special) to be added later.
-- ==========================================================
INSERT INTO achievement_definitions
    (slug, title, description, category, rarity, icon_emoji, threshold, xp_reward, reward_type, reward_label, sort_order)
VALUES
-- 🔥 STREAK (6)
('streak_first_flame',   'First Flame',     'Первый день подряд на платформе',       'streak', 'common',    '🔥',     1, 10,   'none',     NULL,                         10),
('streak_week_warrior',  'Week Warrior',    '7 дней подряд без пропусков',            'streak', 'common',    '🔥',     7, 50,   'none',     NULL,                         11),
('streak_two_week_blaze','Two-Week Blaze',  '14 дней подряд',                         'streak', 'rare',      '🔥',    14, 100,  'physical', '🎨 Стикерпак Raw',           12),
('streak_monthly_fire',  'Monthly Fire',    '30 дней подряд',                         'streak', 'epic',      '🔥',    30, 250,  'physical', '🎧 Мерч Raw',                13),
('streak_eternal_flame', 'Eternal Flame',   '100 дней подряд',                        'streak', 'legendary', '🔥',   100, 1000, 'digital',  '🎁 Бесплатный месяц',        14),
('streak_unstoppable',   'Unstoppable',     '365 дней подряд',                        'streak', 'legendary', '🔥',   365, 5000, 'physical', '🏆 Hall of Fame + мерч',     15),

-- 🎙 SPEAKING (7)
('speak_first_words',    'First Words',     'Посети первый Speaking Club',            'speaking', 'common',    '🎙',     1, 30,   'none',     NULL,                         20),
('speak_regular',        'Regular',         'Посети 10 клубов',                       'speaking', 'rare',      '🎙',    10, 100,  'none',     NULL,                         21),
('speak_club_lover',     'Club Lover',      'Посети 25 клубов',                       'speaking', 'rare',      '🎙',    25, 250,  'digital',  '🎟 Guest Pass',              22),
('speak_social_butterfly','Social Butterfly','Посети 50 клубов',                      'speaking', 'epic',      '🎙',    50, 500,  'digital',  '💰 Скидка 20%',              23),
('speak_legend',         'Legend',          'Посети 100 клубов',                      'speaking', 'legendary', '🎙',   100, 1500, 'digital',  '🎓 Урок 1-on-1',             24),
('speak_debate_king',    'Debate King',     'Выиграй 5 Debate Clubs',                 'speaking', 'epic',      '🗣',     5, 200,  'none',     NULL,                         25),
('speak_wine_connoisseur','Wine Connoisseur','Посети 10 Wine Clubs',                  'speaking', 'rare',      '🍷',    10, 150,  'none',     NULL,                         26),

-- ⚡ XP (6)
('xp_first_xp',          'First XP',        'Заработай первые 10 XP',                 'xp', 'common',    '⚡',    10, 10,   'none',     NULL,                         30),
('xp_centurion',         'Centurion',       '100 XP за один день',                    'xp', 'rare',      '⚡',   100, 50,   'none',     NULL,                         31),
('xp_machine',           'XP Machine',      '500 XP за неделю',                       'xp', 'rare',      '⚡',   500, 150,  'none',     NULL,                         32),
('xp_monster',           'XP Monster',      'Набери 5,000 XP всего',                  'xp', 'epic',      '⚡',  5000, 500,  'digital',  '🎟 Guest Pass',              33),
('xp_legend',            'XP Legend',       'Набери 25,000 XP всего',                 'xp', 'legendary', '⚡', 25000, 2000, 'digital',  '🎓 Урок 1-on-1',             34),
('xp_daily_champion',    'Daily Champion',  'Daily Challenge 30 дней подряд',         'xp', 'epic',      '⚡',    30, 300,  'physical', '🎨 Стикерпак',               35)
ON CONFLICT (slug) DO UPDATE
    SET title        = EXCLUDED.title,
        description  = EXCLUDED.description,
        category     = EXCLUDED.category,
        rarity       = EXCLUDED.rarity,
        icon_emoji   = EXCLUDED.icon_emoji,
        threshold    = EXCLUDED.threshold,
        xp_reward    = EXCLUDED.xp_reward,
        reward_type  = EXCLUDED.reward_type,
        reward_label = EXCLUDED.reward_label,
        sort_order   = EXCLUDED.sort_order;
