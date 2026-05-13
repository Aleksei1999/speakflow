-- ==========================================================
-- 061 · CRITICAL fix: запретить self-grant admin через signUp metadata
-- ==========================================================
-- handle_new_user читал role из NEW.raw_user_meta_data, и в whitelist
-- стояло IN ('student','teacher','admin'). Любой клиент мог:
--   supabase.auth.signUp({ email, password, options: { data: { role: 'admin' } } })
-- и получить полный доступ к /admin/*.
--
-- Фикс: переписываем триггер с whitelist'ом только 'student'/'teacher'.
-- Назначение admin делается только вручную через SQL/Dashboard, минуя
-- signup flow. Существующие admin-rows (например, основатель) НЕ
-- трогаем — миграция меняет только будущие регистрации.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  v_name_en text := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  v_first  text := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'given_name',
    ''
  );
  v_last   text := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'family_name',
    ''
  );
  v_name_ru text := COALESCE(
    CASE WHEN trim(coalesce(v_first,'')) <> '' AND trim(coalesce(v_last,'')) <> ''
         THEN trim(v_first) || ' ' || trim(v_last)
         ELSE NULLIF(trim(coalesce(v_first,'')), '')
    END,
    NEW.raw_user_meta_data->>'full_name_ru',
    ''
  );
  v_phone  text := NEW.raw_user_meta_data->>'phone';
  v_avatar text := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  -- ЕДИНСТВЕННОЕ ИЗМЕНЕНИЕ vs мигр 057: admin вырезан из whitelist.
  v_safe_role text := CASE WHEN v_role IN ('student', 'teacher') THEN v_role ELSE 'student' END;
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, full_name_ru, phone, avatar_url, role)
    VALUES (
      NEW.id,
      NEW.email,
      public.transliterate_name(NULLIF(trim(coalesce(v_name_en, '')), '')),
      NULLIF(trim(coalesce(v_name_ru, '')), ''),
      v_phone,
      v_avatar,
      v_safe_role
    )
    ON CONFLICT (id) DO NOTHING;

    IF v_safe_role = 'teacher' THEN
      INSERT INTO public.teacher_profiles (user_id, hourly_rate, is_listed, is_verified)
      VALUES (NEW.id, 0, false, false)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed for user % (role=%): % / %',
      NEW.id, v_safe_role, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
  'AFTER INSERT auth.users → создаёт profiles+teacher_profiles. role whitelist: student|teacher (admin запрещён через signup, назначается только вручную через SQL).';
