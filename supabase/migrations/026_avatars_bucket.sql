-- 026_avatars_bucket.sql
-- Creates the `avatars` Storage bucket used by /student/settings avatar upload
-- and adds RLS so a user can only write to their own avatar path (`avatars/<uid>.ext`).
-- Bucket is public-read so avatar_url works in <img src> everywhere.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for avatars.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_public_read'
    ) THEN
        CREATE POLICY avatars_public_read
            ON storage.objects
            FOR SELECT
            USING (bucket_id = 'avatars');
    END IF;
END $$;

-- Owners can upload/update/delete their own avatar. We match on the file path
-- containing their uid: storage path is `avatars/<uid>.<ext>`, so the first
-- path segment after the bucket root (`name`) starts with the user's UID.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_write'
    ) THEN
        CREATE POLICY avatars_owner_write
            ON storage.objects
            FOR INSERT
            WITH CHECK (
                bucket_id = 'avatars'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 2) LIKE auth.uid()::text || '.%'
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_update'
    ) THEN
        CREATE POLICY avatars_owner_update
            ON storage.objects
            FOR UPDATE
            USING (
                bucket_id = 'avatars'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 2) LIKE auth.uid()::text || '.%'
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_delete'
    ) THEN
        CREATE POLICY avatars_owner_delete
            ON storage.objects
            FOR DELETE
            USING (
                bucket_id = 'avatars'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 2) LIKE auth.uid()::text || '.%'
            );
    END IF;
END $$;
