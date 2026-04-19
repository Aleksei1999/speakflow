-- 017_speaking_clubs.sql
-- Paid Speaking Clubs (online + offline), multi-host, level-ranged,
-- with seat tracking and YooKassa-based payments.

-- Roast level enum-like set (mirrors user_progress/level_tests CHECKs)
-- Raw, Rare, Medium Rare, Medium, Medium Well, Well Done

CREATE TABLE clubs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic          TEXT NOT NULL,
    description    TEXT,
    category       TEXT NOT NULL
                   CHECK (category IN (
                       'speaking', 'business', 'movies', 'debate', 'wine',
                       'career', 'community', 'storytelling', 'smalltalk', 'other'
                   )),
    level_min      TEXT
                   CHECK (level_min IS NULL OR level_min IN (
                       'Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'
                   )),
    level_max      TEXT
                   CHECK (level_max IS NULL OR level_max IN (
                       'Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'
                   )),
    format         TEXT NOT NULL
                   CHECK (format IN ('online', 'offline')),
    location       TEXT,                          -- "Zoom" / "Белград" / "Тбилиси" / etc.
    timezone       TEXT NOT NULL DEFAULT 'Europe/Moscow',
    starts_at      TIMESTAMPTZ NOT NULL,
    duration_min   INT NOT NULL CHECK (duration_min > 0),
    max_seats      INT NOT NULL CHECK (max_seats > 0),
    seats_taken    INT NOT NULL DEFAULT 0,
    price_kopecks  INT NOT NULL DEFAULT 0 CHECK (price_kopecks >= 0),
    xp_reward      INT NOT NULL DEFAULT 50 CHECK (xp_reward >= 0),
    badge          TEXT,                          -- "hot" | "new" | "classic" | free-form
    meeting_url    TEXT,                          -- Jitsi/Zoom link, revealed after payment
    cover_emoji    TEXT,
    is_published   BOOLEAN NOT NULL DEFAULT TRUE,
    cancelled_at   TIMESTAMPTZ,
    created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clubs_starts_at ON clubs(starts_at);
CREATE INDEX idx_clubs_category  ON clubs(category);
CREATE INDEX idx_clubs_format    ON clubs(format);
CREATE INDEX idx_clubs_published ON clubs(is_published, starts_at) WHERE is_published AND cancelled_at IS NULL;

DROP TRIGGER IF EXISTS trg_clubs_updated_at ON clubs;
CREATE TRIGGER trg_clubs_updated_at
    BEFORE UPDATE ON clubs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- Hosts (many-to-many: a club can have multiple hosts)
-- ==========================================================
CREATE TABLE club_hosts (
    club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    host_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'host'
                CHECK (role IN ('host', 'co_host', 'moderator')),
    sort_order  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (club_id, host_id)
);

CREATE INDEX idx_club_hosts_host ON club_hosts(host_id);

-- ==========================================================
-- Registrations (one row per user per club)
-- ==========================================================
CREATE TABLE club_registrations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id      UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending_payment'
                 CHECK (status IN (
                     'pending_payment',  -- awaiting YooKassa confirmation
                     'registered',       -- paid and counted in seats
                     'waitlist',         -- club full, queued
                     'attended',         -- marked present after club
                     'no_show',
                     'cancelled',        -- user cancelled before club
                     'refunded'
                 )),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attended_at   TIMESTAMPTZ,
    cancelled_at  TIMESTAMPTZ,
    notes         TEXT,
    UNIQUE (club_id, user_id)
);

CREATE INDEX idx_club_regs_club ON club_registrations(club_id, status);
CREATE INDEX idx_club_regs_user ON club_registrations(user_id, registered_at DESC);

-- ==========================================================
-- Club payments (separate from the lesson-bound payments table)
-- ==========================================================
CREATE TABLE club_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id     UUID NOT NULL UNIQUE REFERENCES club_registrations(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
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

CREATE INDEX idx_club_payments_user   ON club_payments(user_id);
CREATE INDEX idx_club_payments_status ON club_payments(status);
CREATE INDEX idx_club_payments_yk     ON club_payments(yookassa_payment_id)
    WHERE yookassa_payment_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_club_payments_updated_at ON club_payments;
CREATE TRIGGER trg_club_payments_updated_at
    BEFORE UPDATE ON club_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- Seats denormalization trigger
-- Maintains clubs.seats_taken based on club_registrations
-- (counts only statuses that actually occupy a seat).
-- ==========================================================
CREATE OR REPLACE FUNCTION recalc_club_seats() RETURNS TRIGGER AS $$
DECLARE
    v_club_id UUID;
BEGIN
    v_club_id := COALESCE(NEW.club_id, OLD.club_id);
    UPDATE clubs
       SET seats_taken = (
           SELECT COUNT(*) FROM club_registrations
            WHERE club_id = v_club_id
              AND status IN ('registered', 'attended')
       ),
       updated_at = now()
     WHERE id = v_club_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_club_regs_seats ON club_registrations;
CREATE TRIGGER trg_club_regs_seats
    AFTER INSERT OR UPDATE OF status OR DELETE ON club_registrations
    FOR EACH ROW
    EXECUTE FUNCTION recalc_club_seats();

-- ==========================================================
-- Level-range sanity: if both bounds set, min must come before max.
-- ==========================================================
ALTER TABLE clubs
    ADD CONSTRAINT clubs_level_order_check
    CHECK (
        level_min IS NULL
        OR level_max IS NULL
        OR array_position(
               ARRAY['Raw','Rare','Medium Rare','Medium','Medium Well','Well Done'],
               level_min
           )
           <=
           array_position(
               ARRAY['Raw','Rare','Medium Rare','Medium','Medium Well','Well Done'],
               level_max
           )
    );

-- ==========================================================
-- RLS
-- ==========================================================
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clubs_select_published_or_staff"
    ON clubs FOR SELECT
    USING (
        is_published = TRUE
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
        OR EXISTS (
            SELECT 1 FROM club_hosts h
             WHERE h.club_id = clubs.id
               AND h.host_id = auth.uid()
        )
    );

CREATE POLICY "clubs_admin_write"
    ON clubs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

ALTER TABLE club_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_hosts_select_all"
    ON club_hosts FOR SELECT
    USING (TRUE);

CREATE POLICY "club_hosts_admin_write"
    ON club_hosts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

ALTER TABLE club_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_regs_select_own_or_host_or_staff"
    ON club_registrations FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM club_hosts h
             WHERE h.club_id = club_registrations.club_id
               AND h.host_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

CREATE POLICY "club_regs_insert_own"
    ON club_registrations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "club_regs_update_own_or_staff"
    ON club_registrations FOR UPDATE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

ALTER TABLE club_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_payments_select_own_or_staff"
    ON club_payments FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

-- Inserts/updates via service role only (webhook/API).
CREATE POLICY "club_payments_admin_write"
    ON club_payments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

-- ==========================================================
-- Realtime: clubs (for live seat counter / cancellations)
-- and club_registrations (for host dashboards).
-- ==========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE clubs;
ALTER PUBLICATION supabase_realtime ADD TABLE club_registrations;
