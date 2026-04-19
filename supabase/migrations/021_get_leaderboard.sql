-- 021_get_leaderboard.sql
-- SECURITY DEFINER helper that reads a leaderboard matview and joins against
-- profiles / user_progress / club_registrations with optional filters.
--
-- Filters:
--   p_period       — 'weekly' | 'monthly' | 'all_time'
--   p_level        — NULL or roast level string
--   p_friends_only — if TRUE, restrict to accepted friends of auth.uid()
--   p_limit        — max rows
--
-- NB: RETURNS TABLE columns are prefixed out_* to avoid PL/pgSQL ambiguity with
-- matview column names (user_id, rank, xp).

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
     ORDER BY b.rank
     LIMIT GREATEST(p_limit, 1);
END;
$$;

REVOKE ALL ON FUNCTION get_leaderboard(TEXT, TEXT, BOOLEAN, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_leaderboard(TEXT, TEXT, BOOLEAN, INT) TO authenticated, anon;
