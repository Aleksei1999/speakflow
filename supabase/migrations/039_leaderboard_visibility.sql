-- 039_leaderboard_visibility.sql
-- Honor profile_visibility.leaderboard_public from /student/settings.
--
-- Before: get_leaderboard returned every active user, ignoring the toggle.
-- After:  rows where profile_visibility->>'leaderboard_public' = 'false'
--         are excluded for all callers (the user themselves included).
--         Default behavior (unset / true) keeps current users visible.
--
-- Note on ranks: ranks come from the materialized views
-- (leaderboard_weekly / monthly / all_time) which still include opted-out
-- users in their numeric rank. Excluding them here just creates "gaps"
-- (e.g. 1, 2, 4) — that's acceptable and avoids a costly recompute on
-- every read.

BEGIN;

CREATE OR REPLACE FUNCTION get_leaderboard(
    p_period       TEXT DEFAULT 'weekly',
    p_level        TEXT DEFAULT NULL,
    p_friends_only BOOLEAN DEFAULT FALSE,
    p_limit        INT DEFAULT 50
)
RETURNS TABLE (
    out_rank           BIGINT,
    out_user_id        UUID,
    out_xp             INT,
    out_full_name      TEXT,
    out_avatar_url     TEXT,
    out_english_level  TEXT,
    out_current_streak INT,
    out_longest_streak INT,
    out_clubs_attended INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
BEGIN
    IF p_period NOT IN ('weekly', 'monthly', 'all_time') THEN
        RAISE EXCEPTION 'invalid period %', p_period;
    END IF;
    IF p_friends_only AND v_me IS NULL THEN
        RAISE EXCEPTION 'friends_only requires authenticated user';
    END IF;

    RETURN QUERY
    WITH base AS (
        SELECT lw.user_id, lw.xp, lw.rank
          FROM leaderboard_weekly lw
         WHERE p_period = 'weekly'
        UNION ALL
        SELECT lm.user_id, lm.xp, lm.rank
          FROM leaderboard_monthly lm
         WHERE p_period = 'monthly'
        UNION ALL
        SELECT la.user_id, la.xp, la.rank
          FROM leaderboard_all_time la
         WHERE p_period = 'all_time'
    )
    SELECT b.rank,
           b.user_id,
           b.xp,
           p.full_name,
           p.avatar_url,
           up.english_level,
           COALESCE(up.current_streak, 0)::INT,
           COALESCE(up.longest_streak, 0)::INT,
           COALESCE(
               (SELECT COUNT(*)::INT FROM club_registrations r
                 WHERE r.user_id = b.user_id AND r.status = 'attended'),
               0
           )
      FROM base b
      JOIN profiles      p  ON p.id = b.user_id
 LEFT JOIN user_progress up ON up.user_id = b.user_id
     WHERE (p_level IS NULL OR up.english_level = p_level)
       AND (NOT p_friends_only OR are_friends(v_me, b.user_id))
       AND COALESCE((p.profile_visibility->>'leaderboard_public')::BOOLEAN, TRUE) = TRUE
     ORDER BY b.rank
     LIMIT GREATEST(p_limit, 1);
END;
$$;

REVOKE ALL ON FUNCTION get_leaderboard(TEXT, TEXT, BOOLEAN, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_leaderboard(TEXT, TEXT, BOOLEAN, INT) TO authenticated, anon;

COMMIT;
