-- ============================================================================
-- 072_storage_rls.sql — Storage RLS hardening
-- ============================================================================
-- Goal: переустановить policies на storage.objects per bucket с явным
-- разграничением read/write per role, опираясь на SECURITY DEFINER helpers
-- из миграций 030/031 (is_lesson_participant, is_admin, is_material_owner,
-- is_group_owner, is_group_member).
--
-- Buckets:
--   avatars              — public read, owner-only write (папка = {user_id}/…)
--   teacher-materials    — private, share-based
--   homework-submissions — private, lesson/owner-bound
--   lesson-recordings    — private, archival, INSERT только service role
--   lesson-files         — !! TODO/FIXME: bucket is public=true и consumers
--                          используют getPublicUrl().Не флипаем здесь чтобы
--                          не сломать UI — оставляем как есть, см. отчёт.
--
-- Layout reminders (см. src/):
--   avatars              {user_id}/avatar.<ext>
--   teacher-materials    {teacher_user_id}/{ts}_{name}
--   homework-submissions {student_user_id}/{homework_id}/{ts}_{name}
--   lesson-recordings    lessons/{lesson_id}/{recording_id}/{seq}.webm
--   lesson-files         lessons/{lesson_id}/{ts}-{slug}-{name}
-- ============================================================================

-- NB: RLS на storage.objects уже включён Supabase'ом. ALTER TABLE требует
-- ownership (supabase_storage_admin), CREATE/DROP POLICY и UPDATE buckets
-- работают из роли postgres (через apply_migration).
-- COMMENT ON POLICY также требует ownership, поэтому не используем.

-- ---------------------------------------------------------------------------
-- Bucket flags: всё private кроме avatars.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET public = TRUE  WHERE id = 'avatars';
UPDATE storage.buckets SET public = FALSE WHERE id = 'teacher-materials';
UPDATE storage.buckets SET public = FALSE WHERE id = 'homework-submissions';
UPDATE storage.buckets SET public = FALSE WHERE id = 'lesson-recordings';
-- FIXME(072): lesson-files остаётся public=true, потому что
-- src/components/lesson/lesson-room-client.tsx и /api/lesson/upload
-- сохраняют storage.publicUrl. Флипать private надо вместе с миграцией
-- consumers на signed URLs (отдельная задача).
-- UPDATE storage.buckets SET public = FALSE WHERE id = 'lesson-files';

-- ---------------------------------------------------------------------------
-- DROP старых политик (идемпотентно).
-- ---------------------------------------------------------------------------
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- BUCKET: avatars  (public read; owner-only write)
-- ============================================================================
-- Path: {user_id}/avatar.<ext>  → foldername[1] = user_id
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin override for moderation.
CREATE POLICY "avatars_admin_all"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'avatars' AND public.is_admin())
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());

-- ============================================================================
-- BUCKET: teacher-materials  (private, share-based)
-- ============================================================================
-- Path: {teacher_user_id}/{ts}_{name}  → foldername[1] = teacher_user_id

-- SELECT: owner (uploader teacher) — top-level folder совпадает с auth.uid().
CREATE POLICY "tm_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'teacher-materials'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: student который участвует в уроке к которому привязан material.
-- Использует materials.storage_path = objects.name (точное совпадение).
CREATE POLICY "tm_lesson_participant_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'teacher-materials'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.storage_path = objects.name
        AND m.lesson_id IS NOT NULL
        AND public.is_lesson_participant(m.lesson_id)
    )
  );

-- SELECT: student/teacher c material_share (student | group | homework).
CREATE POLICY "tm_shared_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'teacher-materials'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.materials m
      JOIN public.material_shares ms ON ms.material_id = m.id
      WHERE m.storage_path = objects.name
        AND (
          (ms.target_type = 'student' AND ms.target_id = auth.uid())
          OR (ms.target_type = 'group' AND public.is_group_member(ms.target_id))
          OR (ms.target_type = 'homework' AND EXISTS (
                SELECT 1 FROM public.homework h
                WHERE h.id = ms.target_id
                  AND (h.student_id = auth.uid() OR public.is_lesson_participant(h.lesson_id))
              ))
        )
    )
  );

