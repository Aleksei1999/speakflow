-- ==========================================================
-- 20260901020000 · group-chat-attachments storage bucket
-- ==========================================================
-- Bucket для файлов в групповом чате. Отделён от `chat-attachments`
-- (там путь {teacher_id}/{student_id}/..., RLS на этих сегментах —
-- не работает для групп). Путь: {group_id}/{uuid}-{safename}.
-- Bucket приватный, доступ через signed URLs (аналогично 1:1 чату).
--
-- RLS уровня storage.objects: read/insert разрешены участнику группы,
-- проверяем через SQL-функцию is_group_participant() (создана в
-- миграции 20260831 group_messages).
-- ==========================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-chat-attachments',
  'group-chat-attachments',
  false,
  26214400, -- 25 MiB, как у 1:1 chat-attachments
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

-- ---------- RLS ----------
-- INSERT: первый сегмент name = group_id, юзер должен быть участником.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='group_chat_attach_insert_participant'
  ) THEN
    CREATE POLICY group_chat_attach_insert_participant ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'group-chat-attachments'
        AND auth.uid() IS NOT NULL
        AND is_group_participant(
          ((storage.foldername(name))[1])::uuid,
          auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='group_chat_attach_read_participant'
  ) THEN
    CREATE POLICY group_chat_attach_read_participant ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'group-chat-attachments'
        AND is_group_participant(
          ((storage.foldername(name))[1])::uuid,
          auth.uid()
        )
      );
  END IF;
END $$;
