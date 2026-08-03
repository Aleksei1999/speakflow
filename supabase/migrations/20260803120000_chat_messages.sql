-- ==========================================================
-- 20260803120000 · chat_messages: чат учитель↔ученик
-- ==========================================================
-- Отдельная от lesson_messages таблица: lesson_messages скоуплена
-- к конкретному lesson_id (эфемерный чат внутри урока), а
-- chat_messages — постоянный 1:1 чат teacher↔student, живущий
-- независимо от уроков.
--
-- FK на profiles(id): по проекту это единый auth-слой; в profiles.role
-- хранится 'teacher'/'student'/'admin'. Никаких отдельных
-- students/teachers таблиц с собственным PK нет — есть только
-- teacher_profiles (расширение), но чат должен работать и до того,
-- как teacher_profiles заведён.

CREATE TABLE IF NOT EXISTS chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_role     TEXT NOT NULL CHECK (sender_role IN ('teacher','student')),
    text            TEXT,
    attachment_url  TEXT,
    attachment_type TEXT CHECK (attachment_type IN ('image','video','document')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Хотя бы одно из полей должно быть непустым: либо текст, либо вложение.
    CONSTRAINT chat_messages_content_present CHECK (
        (text IS NOT NULL AND btrim(text) <> '')
        OR attachment_url IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread
    ON chat_messages (teacher_id, student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_student
    ON chat_messages (student_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ---------- RLS ----------
-- SELECT: учитель видит все свои треды; ученик — свои.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_select_teacher'
    ) THEN
        CREATE POLICY chat_messages_select_teacher ON chat_messages
            FOR SELECT
            USING (
                auth.uid() = teacher_id
                AND EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.role IN ('teacher','admin')
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_select_student'
    ) THEN
        CREATE POLICY chat_messages_select_student ON chat_messages
            FOR SELECT
            USING (
                auth.uid() = student_id
                AND EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.role = 'student'
                )
            );
    END IF;

    -- INSERT: teacher пишет как teacher, student — как student.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_insert_teacher'
    ) THEN
        CREATE POLICY chat_messages_insert_teacher ON chat_messages
            FOR INSERT
            WITH CHECK (
                sender_role = 'teacher'
                AND auth.uid() = teacher_id
                AND EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.role IN ('teacher','admin')
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_insert_student'
    ) THEN
        CREATE POLICY chat_messages_insert_student ON chat_messages
            FOR INSERT
            WITH CHECK (
                sender_role = 'student'
                AND auth.uid() = student_id
                AND EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.role = 'student'
                )
            );
    END IF;
END $$;

-- Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_messages'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
    END IF;
END $$;

-- ==========================================================
-- Storage bucket chat-attachments (private + signed URLs).
-- Путь: {teacher_id}/{student_id}/{uuid}-{filename}
-- ==========================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments',
    false,
    26214400, -- 25 MiB
    ARRAY[
        'image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/quicktime','video/webm',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ]
)
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- INSERT: учитель кладёт только под свой uid на 1-м сегменте пути.
-- Первый сегмент name = teacher_id, второй = student_id.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_attach_teacher_upload'
    ) THEN
        CREATE POLICY chat_attach_teacher_upload ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'chat-attachments'
                AND auth.uid() IS NOT NULL
                AND (storage.foldername(name))[1] = auth.uid()::text
                AND EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.role IN ('teacher','admin')
                )
            );
    END IF;

    -- INSERT: ученик тоже может грузить, но кладёт под своим id — используем
    -- альтернативную схему: student пишет в {teacher_id}/{student_id}/...
    -- и проверяем, что 2-й сегмент = его uid. Для симметрии.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_attach_student_upload'
    ) THEN
        CREATE POLICY chat_attach_student_upload ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'chat-attachments'
                AND auth.uid() IS NOT NULL
                AND (storage.foldername(name))[2] = auth.uid()::text
                AND EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.role = 'student'
                )
            );
    END IF;

    -- SELECT: учитель читает свои; ученик — свои. Проверяем по сегментам пути.
    -- Обход этого read-policy не критичен — приватный bucket + подписанные URL,
    -- но всё равно защищаем прямой /object/authenticated/... доступ.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_attach_teacher_read'
    ) THEN
        CREATE POLICY chat_attach_teacher_read ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'chat-attachments'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='chat_attach_student_read'
    ) THEN
        CREATE POLICY chat_attach_student_read ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'chat-attachments'
                AND (storage.foldername(name))[2] = auth.uid()::text
            );
    END IF;
END $$;
