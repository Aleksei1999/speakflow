-- 028_material_shares.sql
-- Adds teacher-owned groups of students and a generic share-target table that
-- lets teachers expose a single `materials` row to specific students, specific
-- homework rows, or whole groups. Extends RLS on `materials` and on the
-- `teacher-materials` storage bucket so those recipients can read.
--
-- Note: the existing policy `materials_select_public_or_participant`
-- (see 009_rls_policies.sql) is intentionally left in place. PostgreSQL
-- combines multiple permissive SELECT policies with OR, so
-- `materials_select_via_share` below only widens access — it never narrows it.

-- ============================================================
-- 1. teacher_groups
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_groups_teacher_recent
    ON teacher_groups(teacher_id, created_at DESC);

-- updated_at trigger (reuse pattern from 027)
CREATE OR REPLACE FUNCTION teacher_groups_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teacher_groups_updated_at ON teacher_groups;
CREATE TRIGGER trg_teacher_groups_updated_at
    BEFORE UPDATE ON teacher_groups
    FOR EACH ROW EXECUTE FUNCTION teacher_groups_set_updated_at();

-- ============================================================
-- 2. teacher_group_members
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_group_members (
    group_id   UUID NOT NULL REFERENCES teacher_groups(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_group_members_student
    ON teacher_group_members(student_id, group_id);

-- ============================================================
-- 3. material_shares
-- ============================================================
CREATE TABLE IF NOT EXISTS material_shares (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('student','homework','group')),
    target_id   UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (material_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_material_shares_material
    ON material_shares(material_id);

CREATE INDEX IF NOT EXISTS idx_material_shares_target
    ON material_shares(target_type, target_id);

-- ============================================================
-- 4. RLS — teacher_groups
-- ============================================================
ALTER TABLE teacher_groups ENABLE ROW LEVEL SECURITY;

-- Owner sees everything; a student sees groups they are a member of.
CREATE POLICY "teacher_groups_select_owner_or_member"
    ON teacher_groups FOR SELECT
    USING (
        teacher_id = get_teacher_profile_id()
        OR EXISTS (
            SELECT 1 FROM teacher_group_members m
             WHERE m.group_id = teacher_groups.id
               AND m.student_id = auth.uid()
        )
    );

CREATE POLICY "teacher_groups_insert_owner"
    ON teacher_groups FOR INSERT
    WITH CHECK (teacher_id = get_teacher_profile_id());

CREATE POLICY "teacher_groups_update_owner"
    ON teacher_groups FOR UPDATE
    USING (teacher_id = get_teacher_profile_id())
    WITH CHECK (teacher_id = get_teacher_profile_id());

CREATE POLICY "teacher_groups_delete_owner"
    ON teacher_groups FOR DELETE
    USING (teacher_id = get_teacher_profile_id());

-- ============================================================
-- 5. RLS — teacher_group_members
-- ============================================================
ALTER TABLE teacher_group_members ENABLE ROW LEVEL SECURITY;

-- Owner of the parent group, or the student who is the member themselves.
CREATE POLICY "teacher_group_members_select_owner_or_self"
    ON teacher_group_members FOR SELECT
    USING (
        student_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM teacher_groups g
             WHERE g.id = teacher_group_members.group_id
               AND g.teacher_id = get_teacher_profile_id()
        )
    );

CREATE POLICY "teacher_group_members_insert_owner"
    ON teacher_group_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM teacher_groups g
             WHERE g.id = teacher_group_members.group_id
               AND g.teacher_id = get_teacher_profile_id()
        )
    );

CREATE POLICY "teacher_group_members_delete_owner"
    ON teacher_group_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM teacher_groups g
             WHERE g.id = teacher_group_members.group_id
               AND g.teacher_id = get_teacher_profile_id()
        )
    );

-- ============================================================
-- 6. RLS — material_shares
-- ============================================================
ALTER TABLE material_shares ENABLE ROW LEVEL SECURITY;

-- Teacher-owner of the material sees every share. Recipients see only shares
-- whose target resolves back to them (student / homework owner / group member).
CREATE POLICY "material_shares_select_owner_or_recipient"
    ON material_shares FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM materials m
             WHERE m.id = material_shares.material_id
               AND m.teacher_id = get_teacher_profile_id()
        )
        OR (
            target_type = 'student'
            AND target_id = auth.uid()
        )
        OR (
            target_type = 'group'
            AND EXISTS (
                SELECT 1 FROM teacher_group_members gm
                 WHERE gm.group_id = material_shares.target_id
                   AND gm.student_id = auth.uid()
            )
        )
        OR (
            target_type = 'homework'
            AND EXISTS (
                SELECT 1 FROM homework h
                 WHERE h.id = material_shares.target_id
                   AND h.student_id = auth.uid()
            )
        )
    );

CREATE POLICY "material_shares_insert_owner"
    ON material_shares FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM materials m
             WHERE m.id = material_shares.material_id
               AND m.teacher_id = get_teacher_profile_id()
        )
    );

CREATE POLICY "material_shares_delete_owner"
    ON material_shares FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM materials m
             WHERE m.id = material_shares.material_id
               AND m.teacher_id = get_teacher_profile_id()
        )
    );

-- ============================================================
-- 7. Widen `materials` SELECT via shares
-- Adds a NEW permissive policy. Multiple permissive SELECT policies
-- combine with OR — the original `materials_select_public_or_participant`
-- (public flag / lesson participant / owner / admin) stays intact.
-- ============================================================
CREATE POLICY "materials_select_via_share"
    ON materials FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM material_shares ms
             WHERE ms.material_id = materials.id
               AND (
                   (ms.target_type = 'student'
                    AND ms.target_id = auth.uid())
                   OR (ms.target_type = 'group' AND EXISTS (
                        SELECT 1 FROM teacher_group_members gm
                         WHERE gm.group_id = ms.target_id
                           AND gm.student_id = auth.uid()
                   ))
                   OR (ms.target_type = 'homework' AND EXISTS (
                        SELECT 1 FROM homework h
                         WHERE h.id = ms.target_id
                           AND h.student_id = auth.uid()
                   ))
               )
        )
    );

-- ============================================================
-- 8. Storage RLS — `teacher-materials` bucket, share-based read
-- Complements `teacher-materials_participant_select` from 027 with a
-- branch that also grants access when a share row points at the reader.
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='storage' AND tablename='objects'
          AND policyname='teacher-materials_shared_select'
    ) THEN
        CREATE POLICY "teacher-materials_shared_select"
            ON storage.objects
            FOR SELECT
            USING (
                bucket_id = 'teacher-materials'
                AND auth.uid() IS NOT NULL
                AND EXISTS (
                    SELECT 1
                      FROM materials m
                      JOIN material_shares ms ON ms.material_id = m.id
                     WHERE m.storage_path = storage.objects.name
                       AND (
                            (ms.target_type = 'student'
                             AND ms.target_id = auth.uid())
                            OR (ms.target_type = 'group' AND EXISTS (
                                SELECT 1 FROM teacher_group_members gm
                                 WHERE gm.group_id = ms.target_id
                                   AND gm.student_id = auth.uid()
                            ))
                            OR (ms.target_type = 'homework' AND EXISTS (
                                SELECT 1 FROM homework h
                                 WHERE h.id = ms.target_id
                                   AND h.student_id = auth.uid()
                            ))
                       )
                )
            );
    END IF;
END $$;
