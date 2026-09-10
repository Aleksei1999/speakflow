-- ---------------------------------------------------------------------------
-- profiles: закрываем анонимное и чужое чтение персональных данных.
-- Было: profiles_select_all USING (true) — любой с anon-ключом читал email,
-- телефон, telegram, баланс всех пользователей.
-- Стало:
--   anon          — только активные преподаватели и только публичные колонки
--                   (каталог /teachers, карточки ведущих лекций);
--   authenticated — своя строка + преподаватели и админы (чаты, карточки);
--                   преподаватель/админ видят всех (списки учеников).
-- Применять в Supabase SQL Editor после 20260910100000_auth_repair.sql.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
DROP POLICY IF EXISTS profiles_select_anon ON public.profiles;
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;

CREATE POLICY profiles_select_anon
  ON public.profiles FOR SELECT
  TO anon
  USING (role = 'teacher' AND COALESCE(is_active, true));

CREATE POLICY profiles_select_authenticated
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR role IN ('teacher', 'admin')
    OR public.get_user_role() IN ('teacher', 'admin')
  );

-- Анониму — только публичные колонки (колоночные права поверх RLS).
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, full_name, first_name, last_name, full_name_ru, avatar_url, role,
              city, timezone, language, is_active, created_at)
ON public.profiles TO anon;
