-- ==========================================================
-- 048 · Бэкфилл OAuth-аватаров + синхронизация в handle_new_user
-- ==========================================================
-- При signup через Google OAuth у нас в auth.users.raw_user_meta_data
-- лежит `avatar_url` / `picture` от провайдера, но в public.profiles
-- avatar_url оставался NULL. На UI учителя «Мои ученики» получали
-- инициалы вместо фото.

-- 1) Backfill: переносим OAuth-аватар в profiles, если там пусто.
UPDATE public.profiles p
   SET avatar_url = COALESCE(
         u.raw_user_meta_data->>'avatar_url',
         u.raw_user_meta_data->>'picture'
       )
  FROM auth.users u
 WHERE p.id = u.id
   AND p.avatar_url IS NULL
   AND COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') IS NOT NULL;

-- 2) Расширяем handle_new_user, чтобы новые OAuth-юзеры автоматически
-- получали avatar_url. Триггер уже существует (миграция 032), сохраняем
-- его behaviour, добавляем только заполнение avatar_url.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  v_full_name text := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_first_name text := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    split_part(v_full_name, ' ', 1)
  );
  v_last_name text := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    NULLIF(regexp_replace(v_full_name, '^\S+\s*', ''), '')
  );
  v_phone text := NEW.raw_user_meta_data->>'phone';
  v_avatar text := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, phone, avatar_url, role)
  VALUES (NEW.id, NEW.email, v_full_name, v_first_name, v_last_name, v_phone, v_avatar, v_role)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
        updated_at = now();

  -- user_progress shell (не падать если уже есть)
  INSERT INTO public.user_progress (user_id, total_xp, current_level, lessons_completed, current_streak, longest_streak)
  VALUES (NEW.id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
