-- ==========================================================
-- 20260831000000 · group_messages: групповой чат учителя + учеников
-- ==========================================================
-- Отдельная таблица от chat_messages (там 1:1 teacher↔student).
-- Одна строка = одно сообщение в группе teacher_groups.id.
-- Participants: teacher-owner + все teacher_group_members.student_id.
--
-- Правила видимости (RLS):
--   • владелец группы (teacher_profiles.user_id = auth.uid())
--   • ученик из teacher_group_members (student_id = auth.uid())
--   • admin (безусловно)
-- Кто может SELECT — тот же может INSERT (sender_id = auth.uid()).
--
-- group_message_reads: per-user last_read_at для расчёта unread.
-- ==========================================================

CREATE TABLE IF NOT EXISTS group_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES teacher_groups(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_role     TEXT NOT NULL CHECK (sender_role IN ('teacher','student','admin')),
    text            TEXT,
    attachment_url  TEXT,
    attachment_type TEXT CHECK (attachment_type IN ('image','video','document')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT group_messages_content_present CHECK (
        (text IS NOT NULL AND btrim(text) <> '')
        OR attachment_url IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group
    ON group_messages (group_id, created_at DESC);

-- ---------- Helper: is user a member (owner or student) of the group? ----------
CREATE OR REPLACE FUNCTION is_group_participant(gid UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
      EXISTS (
        SELECT 1 FROM teacher_groups tg
        JOIN teacher_profiles tp ON tp.id = tg.teacher_id
        WHERE tg.id = gid AND tp.user_id = uid
      )
      OR EXISTS (
        SELECT 1 FROM teacher_group_members m
        WHERE m.group_id = gid AND m.student_id = uid
      )
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = uid AND p.role = 'admin'
      );
$$;

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='group_messages' AND policyname='group_messages_select_participant'
    ) THEN
        CREATE POLICY group_messages_select_participant ON group_messages
            FOR SELECT
            USING (is_group_participant(group_id, auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='group_messages' AND policyname='group_messages_insert_participant'
    ) THEN
        CREATE POLICY group_messages_insert_participant ON group_messages
            FOR INSERT
            WITH CHECK (
                sender_id = auth.uid()
                AND is_group_participant(group_id, auth.uid())
            );
    END IF;
END $$;

-- Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='group_messages'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages';
    END IF;
END $$;

-- ==========================================================
-- group_message_reads: per-user last_read_at.
-- Обновляется когда user открывает групповой чат.
-- unread_count = COUNT(messages WHERE created_at > last_read_at AND sender_id != user)
-- ==========================================================

CREATE TABLE IF NOT EXISTS group_message_reads (
    group_id      UUID NOT NULL REFERENCES teacher_groups(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    last_read_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_message_reads_user
    ON group_message_reads (user_id);

ALTER TABLE group_message_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='group_message_reads' AND policyname='group_message_reads_own'
    ) THEN
        CREATE POLICY group_message_reads_own ON group_message_reads
            FOR ALL
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;
