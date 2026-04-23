-- 035_support_system.sql
-- Support ticket system: threads + messages with RLS and realtime.
--
-- Model:
--   support_threads  — one per conversation (subject/status/priority/owner)
--   support_messages — messages posted by student/teacher/admin
--
-- Workflow:
--   - User (student/teacher) creates a thread → status='open'.
--   - Admin replies → trigger flips status='pending' (awaiting user).
--   - User replies again → trigger flips back to 'open' (awaiting admin).
--   - Admin can PATCH status to 'resolved' or 'closed' explicitly.

BEGIN;

-- ===================================================================
-- 1. Tables
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.support_threads (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject          TEXT,
    status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
    priority         TEXT NOT NULL DEFAULT 'med'
                     CHECK (priority IN ('low', 'med', 'high')),
    last_message_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_threads_user_id
    ON public.support_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_support_threads_last_msg
    ON public.support_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_status
    ON public.support_threads(status);

DROP TRIGGER IF EXISTS trg_support_threads_updated_at ON public.support_threads;
CREATE TRIGGER trg_support_threads_updated_at
    BEFORE UPDATE ON public.support_threads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.support_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id    UUID NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
    sender_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_role  TEXT NOT NULL
                 CHECK (sender_role IN ('student', 'teacher', 'admin')),
    body         TEXT NOT NULL CHECK (length(trim(body)) > 0),
    attachments  JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_thread
    ON public.support_messages(thread_id, created_at);

-- ===================================================================
-- 2. Helper: is_admin (SECURITY DEFINER avoids RLS recursion)
-- ===================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ===================================================================
-- 3. Trigger: on insert message → update thread metadata + flip status
-- ===================================================================

CREATE OR REPLACE FUNCTION public.on_support_message_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.support_threads
       SET last_message_at = NEW.created_at,
           updated_at      = NEW.created_at,
           status = CASE
               WHEN status IN ('resolved', 'closed') THEN status
               WHEN NEW.sender_role = 'admin' THEN 'pending'
               ELSE 'open'
           END
     WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_messages_after_insert ON public.support_messages;
CREATE TRIGGER trg_support_messages_after_insert
    AFTER INSERT ON public.support_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.on_support_message_insert();

-- ===================================================================
-- 4. RLS
-- ===================================================================

ALTER TABLE public.support_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- --- support_threads --------------------------------------------------

DROP POLICY IF EXISTS support_threads_select_own_or_admin ON public.support_threads;
CREATE POLICY support_threads_select_own_or_admin
    ON public.support_threads
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS support_threads_insert_own ON public.support_threads;
CREATE POLICY support_threads_insert_own
    ON public.support_threads
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS support_threads_update_admin ON public.support_threads;
CREATE POLICY support_threads_update_admin
    ON public.support_threads
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS support_threads_delete_admin ON public.support_threads;
CREATE POLICY support_threads_delete_admin
    ON public.support_threads
    FOR DELETE
    USING (public.is_admin());

-- --- support_messages -------------------------------------------------

-- SECURITY DEFINER: check if caller can see a given thread without
-- recursing through support_threads RLS from inside support_messages RLS.
CREATE OR REPLACE FUNCTION public.can_access_support_thread(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_threads t
    WHERE t.id = p_thread_id
      AND (t.user_id = auth.uid() OR public.is_admin())
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_support_thread(uuid) TO authenticated;

DROP POLICY IF EXISTS support_messages_select_thread_access ON public.support_messages;
CREATE POLICY support_messages_select_thread_access
    ON public.support_messages
    FOR SELECT
    USING (public.can_access_support_thread(thread_id));

DROP POLICY IF EXISTS support_messages_insert_thread_access ON public.support_messages;
CREATE POLICY support_messages_insert_thread_access
    ON public.support_messages
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND public.can_access_support_thread(thread_id)
    );

-- ===================================================================
-- 5. Realtime publication
-- ===================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'support_threads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'support_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
    END IF;
END $$;

COMMIT;
