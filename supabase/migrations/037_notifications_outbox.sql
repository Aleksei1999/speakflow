-- 037_notifications_outbox.sql
-- Outbox queue + triggers for async notification delivery.
--
-- Table:   public.notifications_queue
-- Triggers:
--   trg_nq_new_club           — after insert on public.clubs      -> fan-out to all students opted in
--   trg_nq_achievement_unlock — after insert on public.user_achievements
--   trg_nq_level_up           — after update on public.user_progress (current_level changes)
--
-- A separate drain endpoint (POST /api/internal/notifications/drain) is invoked
-- by Vercel Cron and actually ships notifications via sendNotification() using
-- the service_role admin client. RLS on the queue is enabled with NO policies
-- for authenticated, so only service_role can touch it.

BEGIN;

-- ==========================================================
-- 1. Queue table
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.notifications_queue (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    error        TEXT,
    retries      INT NOT NULL DEFAULT 0
);

-- Pending-first index for the drain worker.
CREATE INDEX IF NOT EXISTS notifications_queue_pending_idx
    ON public.notifications_queue (processed_at NULLS FIRST, created_at)
    WHERE processed_at IS NULL;

-- Per-user lookup (useful for debugging / dashboards).
CREATE INDEX IF NOT EXISTS notifications_queue_user_idx
    ON public.notifications_queue (user_id, created_at DESC);

ALTER TABLE public.notifications_queue ENABLE ROW LEVEL SECURITY;
-- No policies: authenticated/anon cannot read or write.
-- Only service_role (admin client) bypasses RLS.

-- ==========================================================
-- 2. Trigger: new club fan-out
-- ==========================================================
-- On INSERT of a published, non-cancelled club, enqueue a `new_club`
-- notification for every student who has notification_prefs->>'new_clubs'
-- not equal to 'false' (NULL/missing is treated as opted-in per defaults).
--
-- Host name is taken from the first club_hosts entry; if none yet, fall
-- back to the creator's full_name (created_by). Club info from NEW row.

CREATE OR REPLACE FUNCTION public.nq_enqueue_new_club()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_name TEXT;
BEGIN
    -- Skip drafts / cancelled inserts.
    IF NEW.is_published IS DISTINCT FROM TRUE OR NEW.cancelled_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Prefer first assigned host by sort_order, fall back to created_by profile.
    SELECT COALESCE(p.full_name, p.email)
      INTO v_host_name
      FROM public.club_hosts h
      JOIN public.profiles p ON p.id = h.host_id
     WHERE h.club_id = NEW.id
     ORDER BY h.sort_order ASC
     LIMIT 1;

    IF v_host_name IS NULL AND NEW.created_by IS NOT NULL THEN
        SELECT COALESCE(p.full_name, p.email)
          INTO v_host_name
          FROM public.profiles p
         WHERE p.id = NEW.created_by
         LIMIT 1;
    END IF;

    INSERT INTO public.notifications_queue (user_id, type, payload)
    SELECT
        p.id,
        'new_club',
        jsonb_build_object(
            'club_id',   NEW.id,
            'title',     NEW.topic,
            'start_at',  NEW.starts_at,
            'host_name', v_host_name
        )
      FROM public.profiles p
     WHERE p.role = 'student'
       AND p.is_active = TRUE
       AND COALESCE( (p.notification_prefs->>'new_clubs')::boolean , TRUE ) = TRUE;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nq_new_club ON public.clubs;
CREATE TRIGGER trg_nq_new_club
    AFTER INSERT ON public.clubs
    FOR EACH ROW
    EXECUTE FUNCTION public.nq_enqueue_new_club();

-- ==========================================================
-- 3. Trigger: achievement unlocked
-- ==========================================================
-- On INSERT into user_achievements, look up the achievement definition
-- and enqueue an `achievement_unlocked` notification, but only if the
-- user hasn't disabled achievement notifications.

CREATE OR REPLACE FUNCTION public.nq_enqueue_achievement_unlocked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_opted_in BOOLEAN;
    v_title       TEXT;
    v_description TEXT;
    v_icon        TEXT;
    v_xp_reward   INT;
BEGIN
    SELECT COALESCE( (notification_prefs->>'achievements')::boolean , TRUE )
      INTO v_opted_in
      FROM public.profiles
     WHERE id = NEW.user_id;

    IF v_opted_in IS DISTINCT FROM TRUE THEN
        RETURN NEW;
    END IF;

    SELECT title, description, icon_emoji, xp_reward
      INTO v_title, v_description, v_icon, v_xp_reward
      FROM public.achievement_definitions
     WHERE id = NEW.achievement_id;

    INSERT INTO public.notifications_queue (user_id, type, payload)
    VALUES (
        NEW.user_id,
        'achievement_unlocked',
        jsonb_build_object(
            'achievement_id', NEW.achievement_id,
            'title',          v_title,
            'description',    v_description,
            'icon',           v_icon,
            'xp_reward',      v_xp_reward
        )
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nq_achievement_unlocked ON public.user_achievements;
CREATE TRIGGER trg_nq_achievement_unlocked
    AFTER INSERT ON public.user_achievements
    FOR EACH ROW
    EXECUTE FUNCTION public.nq_enqueue_achievement_unlocked();

-- ==========================================================
-- 4. Trigger: level up
-- ==========================================================
-- NOTE: profiles has no `level` column — levels live on
-- public.user_progress.current_level (see migration 006).
-- So the level-up trigger fires on UPDATE of user_progress when
-- current_level strictly increases.
-- Honours the same `achievements` pref toggle (level up is an
-- achievement-class notification).

CREATE OR REPLACE FUNCTION public.nq_enqueue_level_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_opted_in BOOLEAN;
BEGIN
    IF NEW.current_level IS NULL OR OLD.current_level IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.current_level <= OLD.current_level THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE( (notification_prefs->>'achievements')::boolean , TRUE )
      INTO v_opted_in
      FROM public.profiles
     WHERE id = NEW.user_id;

    IF v_opted_in IS DISTINCT FROM TRUE THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.notifications_queue (user_id, type, payload)
    VALUES (
        NEW.user_id,
        'level_up',
        jsonb_build_object(
            'new_level', NEW.current_level,
            'total_xp',  NEW.total_xp
        )
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nq_level_up ON public.user_progress;
CREATE TRIGGER trg_nq_level_up
    AFTER UPDATE OF current_level ON public.user_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.nq_enqueue_level_up();

COMMIT;
