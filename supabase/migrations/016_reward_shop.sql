-- 016_reward_shop.sql
-- Reward shop: tangible/digital prizes unlocked by streaks, XP, clubs, rank.
-- Separate from achievement rewards (ach has its own reward_label) — this
-- is the curated prize wall shown on the achievements page.

CREATE TABLE reward_definitions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug           TEXT UNIQUE NOT NULL,
    title          TEXT NOT NULL,
    description    TEXT,
    icon_emoji     TEXT,
    reward_type    TEXT NOT NULL
                   CHECK (reward_type IN ('digital', 'physical')),
    -- claim_criteria is a JSON matcher evaluated server-side.
    -- Supported shapes:
    --   {"streak": 30}                  — current_streak >= 30
    --   {"longest_streak": 365}
    --   {"total_xp": 25000}
    --   {"clubs_attended": 50}
    --   {"platform_days": 365}          — days since profile.created_at
    --   {"leaderboard_rank_max": 3}     — any period
    --   {"any": [<criteria>, ...]}      — OR
    --   {"all": [<criteria>, ...]}      — AND
    claim_criteria JSONB NOT NULL,
    sort_order     INT NOT NULL DEFAULT 0,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reward_defs_sort ON reward_definitions(sort_order) WHERE is_active;

CREATE TABLE user_rewards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reward_id       UUID NOT NULL REFERENCES reward_definitions(id) ON DELETE RESTRICT,
    status          TEXT NOT NULL DEFAULT 'awarded'
                    CHECK (status IN (
                        'awarded',    -- criteria met, awaiting fulfillment or redemption
                        'delivered',  -- physical reward shipped
                        'redeemed',   -- digital reward used (guest pass, discount, etc.)
                        'expired'
                    )),
    awarded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fulfilled_at    TIMESTAMPTZ,
    delivery_json   JSONB,   -- {name, phone, address, city, country, notes}
    tracking_number TEXT,
    admin_notes     TEXT,
    UNIQUE (user_id, reward_id)
);

CREATE INDEX idx_user_rewards_user ON user_rewards(user_id);
CREATE INDEX idx_user_rewards_status ON user_rewards(status);

-- ==========================================================
-- RLS
-- ==========================================================
ALTER TABLE reward_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_defs_select_all"
    ON reward_definitions FOR SELECT
    USING (TRUE);

CREATE POLICY "reward_defs_admin_write"
    ON reward_definitions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_rewards_select_own_or_staff"
    ON user_rewards FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

-- User may update delivery_json on their own pending awards (shipping info).
CREATE POLICY "user_rewards_update_delivery_own"
    ON user_rewards FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_rewards_admin_write"
    ON user_rewards FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

-- ==========================================================
-- Seed: 9 rewards from prototype reward shop
-- ==========================================================
INSERT INTO reward_definitions
    (slug, title, description, icon_emoji, reward_type, claim_criteria, sort_order)
VALUES
('guest_pass',           'Guest Pass',              'Бесплатное посещение клуба для друга',          '🎟',  'digital',  '{"any":[{"clubs_attended":25},{"total_xp":5000}]}',                                  10),
('stickerpack_raw',      'Стикерпак',               'Набор брендированных стикеров Raw',             '🎨',  'physical', '{"any":[{"streak":14},{"daily_challenge_streak":30}]}',                              20),
('merch_raw',            'Мерч Raw',                'Наушники, блокнот или худи на выбор',           '🎧',  'physical', '{"streak":30}',                                                                      30),
('free_1on1',            'Бесплатный урок 1-on-1',  'Персональное занятие в подарок',                '🎓',  'digital',  '{"any":[{"clubs_attended":100},{"total_xp":25000}]}',                                40),
('discount_20_50',       'Скидка 20–50%',           'Скидка на подписку за активность',              '💰',  'digital',  '{"any":[{"clubs_attended":50},{"leaderboard_rank_max":3}]}',                         50),
('free_month',           'Бесплатный месяц',        'Полный месяц подписки',                         '🎁',  'digital',  '{"streak":100}',                                                                     60),
('hall_of_fame',         'Hall of Fame',            'Золотой бейдж навсегда',                        '🏆',  'digital',  '{"streak":365}',                                                                     70),
('anniversary_kit',      'Юбилейный набор',         'Мерч + бейдж за 1 год',                         '🎉',  'physical', '{"platform_days":365}',                                                              80),
('exclusive_event',      'Эксклюзивный ивент',      'Закрытое мероприятие',                          '🌟',  'digital',  '{"leaderboard_rank_max":3}',                                                         90)
ON CONFLICT (slug) DO UPDATE
    SET title          = EXCLUDED.title,
        description    = EXCLUDED.description,
        icon_emoji     = EXCLUDED.icon_emoji,
        reward_type    = EXCLUDED.reward_type,
        claim_criteria = EXCLUDED.claim_criteria,
        sort_order     = EXCLUDED.sort_order;
