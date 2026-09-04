-- Дополнение к таблице lectures (миграция 20260830150000):
--   • slot — какая плашка на дашборде ученика: main | tall | small
--   • storage_path — путь обложки в bucket'е lecture-covers (для смены/удаления)
--   • public bucket lecture-covers + storage policies

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS slot TEXT NOT NULL DEFAULT 'small',
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lectures_slot_check'
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_slot_check CHECK (slot IN ('main','tall','small'));
  END IF;
END $$;

-- Bucket для обложек лекций (публичный).
INSERT INTO storage.buckets (id, name, public)
VALUES ('lecture-covers', 'lecture-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage: admin может писать, читать все.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='lecture_covers_admin_write'
  ) THEN
    CREATE POLICY lecture_covers_admin_write ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'lecture-covers'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='lecture_covers_public_read'
  ) THEN
    CREATE POLICY lecture_covers_public_read ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'lecture-covers');
  END IF;
END $$;
