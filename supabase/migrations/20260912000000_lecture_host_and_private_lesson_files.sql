-- ---------------------------------------------------------------------------
-- 12.09.2026. Применять в Supabase SQL Editor.
--
-- 1) lectures.host_user_id — ведущий лекции по id, а не по совпадению имени.
--    Старые лекции подтягиваем по имени преподавателя (best-effort).
-- 2) Bucket lesson-files становится приватным: читать файлы урока могут только
--    его участники и админ (через подписанные ссылки), а не любой, кто знает URL.
-- ---------------------------------------------------------------------------

-- 1) Ведущий лекции
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS host_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lectures_host_user ON public.lectures (host_user_id);

UPDATE public.lectures l
   SET host_user_id = p.id
  FROM public.profiles p
 WHERE l.host_user_id IS NULL
   AND l.host_name IS NOT NULL
   AND p.role = 'teacher'
   AND lower(regexp_replace(p.full_name, '\s+', ' ', 'g')) = lower(regexp_replace(l.host_name, '\s+', ' ', 'g'));

-- 2) lesson-files: приватный bucket
UPDATE storage.buckets SET public = false WHERE id = 'lesson-files';

DROP POLICY IF EXISTS "lf_public_read" ON storage.objects;
CREATE POLICY "lf_participant_read"
  ON storage.objects FOR SELECT
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

-- Публичные ссылки на lesson-files в materials больше не работают — чистим,
-- ссылка строится по storage_path подписью на лету.
UPDATE public.materials
   SET file_url = ''
 WHERE file_url LIKE '%/storage/v1/object/public/lesson-files/%';
