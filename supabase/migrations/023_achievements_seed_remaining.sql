-- 023_achievements_seed_remaining.sql
-- Seeds the remaining 18 achievements from the XP map spec:
--   levels    (6) — sort_order 40-45
--   community (6) — sort_order 50-55
--   special   (6) — sort_order 60-65
-- Migration is idempotent: ON CONFLICT (slug) DO UPDATE mirrors 015.
-- Existing 19 rows from 015 are untouched.

INSERT INTO achievement_definitions
    (slug, title, description, category, rarity, icon_emoji, threshold, xp_reward, reward_type, reward_label, sort_order)
VALUES
-- 📈 LEVELS (6) ------------------------------------------------------------
('level_rare_achiever',   'Rare Achiever',   'Дойти до уровня Rare (500 XP)',                 'levels', 'rare',      '📈',   500,   50, 'none',     NULL,                             40),
('level_medium_rare',     'Medium Rare',     'Дойти до Medium Rare (2 000 XP)',                'levels', 'rare',      '📈',  2000,  150, 'digital',  '🎟 Guest Pass',                  41),
('level_medium_master',   'Medium Master',   'Дойти до Medium (5 000 XP)',                     'levels', 'epic',      '📈',  5000,  300, 'physical', '🎧 Мерч Raw',                    42),
('level_medium_well_pro', 'Medium Well Pro', 'Дойти до Medium Well (12 000 XP)',               'levels', 'epic',      '📈', 12000,  500, 'digital',  '💰 Скидка 30%',                  43),
('level_well_done',       'Well Done!',      'Дойти до Well Done (25 000 XP)',                 'levels', 'legendary', '🏆', 25000, 2000, 'digital',  '🏆 Hall of Fame + месяц',        44),
('level_speed_runner',    'Speed Runner',    'Level up за ≤30 дней',                           'levels', 'epic',      '⚡',    30,  300, 'none',     NULL,                             45),

-- 👥 COMMUNITY (6) ---------------------------------------------------------
('comm_recruiter',         'Recruiter',         'Пригласи 1 друга',                             'community', 'common',    '👥',   1,  100, 'none',     NULL,                          50),
('comm_ambassador',        'Ambassador',        'Пригласи 5 друзей',                            'community', 'rare',      '👥',   5,  500, 'digital',  '💰 Скидка 50%',               51),
('comm_community_builder', 'Community Builder', 'Пригласи 10 друзей',                           'community', 'epic',      '👥',  10, 1000, 'digital',  '🎁 Бесплатный месяц',         52),
('comm_top_3',             'Top 3',             'Попасть в топ-3 лидерборда',                   'community', 'epic',      '🏅',   3,  500, 'digital',  '🎉 Ивент + скидка',           53),
('comm_champion',          'Champion',          'Занять 1 место в лидерборде',                  'community', 'legendary', '🥇',   1, 1000, 'physical', '🎧 Мерч + месяц',             54),
('comm_mentor',            'Mentor',            'Довести 3 учеников до уровня Rare',            'community', 'epic',      '👨‍🏫',  3,  500, 'digital',  '🎓 Бейдж Mentor',             55),

-- 🎯 SPECIAL (6) -----------------------------------------------------------
('spec_perfect_score',    'Perfect Score',   '100% в тесте уровня',                             'special', 'epic',      '💯', 100,  200, 'none',     NULL,                             60),
('spec_bookworm',         'Bookworm',        '50 уроков пройдено',                              'special', 'epic',      '📚',  50,  500, 'digital',  '🎓 Урок 1-on-1',                61),
('spec_early_bird',       'Early Bird',      'Записаться на клуб в первые 5 минут',             'special', 'common',    '🌅',   1,   50, 'none',     NULL,                             62),
('spec_anniversary',      'Anniversary',     '1 год на платформе',                              'special', 'legendary', '🎂', 365, 1000, 'physical', '🎁 Юбилейный набор',            63),
('spec_polyglot',         'Polyglot',        'Пообщаться с 5 разными native-спикерами',         'special', 'rare',      '🌍',   5,  200, 'none',     NULL,                             64),
('spec_all_rounder',      'All-Rounder',     'Посетить все типы клубов (4 типа)',               'special', 'rare',      '🎯',   4,  150, 'digital',  '🎟 Guest Pass',                 65)
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
