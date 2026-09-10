-- ---------------------------------------------------------------------------
-- Ремонт регистрации и защита profiles. Применять в Supabase SQL Editor.
--
-- 1) handle_new_user (миграция 061) вызывает public.transliterate_name(),
--    которой в базе нет (есть только transliterate_ru). Триггер падает в
--    EXCEPTION-блок → у новых пользователей НЕ создаётся строка profiles.
--    Добавляем функцию-обёртку, пересоздаём handle_new_user и триггер.
-- 2) Бэкфилл profiles для auth.users, у которых профиля нет.
-- 3) Ремонт auth.users с NULL в текстовых token-колонках (GoTrue не может
--    загрузить такого пользователя: «Database error loading user»).
-- 4) Возврат колоночных прав (076 → откачено в 077/078): без REVOKE любой
--    залогиненный может выставить себе role='admin' через PostgREST.
--    Триггер-guard из 076 НЕ возвращаем (его откатывали из-за IO-бюджета) —
--    достаточно REVOKE: серверные пути работают через service_role.
-- ---------------------------------------------------------------------------

-- 1a) обёртка
CREATE OR REPLACE FUNCTION public.transliterate_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT public.transliterate_ru(input) $$;

-- 1b) handle_new_user — тело из миграции 061, роль при саморегистрации всегда student
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

-- 1c) триггер
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) бэкфилл профилей
INSERT INTO public.profiles (id, email, full_name, full_name_ru, role)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), ''),
    u.email
  ),
  NULLIF(trim(u.raw_user_meta_data->>'full_name_ru'), ''),
  'student'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3) ремонт auth.users (NULL → '')
UPDATE auth.users SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change               = COALESCE(email_change, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL OR email_change IS NULL
   OR email_change_token_new IS NULL OR email_change_token_current IS NULL
   OR phone_change IS NULL OR phone_change_token IS NULL OR reauthentication_token IS NULL;

-- 4) привилегированные колонки profiles — только service_role
REVOKE UPDATE (role, balance_rub, subscription_tier, subscription_until,
               referred_by_user_id, is_active, email)
ON public.profiles FROM anon, authenticated;
