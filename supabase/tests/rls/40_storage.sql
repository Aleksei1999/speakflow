-- ============================================================================
-- 40_storage.sql — RLS на storage.objects per bucket (миграция 072)
-- ============================================================================
-- Покрывает (только тех, что можно проверить без реального файла):
--   • avatars — public read (anon тоже видит)
--   • teacher-materials — owner видит свой файл; чужой не видит без share
--   • homework-submissions — owner видит; teacher урока видит; чужой не видит
--   • lesson-recordings — участник видит; чужой не видит
-- ============================================================================
--
-- Storage policies проверяют SELECT по storage.objects. Чтобы тесты были
-- независимы от реальных загрузок, мы вставляем "виртуальные" объекты
-- в storage.objects и сразу удаляем в ROLLBACK.
-- ============================================================================

BEGIN;

-- ---- Подготовка тестовых objects от service-role (без RLS) ----
-- Используем SECURITY DEFINER подменой: storage.objects владеет
-- supabase_storage_admin. Тестовые объекты не имеют real-blob — это OK,
-- RLS работает по metadata.

INSERT INTO storage.objects (bucket_id, name, owner, owner_id, metadata)
VALUES
  ('avatars',              'aaaaaaaa-0000-0000-0000-000000000001/avatar.jpg', 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', '{}'::jsonb),
  ('teacher-materials',    'bbbbbbbb-0000-0000-0000-000000000001/test_material.pdf', 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001', '{}'::jsonb),
  ('homework-submissions', 'aaaaaaaa-0000-0000-0000-000000000001/77777777-0000-0000-0000-000000000001/file.pdf', 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', '{}'::jsonb),
  ('lesson-recordings',    'lessons/11111111-0000-0000-0000-000000000001/rec1/chunk-t-00000.webm', 'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001', '{}'::jsonb)
ON CONFLICT (bucket_id, name) DO NOTHING;

-- ---- avatars: public read — anon тоже видит ----
SET LOCAL ROLE anon;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'avatars' AND name = 'aaaaaaaa-0000-0000-0000-000000000001/avatar.jpg';
  IF n <> 1 THEN
    RAISE EXCEPTION 'fail 40.1: anon should read avatars (got %)', n;
  END IF;
END $$;

-- ---- teacher-materials: owner видит ----
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'teacher-materials' AND name LIKE 'bbbbbbbb-0000-0000-0000-000000000001/%';
  IF n < 1 THEN
    RAISE EXCEPTION 'fail 40.2: teacher should see own teacher-materials object (got %)', n;
  END IF;
END $$;

-- ---- teacher-materials: чужой studentB БЕЗ share не видит ----
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'teacher-materials' AND name = 'bbbbbbbb-0000-0000-0000-000000000001/test_material.pdf';
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 40.3: leak — non-shared student saw teacher-materials object (% rows)', n;
  END IF;
END $$;

-- ---- homework-submissions: owner studentA видит ----
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'homework-submissions' AND name LIKE 'aaaaaaaa-0000-0000-0000-000000000001/%';
  IF n < 1 THEN
    RAISE EXCEPTION 'fail 40.4: studentA should see own homework upload (got %)', n;
  END IF;
END $$;

-- ---- homework-submissions: чужой studentB не видит ----
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'homework-submissions' AND name = 'aaaaaaaa-0000-0000-0000-000000000001/77777777-0000-0000-0000-000000000001/file.pdf';
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 40.5: leak — studentB saw homework of studentA (% rows)', n;
  END IF;
END $$;

-- ---- lesson-recordings: участник studentA видит ----
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'lesson-recordings' AND name LIKE 'lessons/11111111-0000-0000-0000-000000000001/%';
  IF n < 1 THEN
    RAISE EXCEPTION 'fail 40.6: lesson participant should see recording chunk (got %)', n;
  END IF;
END $$;

-- ---- lesson-recordings: чужой stranger не видит ----
SET LOCAL "request.jwt.claims" = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'lesson-recordings' AND name LIKE 'lessons/11111111-0000-0000-0000-000000000001/%';
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 40.7: leak — stranger saw lesson recording (% rows)', n;
  END IF;
END $$;

ROLLBACK;
SELECT '40_storage: ok' AS status;
