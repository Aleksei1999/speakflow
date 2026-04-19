-- 014_xp_events.sql
-- Append-only XP ledger: every XP gain/loss is logged here.
-- user_progress.total_xp is derived via AFTER INSERT trigger.
-- Enables: leaderboards (by period), audit, achievement progress, refunds.

CREATE TABLE xp_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount       INT NOT NULL,                         -- may be negative (refund/correction)
    source_type  TEXT NOT NULL
                 CHECK (source_type IN (
                     'lesson_completed',       -- 1-on-1 lesson
                     'club_joined',            -- signed up for Speaking Club
                     'club_attended',          -- showed up
                     'club_completed',         -- full attendance
                     'course_enrolled',
                     'course_lesson_completed',
                     'course_completed',
                     'homework_submitted',
                     'streak_bonus',           -- daily keep-alive
                     'daily_challenge',
                     'achievement',            -- unlocking an achievement awards XP
                     'level_test',
                     'signup_bonus',
                     'manual'                  -- admin correction
                 )),
    source_id    UUID,                                  -- lesson_id / club_id / achievement_id / ...
    description  TEXT,
    metadata     JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xp_events_user_created ON xp_events(user_id, created_at DESC);
CREATE INDEX idx_xp_events_source ON xp_events(source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX idx_xp_events_created ON xp_events(created_at DESC);   -- for leaderboards by period

-- ==========================================================
-- Trigger: update user_progress aggregate on every xp_event.
-- ==========================================================
CREATE OR REPLACE FUNCTION apply_xp_event() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_progress (user_id, total_xp, updated_at)
    VALUES (NEW.user_id, GREATEST(NEW.amount, 0), now())
    ON CONFLICT (user_id) DO UPDATE
        SET total_xp   = GREATEST(user_progress.total_xp + NEW.amount, 0),
            updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_xp_events_apply ON xp_events;
CREATE TRIGGER trg_xp_events_apply
    AFTER INSERT ON xp_events
    FOR EACH ROW
    EXECUTE FUNCTION apply_xp_event();

-- ==========================================================
-- RLS
-- ==========================================================
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xp_events_select_own_or_staff" ON xp_events;
CREATE POLICY "xp_events_select_own_or_staff"
    ON xp_events FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

-- Inserts only via server-side (service role) or admin.
DROP POLICY IF EXISTS "xp_events_insert_admin" ON xp_events;
CREATE POLICY "xp_events_insert_admin"
    ON xp_events FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role = 'admin'
        )
    );

-- ==========================================================
-- Backfill: seed xp_events from existing user_progress totals
-- so leaderboards/history aren't empty for early users.
-- Trigger disabled during backfill to avoid double-counting
-- (user_progress already contains the total).
-- ==========================================================
ALTER TABLE xp_events DISABLE TRIGGER trg_xp_events_apply;

INSERT INTO xp_events (user_id, amount, source_type, description, created_at)
SELECT user_id,
       total_xp,
       'manual',
       'Backfill from user_progress.total_xp (pre-ledger)',
       updated_at
  FROM user_progress
 WHERE total_xp > 0;

ALTER TABLE xp_events ENABLE TRIGGER trg_xp_events_apply;
