-- ============================================================================
-- 99_teardown.sql — удаляет всех тестовых пользователей и привязанные данные
-- ============================================================================
-- Запускайте ПОСЛЕ всех 10..50, даже если они уже сделали ROLLBACK — на
-- случай если 00_setup создал реальные строки (он создаёт). Каскад через FK.
-- ============================================================================

-- Порядок важен: сначала dependents (lessons, materials), потом teacher_profiles,
-- потом public.profiles, потом auth.users — иначе FK ругаются.

-- 1) material_shares + materials.
DELETE FROM public.material_shares WHERE material_id = '22222222-0000-0000-0000-000000000001';
DELETE FROM public.materials       WHERE id = '22222222-0000-0000-0000-000000000001';

-- 2) lessons.
DELETE FROM public.lessons WHERE id IN (
  '11111111-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002'
);

-- 3) teacher_profiles.
DELETE FROM public.teacher_profiles WHERE id = '99999999-0000-0000-0000-000000000001';
DELETE FROM public.teacher_profiles WHERE user_id IN (
  'bbbbbbbb-0000-0000-0000-000000000001'
);

-- 4) public.profiles.
DELETE FROM public.profiles WHERE id IN (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001',
  'dddddddd-0000-0000-0000-000000000001'
);

-- 5) auth.users (с CASCADE которая всё-таки осталась).
WITH ids(uid) AS (VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  ('bbbbbbbb-0000-0000-0000-000000000001'::uuid),
  ('cccccccc-0000-0000-0000-000000000001'::uuid),
  ('dddddddd-0000-0000-0000-000000000001'::uuid)
)
DELETE FROM auth.users WHERE id IN (SELECT uid FROM ids);
DELETE FROM storage.objects WHERE
  (bucket_id = 'avatars'              AND name LIKE 'aaaaaaaa-0000-0000-0000-%') OR
  (bucket_id = 'teacher-materials'    AND name LIKE 'bbbbbbbb-0000-0000-0000-%') OR
  (bucket_id = 'homework-submissions' AND name LIKE 'aaaaaaaa-0000-0000-0000-%') OR
  (bucket_id = 'lesson-recordings'    AND name LIKE 'lessons/11111111-0000-0000-0000-%');

DELETE FROM audit.audit_log WHERE action = 'rls.test';
-- Также удаляем строки которые мог записать audit-trigger при INSERT/UPDATE
-- public.* строк выше (если он включён) для тестовых UUID'ов.
DELETE FROM audit.audit_log WHERE target_id IN (
  '11111111-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000001',
  '99999999-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001',
  'dddddddd-0000-0000-0000-000000000001'
);

SELECT '99_teardown: ok' AS status;
