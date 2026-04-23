-- 034_mimes_and_homework_bucket.sql
-- Part 1: extend allowed_mime_types for `teacher-materials` bucket so that
--         iPhone HEIC photos, AVIF images and common audio formats are accepted.
-- Part 2: create new `homework-submissions` bucket (private) used by students
--         when attaching files to homework submissions.

-- ============================================================
-- 1. Extend teacher-materials bucket mime whitelist
-- ============================================================
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
        -- PDFs
        'application/pdf',
        -- Presentations
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        -- Documents
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/rtf',
        'text/plain',
        -- Spreadsheets
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        -- Images (incl. iPhone HEIC/HEIF + modern AVIF)
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        'image/heic',
        'image/heif',
        'image/avif',
        -- Audio
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/mp4',
        'audio/webm',
        'audio/x-m4a',
        'audio/m4a',
        'audio/aac',
        'audio/flac',
        -- Video
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo'
   ]
 WHERE id = 'teacher-materials';

-- ============================================================
-- 2. Create homework-submissions bucket (PRIVATE, signed URLs)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'homework-submissions',
    'homework-submissions',
    false,
    52428800, -- 50 MB per file
    ARRAY[
        -- PDFs / documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/rtf',
        'text/plain',
        -- Images
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        'image/heic',
        'image/heif',
        'image/avif',
        -- Audio
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/mp4',
        'audio/webm',
        'audio/x-m4a',
        'audio/m4a',
        'audio/aac',
        'audio/flac',
        -- Video
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo'
    ]
)
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 3. RLS on storage.objects for homework-submissions
-- File layout: `<auth_uid>/<homework_id>/<timestamp>_<safe_filename>`
-- ============================================================

-- Owner SELECT: students can read their own uploads
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='homework-submissions_owner_select'
    ) THEN
        CREATE POLICY "homework-submissions_owner_select"
            ON storage.objects
            FOR SELECT
            USING (
                bucket_id = 'homework-submissions'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 1) = auth.uid()::text
            );
    END IF;
END $$;

-- Owner INSERT: students upload into their own folder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='homework-submissions_owner_insert'
    ) THEN
        CREATE POLICY "homework-submissions_owner_insert"
            ON storage.objects
            FOR INSERT
            WITH CHECK (
                bucket_id = 'homework-submissions'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 1) = auth.uid()::text
            );
    END IF;
END $$;

-- Owner UPDATE (rare, but supported for upsert scenarios)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='homework-submissions_owner_update'
    ) THEN
        CREATE POLICY "homework-submissions_owner_update"
            ON storage.objects
            FOR UPDATE
            USING (
                bucket_id = 'homework-submissions'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 1) = auth.uid()::text
            )
            WITH CHECK (
                bucket_id = 'homework-submissions'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 1) = auth.uid()::text
            );
    END IF;
END $$;

-- Owner DELETE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='homework-submissions_owner_delete'
    ) THEN
        CREATE POLICY "homework-submissions_owner_delete"
            ON storage.objects
            FOR DELETE
            USING (
                bucket_id = 'homework-submissions'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 1) = auth.uid()::text
            );
    END IF;
END $$;

-- Teacher SELECT: teachers can read submissions for homework they assigned.
-- File layout encodes the homework id as the 2nd path segment, which we join
-- against the `homework` table to validate ownership via teacher_id.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='homework-submissions_teacher_select'
    ) THEN
        CREATE POLICY "homework-submissions_teacher_select"
            ON storage.objects
            FOR SELECT
            USING (
                bucket_id = 'homework-submissions'
                AND auth.uid() IS NOT NULL
                AND EXISTS (
                    SELECT 1
                      FROM homework h
                      JOIN teacher_profiles tp ON tp.id = h.teacher_id
                     WHERE tp.user_id = auth.uid()
                       AND h.id::text = split_part(storage.objects.name, '/', 2)
                )
            );
    END IF;
END $$;