-- SELECT: admin — для moderation/support.
CREATE POLICY "tm_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'teacher-materials'
    AND public.is_admin()
  );

-- WRITE: только teacher или admin, и только в свою папку (либо admin везде).
CREATE POLICY "tm_teacher_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'teacher-materials'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('teacher','admin')
    )
  );

CREATE POLICY "tm_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'teacher-materials'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'teacher-materials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "tm_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'teacher-materials'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "tm_admin_write"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'teacher-materials' AND public.is_admin())
  WITH CHECK (bucket_id = 'teacher-materials' AND public.is_admin());

-- ============================================================================
-- BUCKET: homework-submissions  (private, lesson/owner-bound)
-- ============================================================================
-- Path: {student_user_id}/{homework_id}/{ts}_{name}
-- foldername[1] = student_user_id, foldername[2] = homework_id

-- SELECT: владелец файла (student который загрузил).
CREATE POLICY "hw_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'homework-submissions'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: teacher урока к которому привязана homework.
CREATE POLICY "hw_teacher_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'homework-submissions'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.homework h
      WHERE h.id::text = (storage.foldername(objects.name))[2]
        AND public.is_lesson_participant(h.lesson_id)
    )
  );

-- SELECT: admin.
CREATE POLICY "hw_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'homework-submissions'
    AND public.is_admin()
  );

-- INSERT: только в свою папку.
CREATE POLICY "hw_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'homework-submissions'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE/DELETE: owner или admin.
CREATE POLICY "hw_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'homework-submissions'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'homework-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "hw_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'homework-submissions'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "hw_admin_write"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'homework-submissions' AND public.is_admin())
  WITH CHECK (bucket_id = 'homework-submissions' AND public.is_admin());

-- ============================================================================
-- BUCKET: lesson-recordings  (private, archival)
-- ============================================================================
-- Path: lessons/{lesson_id}/{recording_id}/{seq}.webm
-- INSERT/UPDATE через service role only (NO authenticated policy).
-- DELETE — admin или service role.

-- SELECT: участник урока. lesson_id извлекаем из path.
CREATE POLICY "rec_participant_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lesson-recordings'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'lessons'
    AND public.is_lesson_participant(((storage.foldername(name))[2])::uuid)
  );

-- SELECT: admin.
CREATE POLICY "rec_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lesson-recordings'
    AND public.is_admin()
  );

-- DELETE: admin only.
CREATE POLICY "rec_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lesson-recordings'
    AND public.is_admin()
  );

-- NB: нет INSERT/UPDATE policy для authenticated — запись только через
-- service-role signed upload URL (см. /api/lesson/recording/chunk-url).

-- ============================================================================
-- BUCKET: lesson-files  (legacy public bucket — FIXME)
-- ============================================================================
-- Текущий код использует getPublicUrl. Флипать private надо вместе с фиксом
-- consumers; пока что оставляем permissive policies, но прибиваем write
-- к участникам урока (раньше был просто `bucket_id = 'lesson-files'`).
CREATE POLICY "lf_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lesson-files');

CREATE POLICY "lf_participant_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'lessons'
    AND public.is_lesson_participant(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "lf_participant_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lesson-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'lessons'
    AND public.is_lesson_participant(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "lf_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lesson-files'
    AND (
      public.is_admin()
      OR (
        (storage.foldername(name))[1] = 'lessons'
        AND public.is_lesson_participant(((storage.foldername(name))[2])::uuid)
      )
    )
  );

-- NB: COMMENT ON POLICY на storage.objects требует ownership table'а
-- (supabase_storage_admin), а apply_migration работает из postgres —
-- поэтому документация комментариями к политикам опущена. Семантика
-- описана в шапке файла.
