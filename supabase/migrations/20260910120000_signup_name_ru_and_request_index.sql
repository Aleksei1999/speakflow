-- ---------------------------------------------------------------------------
-- 1) handle_new_user: full_name_ru берём из метаданных формы (кириллица),
--    а не из уже транслитерированных first/last.
-- 2) Одна открытая заявка на ученика: регистрация создаёт заявку админу,
--    параллельные рендеры не должны плодить дубли.
-- Применять в Supabase SQL Editor после 20260910110000_profiles_privacy.sql.
-- ---------------------------------------------------------------------------

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
  -- Кириллица из формы регистрации (metadata.full_name_ru) важнее склейки
  -- first/last — они приходят уже транслитерированными.
  v_name_ru text := COALESCE(
    NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'full_name_ru', '')), ''),
    CASE WHEN trim(coalesce(v_first,'')) <> '' AND trim(coalesce(v_last,'')) <> ''
         THEN trim(v_first) || ' ' || trim(v_last)
         ELSE NULLIF(trim(coalesce(v_first,'')), '')
    END,
    ''
  );
  v_phone  text := NEW.raw_user_meta_data->>'phone';
  v_avatar text := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  -- ЕДИНСТВЕННОЕ ИЗМЕНЕНИЕ vs мигр 057: admin вырезан из whitelist.
  -- Учитель создаётся только через одобрение заявки админом (approve →
  -- service_role выставляет role='teacher'); самостоятельная регистрация = student.
  v_safe_role text := 'student';
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

CREATE UNIQUE INDEX IF NOT EXISTS trial_lesson_requests_one_open_per_user
  ON public.trial_lesson_requests (user_id)
  WHERE status = 'pending' AND assigned_teacher_id IS NULL;
