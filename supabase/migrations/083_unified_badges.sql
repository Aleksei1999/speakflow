-- 083_unified_badges.sql
-- =====================================================================
-- Unified in-platform badge counters: one row = one unread event for one
-- user in one category. Powers sidebar nav badges across student/teacher/
-- admin dashboards.
--
-- Why a NEW table instead of extending public.notifications (005)?
--   - 005 `notifications` is used by the outbox/email-Telegram fan-out
--     and has columns (channel, title, body) that don't fit a click-to-
--     navigate badge model. Mixing both concepts risks breaking outbox
--     consumers and bloats RLS.
--   - 037 `notifications_queue` is the *send* queue (email/TG); badges
--     are *read* state in-app. Separation keeps each system simple.
--
-- Surface area added:
--   table  public.notification_badges                  — one unread row
--   index  notification_badges_unread_idx              — fast unread lookup
--   index  notification_badges_user_created_idx        — debug/admin list
--   rpc    public.notifications_emit(...)              — used by triggers
--   rpc    public.notifications_mark_seen(...)         — called by API
--   rpc    public.notifications_unread_counts(...)     — called by API
--
-- Triggers added (see section 4):
--   trg_nb_lesson_insert         on public.lessons        AFTER INSERT
--   trg_nb_lesson_update         on public.lessons        AFTER UPDATE
--   trg_nb_homework_insert       on public.homework       AFTER INSERT
--   trg_nb_homework_update       on public.homework       AFTER UPDATE
--   trg_nb_material_shares       on public.material_shares AFTER INSERT
--   trg_nb_support_msg           on public.support_messages AFTER INSERT
--   trg_nb_trial_request         on public.trial_lesson_requests AFTER INSERT
--   trg_nb_user_signup           on public.profiles       AFTER INSERT
--   trg_nb_user_reward           on public.user_rewards   AFTER INSERT
--
-- All triggers go through public.notifications_emit() — a SECURITY DEFINER
-- helper that bypasses RLS for inserts (callers are anon/auth users
-- performing legitimate writes; only the row owner can ever read it).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_badges (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category     TEXT NOT NULL,        -- 'schedule' | 'homework' | 'materials' | 'achievements' | 'support' | 'clubs' | 'students' | 'users' | 'trial_requests'
    event_type   TEXT NOT NULL,        -- 'lesson_booked' | 'homework_assigned' | ...
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_url   TEXT,                 -- optional deep-link the UI may use
    seen_at      TIMESTAMPTZ,          -- NULL == unread
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot path: "give me unread counts for user X grouped by category".
-- Partial index keeps the hot set tiny even as historical rows accumulate.
CREATE INDEX IF NOT EXISTS notification_badges_unread_idx
    ON public.notification_badges (user_id, category)
    WHERE seen_at IS NULL;

-- Cold path / debug.
CREATE INDEX IF NOT EXISTS notification_badges_user_created_idx
    ON public.notification_badges (user_id, created_at DESC);

ALTER TABLE public.notification_badges ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2. RLS — users see only their own; admins see all
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS nb_select_own ON public.notification_badges;
CREATE POLICY nb_select_own
    ON public.notification_badges
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
             WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- No INSERT/UPDATE/DELETE policies for authenticated:
--   - Inserts go through public.notifications_emit (SECURITY DEFINER) from triggers.
--   - Mark-seen goes through public.notifications_mark_seen (SECURITY DEFINER).
--   - service_role bypasses RLS entirely.

-- ---------------------------------------------------------------------
-- 3. RPCs
-- ---------------------------------------------------------------------

-- notifications_emit — used internally by triggers and edge functions.
-- NOT exposed to anon/authenticated EXECUTE (REVOKE below).
CREATE OR REPLACE FUNCTION public.notifications_emit(
    p_user_id    UUID,
    p_category   TEXT,
    p_event_type TEXT,
    p_payload    JSONB DEFAULT '{}'::jsonb,
    p_target_url TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF p_user_id IS NULL OR p_category IS NULL OR p_event_type IS NULL THEN
        RETURN NULL;
    END IF;
    INSERT INTO public.notification_badges
        (user_id, category, event_type, payload, target_url)
    VALUES
        (p_user_id, p_category, p_event_type,
         COALESCE(p_payload, '{}'::jsonb), p_target_url)
    RETURNING id INTO v_id;
    RETURN v_id;
EXCEPTION WHEN OTHERS THEN
    -- Never block a real write because the badge insert failed.
    -- We swallow and let the underlying business trigger succeed.
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notifications_emit(UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notifications_emit(UUID, TEXT, TEXT, JSONB, TEXT) FROM anon, authenticated;
-- service_role keeps EXECUTE by default; SECURITY DEFINER lets triggers run as owner.

-- notifications_mark_seen — caller is the receiving user; SECURITY DEFINER
-- guards the WHERE-clause to that user only.
CREATE OR REPLACE FUNCTION public.notifications_mark_seen(
    p_user_id  UUID,
    p_category TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    -- Only the user themselves (or service_role via bypass) can mark seen.
    IF auth.uid() IS DISTINCT FROM p_user_id AND auth.uid() IS NOT NULL THEN
        -- Allow admin override.
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
             WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            RETURN 0;
        END IF;
    END IF;

    UPDATE public.notification_badges
       SET seen_at = now()
     WHERE user_id = p_user_id
       AND seen_at IS NULL
       AND (p_category IS NULL OR category = p_category);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notifications_mark_seen(UUID, TEXT) TO authenticated;

-- notifications_unread_counts — returns jsonb { category: count, ... }.
CREATE OR REPLACE FUNCTION public.notifications_unread_counts(
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Only the user themselves (or admin) may query counts. Avoids
    -- enumeration of other users' notification activity.
    IF auth.uid() IS DISTINCT FROM p_user_id AND auth.uid() IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
             WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            RETURN '{}'::jsonb;
        END IF;
    END IF;

    SELECT COALESCE(
             jsonb_object_agg(category, cnt),
             '{}'::jsonb
           )
      INTO v_result
      FROM (
            SELECT category, COUNT(*)::int AS cnt
              FROM public.notification_badges
             WHERE user_id = p_user_id
               AND seen_at IS NULL
             GROUP BY category
           ) s;

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notifications_unread_counts(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------

-- ---- 4.1 LESSONS: INSERT ----
-- When a lesson is created with status='booked' (or 'pending_payment'),
-- notify the *opposite* party. If teacher inserted (e.g. teacher booking
-- a lesson FOR a student), the student gets the badge; if student
-- inserted (self-booking), the teacher gets the badge. The "current
-- actor" is captured via auth.uid() — when NULL (cron/service_role),
-- we notify the student by default (teacher-initiated bookings are
-- the common system-level path).
CREATE OR REPLACE FUNCTION public.nb_lesson_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    IF NEW.status NOT IN ('booked', 'pending_payment', 'scheduled', 'confirmed') THEN
        RETURN NEW;
    END IF;

    -- Notify student about a new booking unless THEY did it.
    IF NEW.student_id IS NOT NULL AND NEW.student_id IS DISTINCT FROM v_actor THEN
        PERFORM public.notifications_emit(
            NEW.student_id,
            'schedule',
            'lesson_booked',
            jsonb_build_object(
                'lesson_id', NEW.id,
                'scheduled_at', NEW.scheduled_at,
                'teacher_id', NEW.teacher_id
            ),
            '/student/schedule'
        );
    END IF;

    -- Notify teacher about a new booking unless THEY did it.
    IF NEW.teacher_id IS NOT NULL AND NEW.teacher_id IS DISTINCT FROM v_actor THEN
        PERFORM public.notifications_emit(
            NEW.teacher_id,
            'schedule',
            'lesson_booked',
            jsonb_build_object(
                'lesson_id', NEW.id,
                'scheduled_at', NEW.scheduled_at,
                'student_id', NEW.student_id
            ),
            '/teacher/schedule'
        );

        -- First-ever lesson from this student? Surface as "new student".
        IF NOT EXISTS (
            SELECT 1 FROM public.lessons l
             WHERE l.teacher_id = NEW.teacher_id
               AND l.student_id = NEW.student_id
               AND l.id <> NEW.id
        ) THEN
            PERFORM public.notifications_emit(
                NEW.teacher_id,
                'students',
                'new_student',
                jsonb_build_object('student_id', NEW.student_id),
                '/teacher/students'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nb_lesson_insert ON public.lessons;
CREATE TRIGGER trg_nb_lesson_insert
    AFTER INSERT ON public.lessons
    FOR EACH ROW
    EXECUTE FUNCTION public.nb_lesson_inserted();

-- ---- 4.2 LESSONS: UPDATE (cancel / reschedule) ----
CREATE OR REPLACE FUNCTION public.nb_lesson_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    -- Cancellation transition.
    IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
        IF NEW.student_id IS NOT NULL AND NEW.student_id IS DISTINCT FROM v_actor THEN
            PERFORM public.notifications_emit(
                NEW.student_id, 'schedule', 'lesson_cancelled',
                jsonb_build_object('lesson_id', NEW.id, 'scheduled_at', NEW.scheduled_at),
                '/student/schedule'
            );
        END IF;
        IF NEW.teacher_id IS NOT NULL AND NEW.teacher_id IS DISTINCT FROM v_actor THEN
            PERFORM public.notifications_emit(
                NEW.teacher_id, 'schedule', 'lesson_cancelled',
                jsonb_build_object('lesson_id', NEW.id, 'scheduled_at', NEW.scheduled_at),
                '/teacher/schedule'
            );
        END IF;
    END IF;

    -- Reschedule (scheduled_at changed; status not cancelled).
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at AND NEW.status <> 'cancelled' THEN
        IF NEW.student_id IS NOT NULL AND NEW.student_id IS DISTINCT FROM v_actor THEN
            PERFORM public.notifications_emit(
                NEW.student_id, 'schedule', 'lesson_rescheduled',
                jsonb_build_object('lesson_id', NEW.id, 'scheduled_at', NEW.scheduled_at),
                '/student/schedule'
            );
        END IF;
        IF NEW.teacher_id IS NOT NULL AND NEW.teacher_id IS DISTINCT FROM v_actor THEN
            PERFORM public.notifications_emit(
                NEW.teacher_id, 'schedule', 'lesson_rescheduled',
                jsonb_build_object('lesson_id', NEW.id, 'scheduled_at', NEW.scheduled_at),
                '/teacher/schedule'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nb_lesson_update ON public.lessons;
CREATE TRIGGER trg_nb_lesson_update
    AFTER UPDATE OF status, scheduled_at ON public.lessons
    FOR EACH ROW
    EXECUTE FUNCTION public.nb_lesson_updated();

-- ---- 4.3 HOMEWORK: INSERT (assigned) ----
CREATE OR REPLACE FUNCTION public.nb_homework_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.student_id IS NULL THEN
        RETURN NEW;
    END IF;
    PERFORM public.notifications_emit(
        NEW.student_id, 'homework', 'homework_assigned',
        jsonb_build_object('homework_id', NEW.id, 'title', NEW.title, 'due_date', NEW.due_date),
        '/student/homework'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nb_homework_insert ON public.homework;
CREATE TRIGGER trg_nb_homework_insert
    AFTER INSERT ON public.homework
    FOR EACH ROW
    EXECUTE FUNCTION public.nb_homework_inserted();

-- ---- 4.4 HOMEWORK: UPDATE (submitted by student / graded by teacher) ----
CREATE OR REPLACE FUNCTION public.nb_homework_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Student submitted (status now 'submitted' OR submitted_at just set)
    IF (NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL)
       OR (NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted') THEN
        IF NEW.teacher_id IS NOT NULL THEN
            PERFORM public.notifications_emit(
                NEW.teacher_id, 'homework', 'homework_submitted',
                jsonb_build_object('homework_id', NEW.id, 'student_id', NEW.student_id),
                '/teacher/homework'
            );
        END IF;
    END IF;

    -- Teacher graded/reviewed (status -> reviewed, or grade just appeared)
    IF (NEW.status = 'reviewed' AND OLD.status IS DISTINCT FROM 'reviewed')
       OR (NEW.reviewed_at IS NOT NULL AND OLD.reviewed_at IS NULL)
       OR (NEW.grade IS NOT NULL AND OLD.grade IS NULL) THEN
        IF NEW.student_id IS NOT NULL THEN
            PERFORM public.notifications_emit(
                NEW.student_id, 'homework', 'homework_graded',
                jsonb_build_object('homework_id', NEW.id, 'grade', NEW.grade),
                '/student/homework'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nb_homework_update ON public.homework;
CREATE TRIGGER trg_nb_homework_update
    AFTER UPDATE OF status, submitted_at, reviewed_at, grade ON public.homework
    FOR EACH ROW
    EXECUTE FUNCTION public.nb_homework_updated();

-- ---- 4.5 MATERIAL_SHARES: INSERT ----
-- target_type='student' -> target_id IS a profile.id; for 'group' we
-- fan out to all teacher_group_members.
CREATE OR REPLACE FUNCTION public.nb_material_shared()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.target_type = 'student' AND NEW.target_id IS NOT NULL THEN
        PERFORM public.notifications_emit(
            NEW.target_id, 'materials', 'material_shared',
            jsonb_build_object('material_id', NEW.material_id),
            '/student/materials'
        );
    ELSIF NEW.target_type = 'group' AND NEW.target_id IS NOT NULL THEN
        PERFORM public.notifications_emit(
            m.student_id, 'materials', 'material_shared',
            jsonb_build_object('material_id', NEW.material_id, 'group_id', NEW.target_id),
            '/student/materials'
        )
        FROM public.teacher_group_members m
        WHERE m.group_id = NEW.target_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nb_material_shares ON public.material_shares;
CREATE TRIGGER trg_nb_material_shares
    AFTER INSERT ON public.material_shares
    FOR EACH ROW
    EXECUTE FUNCTION public.nb_material_shared();

-- ---- 4.6 SUPPORT_MESSAGES: INSERT ----
-- Sender 'user' (student/teacher) -> notify all admins (category=support).
-- Sender 'admin' -> notify the thread owner.
CREATE OR REPLACE FUNCTION public.nb_support_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner UUID;
    v_owner_role TEXT;
BEGIN
    SELECT t.user_id, p.role
      INTO v_owner, v_owner_role
      FROM public.support_threads t
      LEFT JOIN public.profiles p ON p.id = t.user_id
     WHERE t.id = NEW.thread_id;

    IF NEW.sender_role = 'admin' THEN
        IF v_owner IS NOT NULL THEN
            PERFORM public.notifications_emit(
                v_owner, 'support', 'support_admin_reply',
                jsonb_build_object('thread_id', NEW.thread_id),
                CASE
                    WHEN v_owner_role = 'teacher' THEN '/teacher/support'
                    ELSE '/student/support'
                END
            );
        END IF;
    ELSE
        -- User-side message → notify every admin.
        PERFORM public.notifications_emit(
            p.id, 'support', 'support_new_message',
            jsonb_build_object('thread_id', NEW.thread_id),
            '/admin/support'
        )
        FROM public.profiles p
        WHERE p.role = 'admin' AND p.is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nb_support_msg ON public.support_messages;
CREATE TRIGGER trg_nb_support_msg
    AFTER INSERT ON public.support_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.nb_support_message();

-- ---- 4.7 TRIAL_LESSON_REQUESTS: INSERT (admin notification) ----
CREATE OR REPLACE FUNCTION public.nb_trial_request_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.notifications_emit(
        p.id, 'trial_requests', 'trial_request_new',
        jsonb_build_object('request_id', NEW.id, 'user_id', NEW.user_id),
        '/admin/trial-requests'
    )
    FROM public.profiles p
    WHERE p.role = 'admin' AND p.is_active = TRUE;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nb_trial_request ON public.trial_lesson_requests;
CREATE TRIGGER trg_nb_trial_request
    AFTER INSERT ON public.trial_lesson_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.nb_trial_request_inserted();

-- ---- 4.8 PROFILES: INSERT (new student signup) ----
CREATE OR REPLACE FUNCTION public.nb_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role <> 'student' THEN
        RETURN NEW;
    END IF;
    PERFORM public.notifications_emit(
        p.id, 'users', 'user_signed_up',
        jsonb_build_object('new_user_id', NEW.id, 'email', NEW.email),
        '/admin/students'
    )
    FROM public.profiles p
    WHERE p.role = 'admin' AND p.is_active = TRUE AND p.id <> NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nb_user_signup ON public.profiles;
CREATE TRIGGER trg_nb_user_signup
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.nb_user_signup();

-- ---- 4.9 USER_REWARDS: INSERT (unclaimed reward → achievements badge) ----
CREATE OR REPLACE FUNCTION public.nb_user_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;
    -- Only when reward is freshly awarded and not yet fulfilled.
    IF NEW.status = 'awarded' AND NEW.fulfilled_at IS NULL THEN
        PERFORM public.notifications_emit(
            NEW.user_id, 'achievements', 'reward_unclaimed',
            jsonb_build_object('user_reward_id', NEW.id, 'reward_id', NEW.reward_id),
            '/student/achievements'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nb_user_reward ON public.user_rewards;
CREATE TRIGGER trg_nb_user_reward
    AFTER INSERT ON public.user_rewards
    FOR EACH ROW
    EXECUTE FUNCTION public.nb_user_reward();

COMMIT;
