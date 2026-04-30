-- ==========================================================
-- 041 · Support read-tracking (admin side)
-- Adds last_user_message_at + admin_last_seen_at on threads.
-- A thread is "unread for admin" when last_user_message_at IS NOT NULL
-- AND (admin_last_seen_at IS NULL OR admin_last_seen_at < last_user_message_at).
-- The trigger on support_messages also bumps last_user_message_at when
-- the message comes from a non-admin sender.
-- ==========================================================

ALTER TABLE public.support_threads
    ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_last_seen_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_support_threads_unread_admin
    ON public.support_threads (last_user_message_at, admin_last_seen_at);

-- Replace insert trigger to also track last_user_message_at.
CREATE OR REPLACE FUNCTION public.on_support_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.support_threads
       SET last_message_at = NEW.created_at,
           updated_at      = NEW.created_at,
           last_user_message_at = CASE
               WHEN NEW.sender_role IN ('student', 'teacher')
                    THEN NEW.created_at
               ELSE last_user_message_at
           END,
           status = CASE
               WHEN status IN ('resolved', 'closed') THEN status
               WHEN NEW.sender_role = 'admin' THEN 'pending'
               ELSE 'open'
           END
     WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.on_support_message_insert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_support_message_insert() TO authenticated, service_role;

-- One-shot backfill of last_user_message_at from existing messages.
UPDATE public.support_threads t
SET last_user_message_at = sub.last_user_at
FROM (
    SELECT thread_id, MAX(created_at) AS last_user_at
    FROM public.support_messages
    WHERE sender_role IN ('student', 'teacher')
    GROUP BY thread_id
) sub
WHERE sub.thread_id = t.id;

-- ==========================================================
-- RPC: mark thread as read by admin (sets admin_last_seen_at = now())
-- ==========================================================
CREATE OR REPLACE FUNCTION public.support_mark_thread_read(p_thread_id UUID)
RETURNS public.support_threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role TEXT;
    v_row public.support_threads;
BEGIN
    SELECT role INTO v_caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    UPDATE public.support_threads
       SET admin_last_seen_at = now()
     WHERE id = p_thread_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.support_mark_thread_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_mark_thread_read(UUID) TO authenticated;
