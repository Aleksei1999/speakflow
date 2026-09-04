-- ==========================================================
-- 20260830140000 · chat_messages: multiparty (teacher/student/admin)
-- ==========================================================
-- Расширяет 1:1-чат с (teacher↔student) до (teacher↔student, admin↔teacher,
-- admin↔student). Названия колонок `teacher_id`/`student_id` сохраняются, но
-- теперь семантически это «слот A» и «слот B». Роль занимающего слот
-- определяется через profiles.role.
--
-- Правило распределения слотов (клиентская логика в src/lib/chat/slot.ts):
--   приоритет teacher > admin > student, приоритетнее — в teacher_id.
--   Итог: teacher↔student → teacher_id=teacher, student_id=student.
--        admin↔teacher   → teacher_id=teacher, student_id=admin.
--        admin↔student   → teacher_id=admin,   student_id=student.
--
-- Read-tracking: одна колонка read_at недостаточна — теперь у каждой из двух
-- сторон свой timestamp прочтения. read_at_slot_a — прочла сторона в
-- teacher_id, read_at_slot_b — в student_id.
--
-- sender_id — денормализуем «кто написал» из sender_role, чтобы SELECT
-- непрочитанных мог тривиально фильтровать по `sender_id != me`.
-- sender_role остаётся для UI (быстрая отрисовка без JOIN на profiles).
-- ==========================================================

-- 1. CHECK: разрешаем 'admin'
ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chat_messages_sender_role_check;
ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_sender_role_check
    CHECK (sender_role IN ('teacher','student','admin'));

-- 2. sender_id (nullable → backfill → NOT NULL)
ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

UPDATE chat_messages
SET sender_id = CASE sender_role
    WHEN 'teacher' THEN teacher_id
    WHEN 'student' THEN student_id
    -- admin-строк ещё нет, но на всякий случай — маппим по sender_role в один из слотов.
    -- До этой миграции admin не мог написать (CHECK), так что WHEN 'admin' сюда не попадёт.
    ELSE teacher_id
END
WHERE sender_id IS NULL;

ALTER TABLE chat_messages
    ALTER COLUMN sender_id SET NOT NULL;

-- Guard: sender_id должен быть одним из участников треда.
ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chat_messages_sender_is_participant;
ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_sender_is_participant
    CHECK (sender_id IN (teacher_id, student_id));

-- 3. Read-tracking: rename read_at → read_at_slot_a + add read_at_slot_b
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='chat_messages' AND column_name='read_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='chat_messages' AND column_name='read_at_slot_a'
    ) THEN
        ALTER TABLE chat_messages RENAME COLUMN read_at TO read_at_slot_a;
    END IF;
END $$;

ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS read_at_slot_b TIMESTAMPTZ NULL;

-- 4. Индексы: пересобираем под новую семантику (partial по каждому слоту).
DROP INDEX IF EXISTS idx_chat_messages_unread_by_teacher;
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_slot_a
    ON chat_messages (teacher_id, student_id)
    WHERE read_at_slot_a IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_slot_b
    ON chat_messages (teacher_id, student_id)
    WHERE read_at_slot_b IS NULL;

-- 5. RLS: старые «teacher/student»-политики выкидываем, вводим одну на роль-агностик участника.
DROP POLICY IF EXISTS chat_messages_select_teacher ON chat_messages;
DROP POLICY IF EXISTS chat_messages_select_student ON chat_messages;
DROP POLICY IF EXISTS chat_messages_insert_teacher ON chat_messages;
DROP POLICY IF EXISTS chat_messages_insert_student ON chat_messages;
DROP POLICY IF EXISTS chat_messages_update_teacher_read ON chat_messages;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_select_participant'
    ) THEN
        CREATE POLICY chat_messages_select_participant ON chat_messages
            FOR SELECT
            USING (
                auth.uid() = teacher_id
                OR auth.uid() = student_id
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_insert_participant'
    ) THEN
        -- INSERT: пишущий должен быть одним из участников И совпадать с sender_id.
        -- sender_role проверяется приложением (соответствие profile.role).
        CREATE POLICY chat_messages_insert_participant ON chat_messages
            FOR INSERT
            WITH CHECK (
                auth.uid() = sender_id
                AND (sender_id = teacher_id OR sender_id = student_id)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_update_participant'
    ) THEN
        -- UPDATE: любой участник треда может обновить (в приложении меняем ТОЛЬКО read_at_slot_*).
        CREATE POLICY chat_messages_update_participant ON chat_messages
            FOR UPDATE
            USING (
                auth.uid() = teacher_id OR auth.uid() = student_id
            )
            WITH CHECK (
                auth.uid() = teacher_id OR auth.uid() = student_id
            );
    END IF;
END $$;

-- 6. Storage bucket policies: старые role-based снимаем, ставим участник-based.
--    Путь остаётся {slot_a_id}/{slot_b_id}/{uuid}-{name} — обе стороны видят/грузят.
DROP POLICY IF EXISTS chat_attach_teacher_upload ON storage.objects;
DROP POLICY IF EXISTS chat_attach_student_upload ON storage.objects;
DROP POLICY IF EXISTS chat_attach_teacher_read ON storage.objects;
DROP POLICY IF EXISTS chat_attach_student_read ON storage.objects;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_attach_participant_upload'
    ) THEN
        CREATE POLICY chat_attach_participant_upload ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'chat-attachments'
                AND auth.uid() IS NOT NULL
                AND (
                    (storage.foldername(name))[1] = auth.uid()::text
                    OR (storage.foldername(name))[2] = auth.uid()::text
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_attach_participant_read'
    ) THEN
        CREATE POLICY chat_attach_participant_read ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'chat-attachments'
                AND (
                    (storage.foldername(name))[1] = auth.uid()::text
                    OR (storage.foldername(name))[2] = auth.uid()::text
                )
            );
    END IF;
END $$;
