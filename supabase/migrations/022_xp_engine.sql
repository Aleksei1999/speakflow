-- 022_xp_engine.sql
-- Centralized XP engine: daily-limited writer, lesson-completion trigger, streak engine.
--
-- Overview:
--   1. award_xp(user, source, source_id, amount, description, metadata)
--      SECURITY DEFINER RPC that enforces per-source daily caps before inserting
--      into the xp_events ledger. Returns (awarded BOOLEAN, reason TEXT).
--   2. on_lesson_completed() — AFTER UPDATE trigger on lessons that fires when
--      status flips to 'completed' and awards XP scaled by duration.
--   3. apply_streak_on_xp_event() — AFTER INSERT trigger on xp_events that
--      maintains current_streak / longest_streak / last_lesson_date and issues
--      streak_bonus events (5 XP keep-alive + 7-day milestones that double
--      every 30 consecutive days).
--
-- Notes:
--   * Existing trigger trg_xp_events_apply (014) keeps aggregating total_xp.
--   * xp_events RLS still blocks INSERTs from non-admins; award_xp is
--     SECURITY DEFINER so it bypasses RLS when called by authenticated users.
--   * Recursion guard: streak trigger ignores source_type='streak_bonus'.

-- =====================================================================
-- 1. award_xp — centralized writer with per-source daily caps
-- =====================================================================
-- Caps (per user per UTC day):
--   lesson_completed  = 5
--   club_attended     = 2
--   daily_challenge   = 1
--   level_test        = 1 per 30 days
-- Other sources: no cap here (achievements/manual/signup_bonus handled elsewhere).
--
-- Returns:
--   awarded=true,  reason='ok'
--   awarded=false, reason='daily_limit_reached' | 'level_test_cooldown' | 'invalid_amount'
CREATE OR REPLACE FUNCTION award_xp(
    p_user_id     UUID,
    p_source      TEXT,
    p_source_id   UUID,
    p_amount      INT,
    p_description TEXT DEFAULT NULL,
    p_metadata    JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(awarded BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_count   INT;
    v_last_test_at  TIMESTAMPTZ;
BEGIN
    IF p_amount IS NULL OR p_amount = 0 THEN
        RETURN QUERY SELECT FALSE, 'invalid_amount';
        RETURN;
    END IF;

    -- Daily-count caps
    IF p_source IN ('lesson_completed', 'club_attended', 'daily_challenge') THEN
        SELECT COUNT(*)
          INTO v_today_count
          FROM xp_events
         WHERE user_id     = p_user_id
           AND source_type = p_source
           AND created_at  >= date_trunc('day', now());

        IF (p_source = 'lesson_completed' AND v_today_count >= 5)
           OR (p_source = 'club_attended'  AND v_today_count >= 2)
           OR (p_source = 'daily_challenge' AND v_today_count >= 1) THEN
            RETURN QUERY SELECT FALSE, 'daily_limit_reached';
            RETURN;
        END IF;
    END IF;

    -- 30-day cooldown for level_test
    IF p_source = 'level_test' THEN
        SELECT MAX(created_at)
          INTO v_last_test_at
          FROM xp_events
         WHERE user_id     = p_user_id
           AND source_type = 'level_test';

        IF v_last_test_at IS NOT NULL
           AND v_last_test_at > now() - INTERVAL '30 days' THEN
            RETURN QUERY SELECT FALSE, 'level_test_cooldown';
            RETURN;
        END IF;
    END IF;

    INSERT INTO xp_events (user_id, amount, source_type, source_id, description, metadata)
    VALUES (p_user_id, p_amount, p_source, p_source_id, p_description, COALESCE(p_metadata, '{}'::jsonb));

    RETURN QUERY SELECT TRUE, 'ok';
END;
$$;

COMMENT ON FUNCTION award_xp(UUID, TEXT, UUID, INT, TEXT, JSONB)
    IS 'Centralized XP writer. Enforces per-source daily caps (lesson=5, club=2, daily=1) and level_test 30d cooldown before inserting into xp_events. SECURITY DEFINER so it bypasses the admin-only INSERT policy on xp_events.';

-- Allow authenticated clients (and service role) to call award_xp.
REVOKE ALL ON FUNCTION award_xp(UUID, TEXT, UUID, INT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION award_xp(UUID, TEXT, UUID, INT, TEXT, JSONB) TO authenticated, service_role;


-- =====================================================================
-- 2. Trigger: lessons.status -> 'completed' awards XP to the student
-- =====================================================================
-- Mapping (raw-english-xp-map):
--   45 min -> 40 XP
--   50 min -> 45 XP (project default)
--   60 min -> 55 XP
--   other  -> ROUND(duration * 55 / 60)
-- Fires only on transition to 'completed'. Uses award_xp so the daily
-- lesson cap (5/day) is enforced automatically.
CREATE OR REPLACE FUNCTION on_lesson_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_amount INT;
BEGIN
    v_amount := CASE NEW.duration_minutes
                    WHEN 45 THEN 40
                    WHEN 50 THEN 45
                    WHEN 60 THEN 55
                    ELSE GREATEST(1, ROUND(NEW.duration_minutes * 55.0 / 60)::INT)
                END;

    PERFORM award_xp(
        NEW.student_id,
        'lesson_completed',
        NEW.id,
        v_amount,
        'Урок ' || NEW.duration_minutes || ' мин',
        jsonb_build_object(
            'lesson_id',       NEW.id,
            'duration',        NEW.duration_minutes,
            'teacher_id',      NEW.teacher_id,
            'scheduled_at',    NEW.scheduled_at
        )
    );

    -- Keep the denormalized counter in sync.
    INSERT INTO user_progress (user_id, lessons_completed, updated_at)
    VALUES (NEW.student_id, 1, now())
    ON CONFLICT (user_id) DO UPDATE
        SET lessons_completed = user_progress.lessons_completed + 1,
            updated_at        = now();

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION on_lesson_completed()
    IS 'AFTER UPDATE trigger on lessons. When status transitions to completed, awards student XP (40/45/55 XP for 45/50/60 min) via award_xp and bumps user_progress.lessons_completed.';

DROP TRIGGER IF EXISTS trg_lesson_completed_xp ON lessons;
CREATE TRIGGER trg_lesson_completed_xp
    AFTER UPDATE OF status ON lessons
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed')
    EXECUTE FUNCTION on_lesson_completed();


-- =====================================================================
-- 3. Streak engine — AFTER INSERT on xp_events
-- =====================================================================
-- Any XP-earning activity counts as an "active day". Rules:
--   * First event ever, or gap > 1 day since last_lesson_date -> current_streak=1
--   * Event on last_lesson_date + 1 day                       -> current_streak += 1
--                                                                 AND award 5 XP (streak_bonus)
--   * Event on the same day as last_lesson_date               -> no-op (already counted)
--   * Milestone: every 7th consecutive day (streak % 7 == 0)  -> award 20 XP * 2^floor(streak/30)
--     so 7/14/21/28 -> 20 XP, 35/42/49/56 -> 40 XP, 65+ -> 80 XP, etc.
--   * longest_streak = GREATEST(longest_streak, current_streak)
--
-- Recursion guard: ignore inserts whose source_type is 'streak_bonus'
-- (otherwise the 5 XP keep-alive and milestone inserts would re-trigger
-- the streak logic).
CREATE OR REPLACE FUNCTION apply_streak_on_xp_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today          DATE := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
    v_last           DATE;
    v_current        INT;
    v_new_current    INT;
    v_milestone_mult INT;
    v_milestone_amt  INT;
BEGIN
    -- Avoid recursion: streak_bonus inserts are a side-effect of this trigger.
    IF NEW.source_type = 'streak_bonus' THEN
        RETURN NEW;
    END IF;

    -- Read current streak state. Row may not exist yet (first XP event for this user).
    SELECT last_lesson_date, current_streak
      INTO v_last, v_current
      FROM user_progress
     WHERE user_id = NEW.user_id
     FOR UPDATE;

    IF NOT FOUND THEN
        -- user_progress row is created by trg_xp_events_apply (014). That runs in
        -- the same AFTER INSERT, so row should already exist. Fallback: insert.
        INSERT INTO user_progress (user_id, current_streak, longest_streak, last_lesson_date, updated_at)
        VALUES (NEW.user_id, 1, 1, v_today, now())
        ON CONFLICT (user_id) DO UPDATE
            SET current_streak    = 1,
                longest_streak    = GREATEST(user_progress.longest_streak, 1),
                last_lesson_date  = v_today,
                updated_at        = now();
        v_new_current := 1;
    ELSIF v_last IS NULL OR v_last < v_today - INTERVAL '1 day' THEN
        -- Gap: reset streak. (Lazy reset — TODO: pg_cron job for nightly
        -- reset so reads see up-to-date streak even when user is inactive.)
        v_new_current := 1;
        UPDATE user_progress
           SET current_streak    = 1,
               longest_streak    = GREATEST(longest_streak, 1),
               last_lesson_date  = v_today,
               updated_at        = now()
         WHERE user_id = NEW.user_id;
    ELSIF v_last = v_today - INTERVAL '1 day' THEN
        -- Consecutive day: increment streak and award 5 XP keep-alive bonus.
        v_new_current := COALESCE(v_current, 0) + 1;
        UPDATE user_progress
           SET current_streak    = v_new_current,
               longest_streak    = GREATEST(longest_streak, v_new_current),
               last_lesson_date  = v_today,
               updated_at        = now()
         WHERE user_id = NEW.user_id;

        INSERT INTO xp_events (user_id, amount, source_type, description, metadata)
        VALUES (
            NEW.user_id,
            5,
            'streak_bonus',
            'Ежедневный стрик ' || v_new_current || ' дн.',
            jsonb_build_object('streak_day', v_new_current, 'kind', 'keep_alive')
        );
    ELSE
        -- Same day: no-op for streak itself.
        v_new_current := v_current;
    END IF;

    -- 7-day milestone: doubles every 30 consecutive days.
    IF v_new_current > 0 AND v_new_current % 7 = 0 THEN
        v_milestone_mult := POWER(2, FLOOR(v_new_current / 30))::INT;
        v_milestone_amt  := 20 * v_milestone_mult;

        INSERT INTO xp_events (user_id, amount, source_type, description, metadata)
        VALUES (
            NEW.user_id,
            v_milestone_amt,
            'streak_bonus',
            '7-day milestone x' || v_milestone_mult || ' (streak ' || v_new_current || ')',
            jsonb_build_object(
                'streak_day', v_new_current,
                'kind',       'milestone',
                'multiplier', v_milestone_mult
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION apply_streak_on_xp_event()
    IS 'AFTER INSERT trigger on xp_events (skips streak_bonus rows). Maintains current_streak/longest_streak/last_lesson_date and inserts +5 XP keep-alive plus 7-day milestone bonuses (20 XP, doubling every 30 consecutive days).';

DROP TRIGGER IF EXISTS trg_xp_events_streak ON xp_events;
CREATE TRIGGER trg_xp_events_streak
    AFTER INSERT ON xp_events
    FOR EACH ROW
    EXECUTE FUNCTION apply_streak_on_xp_event();
