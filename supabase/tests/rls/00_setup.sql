-- ============================================================================
-- 00_setup.sql — predictable test users + sample lessons/materials/etc.
-- ============================================================================
-- Запускается ОДИН раз перед остальными файлами 10_–50_. Тестовые UUID'ы
-- зашиты явно, чтобы остальные файлы могли SET request.jwt.claims без
-- динамического подстановочного шаблона.
--
-- ВСЕ строки имеют префикс/тег чтобы 99_teardown мог их вычистить:
--   email LIKE 'rls-test-%@raw-english.local'
--   все public.* строки помечены через FK к auth.users этих email'ов.
--
-- ОПАСНО запускать на production-данных. Запускайте только в dev-проекте
-- или после `supabase db reset`.
-- ============================================================================

-- Гард — не запускаем если в проекте есть реальные пользователи без
-- тестового префикса (грубая эвристика; точнее лучше через staging URL).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM auth.users WHERE email NOT LIKE 'rls-test-%@%';
  IF n > 50 THEN
    RAISE WARNING 'RLS test setup: % real users present — proceed manually if intended', n;
  END IF;
END $$;

-- Тестовые UUID'ы (предсказуемые).
--   student A  : aaaaaaaa-0000-0000-0000-000000000001
--   student B  : aaaaaaaa-0000-0000-0000-000000000002
--   teacher T  : bbbbbbbb-0000-0000-0000-000000000001
--   admin   X  : cccccccc-0000-0000-0000-000000000001
--   stranger Z : dddddddd-0000-0000-0000-000000000001
--
--   lesson  L1 (T+studentA, scheduled +1d) : 11111111-0000-0000-0000-000000000001
--   lesson  L2 (T+studentB)                : 11111111-0000-0000-0000-000000000002
--   material M1 (teacher T, lesson L1)     : 22222222-0000-0000-0000-000000000001

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'rls-test-studentA@raw-english.local', crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'rls-test-studentB@raw-english.local', crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'rls-test-teacherT@raw-english.local', crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'rls-test-adminX@raw-english.local',  crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated', now(), now()),
  ('dddddddd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'rls-test-stranger@raw-english.local', crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{"provider":"email"}'::jsonb, 'authenticated', 'authenticated', now(), now())
ON CONFLICT (id) DO NOTHING;

-- handle_new_user триггер уже создал public.profiles, но без email/full_name
-- (он не копирует их если их нет в user_metadata). Сначала fallback INSERT
-- если триггер отсутствует, потом UPDATE'ом проставляем нужные роли/email.
INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id, u.email, split_part(u.email,'@',1), 'student'
FROM auth.users u
WHERE u.id IN (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001',
  'dddddddd-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET email = 'rls-test-studentA@raw-english.local', full_name = 'A Test', role = 'student' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
UPDATE public.profiles SET email = 'rls-test-studentB@raw-english.local', full_name = 'B Test', role = 'student' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';
UPDATE public.profiles SET email = 'rls-test-teacherT@raw-english.local', full_name = 'T Test', role = 'teacher' WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';
UPDATE public.profiles SET email = 'rls-test-adminX@raw-english.local',   full_name = 'X Test', role = 'admin'   WHERE id = 'cccccccc-0000-0000-0000-000000000001';
UPDATE public.profiles SET email = 'rls-test-stranger@raw-english.local', full_name = 'Z Test', role = 'student' WHERE id = 'dddddddd-0000-0000-0000-000000000001';

-- teacher_profiles row для teacher T.
INSERT INTO public.teacher_profiles (id, user_id, hourly_rate, languages, specializations, certificates, is_verified, is_listed)
VALUES (
  '99999999-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  2000,
  ARRAY['en','ru']::text[],
  ARRAY['general']::text[],
  ARRAY[]::text[],
  true,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 2 урока: L1 (studentA+T), L2 (studentB+T).
-- NB: lessons.teacher_id ссылается на teacher_profiles.id (НЕ на profiles.id).
INSERT INTO public.lessons (id, student_id, teacher_id, scheduled_at, duration_minutes, status, price)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', now() + interval '1 day', 60, 'booked', 2000),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', now() + interval '2 day', 60, 'booked', 2000)
ON CONFLICT (id) DO NOTHING;

-- Material owned by teacher T, attached to lesson L1.
INSERT INTO public.materials (id, teacher_id, lesson_id, title, file_url, storage_path, mime_type, file_size, is_public)
VALUES (
  '22222222-0000-0000-0000-000000000001',
  '99999999-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  'RLS test material',
  'https://example.test/dummy.pdf',
  'bbbbbbbb-0000-0000-0000-000000000001/test_material.pdf',
  'application/pdf',
  1234,
  false
)
ON CONFLICT (id) DO NOTHING;

SELECT '00_setup: ok' AS status;
