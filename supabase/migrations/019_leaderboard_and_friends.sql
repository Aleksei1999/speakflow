-- 019_leaderboard_and_friends.sql
-- Leaderboard (weekly / monthly / all-time) computed from xp_events,
-- materialized for cheap reads. Filters (level, city, friends) are applied
-- at query time by JOIN-ing against profiles and user_friends.

-- ==========================================================
-- user_friends (directed, one row per request)
-- ==========================================================
CREATE TABLE user_friends (
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at  TIMESTAMPTZ,
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id <> friend_id)
);

CREATE INDEX idx_user_friends_user   ON user_friends(user_id, status);
CREATE INDEX idx_user_friends_friend ON user_friends(friend_id, status);

ALTER TABLE user_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friends_select_involved_or_staff"
    ON user_friends FOR SELECT
    USING (
        auth.uid() = user_id
        OR auth.uid() = friend_id
        OR EXISTS (
            SELECT 1 FROM profiles p
             WHERE p.id = auth.uid()
               AND p.role IN ('teacher', 'admin')
        )
    );

CREATE POLICY "friends_insert_as_requester"
    ON user_friends FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "friends_update_by_recipient_or_self"
    ON user_friends FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friends_delete_by_either"
    ON user_friends FOR DELETE
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Helper: does "me" consider "other" an accepted friend (in either direction)?
CREATE OR REPLACE FUNCTION are_friends(me UUID, other UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_friends
         WHERE status = 'accepted'
           AND (
               (user_id = me AND friend_id = other)
               OR (user_id = other AND friend_id = me)
           )
    );
$$ LANGUAGE sql STABLE;

-- ==========================================================
-- Leaderboard materialized views
-- ==========================================================
CREATE MATERIALIZED VIEW leaderboard_weekly AS
SELECT user_id,
       SUM(amount)::INT AS xp,
       ROW_NUMBER() OVER (ORDER BY SUM(amount) DESC, user_id) AS rank
  FROM xp_events
 WHERE created_at >= now() - INTERVAL '7 days'
   AND amount > 0
 GROUP BY user_id;

CREATE UNIQUE INDEX idx_leaderboard_weekly_user ON leaderboard_weekly(user_id);
CREATE INDEX idx_leaderboard_weekly_rank        ON leaderboard_weekly(rank);

CREATE MATERIALIZED VIEW leaderboard_monthly AS
SELECT user_id,
       SUM(amount)::INT AS xp,
       ROW_NUMBER() OVER (ORDER BY SUM(amount) DESC, user_id) AS rank
  FROM xp_events
 WHERE created_at >= now() - INTERVAL '30 days'
   AND amount > 0
 GROUP BY user_id;

CREATE UNIQUE INDEX idx_leaderboard_monthly_user ON leaderboard_monthly(user_id);
CREATE INDEX idx_leaderboard_monthly_rank        ON leaderboard_monthly(rank);

CREATE MATERIALIZED VIEW leaderboard_all_time AS
SELECT user_id,
       SUM(amount)::INT AS xp,
       ROW_NUMBER() OVER (ORDER BY SUM(amount) DESC, user_id) AS rank
  FROM xp_events
 WHERE amount > 0
 GROUP BY user_id;

CREATE UNIQUE INDEX idx_leaderboard_all_time_user ON leaderboard_all_time(user_id);
CREATE INDEX idx_leaderboard_all_time_rank        ON leaderboard_all_time(rank);

-- ==========================================================
-- Refresh function — call via cron / edge function
-- CONCURRENTLY requires the unique indexes above.
-- ==========================================================
CREATE OR REPLACE FUNCTION refresh_leaderboards() RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_weekly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_monthly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_all_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initial populate (non-concurrent since views are empty after CREATE).
REFRESH MATERIALIZED VIEW leaderboard_weekly;
REFRESH MATERIALIZED VIEW leaderboard_monthly;
REFRESH MATERIALIZED VIEW leaderboard_all_time;

-- ==========================================================
-- NOTE: matviews cannot participate in RLS — filter at query time.
-- Typical SELECT pattern:
--   SELECT lb.rank, lb.xp, p.full_name, p.avatar_url,
--          up.current_streak, up.english_level,
--          (SELECT COUNT(*) FROM club_registrations r
--            WHERE r.user_id = lb.user_id AND r.status IN ('attended'))
--            AS clubs_attended
--     FROM leaderboard_weekly lb
--     JOIN profiles      p  ON p.id = lb.user_id
--     JOIN user_progress up ON up.user_id = lb.user_id
--    WHERE (:level IS NULL OR up.english_level = :level)
--      AND (:friends_only IS FALSE OR are_friends(auth.uid(), lb.user_id))
--    ORDER BY lb.rank
--    LIMIT 50;
-- ==========================================================
