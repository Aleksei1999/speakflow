-- 027_teacher_materials.sql
-- Extends the `materials` table with level/tags/use_count/storage metadata,
-- creates the private `teacher-materials` Storage bucket with RLS so teachers
-- manage their own files and students read materials attached to their lessons,
-- and adds the `increment_material_use` RPC for tracking attachments to lessons.

-- ============================================================
-- 1. Schema extension
-- ============================================================
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IS NULL OR level IN ('A1-A2','B1','B2','C1+')),
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS storage_path TEXT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION materials_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_materials_updated_at ON materials;
CREATE TRIGGER trg_materials_updated_at
    BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION materials_set_updated_at();

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_materials_teacher_recent
    ON materials(teacher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_materials_teacher_popular
    ON materials(teacher_id, use_count DESC);

CREATE INDEX IF NOT EXISTS idx_materials_tags_gin
    ON materials USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_materials_teacher_level
    ON materials(teacher_id, level)
    WHERE level IS NOT NULL;

-- ============================================================
-- 3. Storage bucket (PRIVATE)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'teacher-materials',
    'teacher-materials',
    false,
    52428800, -- 50 MB
    ARRAY[
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
        -- Spreadsheets (occasionally used by teachers)
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        -- Images
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        -- Audio
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'audio/mp4',
        'audio/webm',
        'audio/x-m4a',
        'audio/m4a',
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
-- 4. Storage RLS (bucket = 'teacher-materials')
-- File layout: `<auth_uid>/<timestamp>_<safe_filename>`
-- ============================================================

-- Owner SELECT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='teacher-materials_owner_select'
    ) THEN
        CREATE POLICY "teacher-materials_owner_select"
            ON storage.objects
            FOR SELECT
            USING (
                bucket_id = 'teacher-materials'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 1) = auth.uid()::text
            );
    END IF;
END $$;

-- Owner INSERT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='teacher-materials_owner_insert'
    ) THEN
        CREATE POLICY "teacher-materials_owner_insert"
            ON storage.objects
            FOR INSERT
            WITH CHECK (
                bucket_id = 'teacher-materials'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 1) = auth.uid()::text
            );
    END IF;
END $$;

-- Owner UPDATE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='teacher-materials_owner_update'
    ) THEN
        CREATE POLICY "teacher-materials_owner_update"
            ON storage.objects
            FOR UPDATE
            USING (
                bucket_id = 'teacher-materials'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 1) = auth.uid()::text
            )
            WITH CHECK (
                bucket_id = 'teacher-materials'
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
          AND policyname='teacher-materials_owner_delete'
    ) THEN
        CREATE POLICY "teacher-materials_owner_delete"
            ON storage.objects
            FOR DELETE
            USING (
                bucket_id = 'teacher-materials'
                AND auth.uid() IS NOT NULL
                AND split_part(name, '/', 1) = auth.uid()::text
            );
    END IF;
END $$;

-- Participant SELECT: a student may read a file when the corresponding
-- `materials` row is linked (via storage_path) to a lesson they attend.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='teacher-materials_participant_select'
    ) THEN
        CREATE POLICY "teacher-materials_participant_select"
            ON storage.objects
            FOR SELECT
            USING (
                bucket_id = 'teacher-materials'
                AND auth.uid() IS NOT NULL
                AND EXISTS (
                    SELECT 1
                      FROM materials m
                      JOIN lessons  l ON l.id = m.lesson_id
                     WHERE m.storage_path = storage.objects.name
                       AND l.student_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ============================================================
-- 5. RPC: increment_material_use
-- Only the owning teacher may call (RLS + explicit ownership check).
-- SECURITY DEFINER so we can update without a second trip through RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION increment_material_use(p_material_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_profile_id UUID;
    v_new_count          INT;
BEGIN
    -- Resolve caller's teacher profile
    SELECT id INTO v_teacher_profile_id
      FROM teacher_profiles
     WHERE user_id = auth.uid();

    IF v_teacher_profile_id IS NULL THEN
        RAISE EXCEPTION 'Not a teacher' USING ERRCODE = '42501';
    END IF;

    UPDATE materials
       SET use_count = use_count + 1
     WHERE id = p_material_id
       AND teacher_id = v_teacher_profile_id
    RETURNING use_count INTO v_new_count;

    IF v_new_count IS NULL THEN
        RAISE EXCEPTION 'Material not found or access denied' USING ERRCODE = '42501';
    END IF;

    RETURN v_new_count;
END;
$$;

REVOKE ALL ON FUNCTION increment_material_use(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_material_use(UUID) TO authenticated;
