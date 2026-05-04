-- ==========================================================
-- 052 · Storage policies для lesson-files bucket
-- ==========================================================
-- Позволяем authenticated юзерам делать upload (INSERT) в lesson-files
-- bucket — для прямой загрузки файлов из /lesson/[id] minуя Vercel
-- API-роут (4.5MB кэп). Bucket уже public=true, SELECT тоже разрешён
-- явно для auth-клиента.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'lesson_files_auth_upload'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY lesson_files_auth_upload ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'lesson-files');
    $POL$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'lesson_files_auth_select'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY lesson_files_auth_select ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = 'lesson-files');
    $POL$;
  END IF;
END $$;
