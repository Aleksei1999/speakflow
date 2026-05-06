-- ==========================================================
-- 057 · Транслитерация ФИО в латиницу
-- ==========================================================
-- Карточки преподавателей рендерятся шрифтом Gluten cursive, который красиво
-- работает на латинских глифах и проваливается в системный fallback на
-- кириллице. Решение: при любой регистрации (Google OAuth, /register,
-- approve teacher_application, trial-lesson auto-assign) сразу сохранять
-- ФИО латиницей. Оригинал кириллицы держим в `full_name_ru` для возможного
-- отката или ручного отображения.
--
-- Схема транслитерации: ICAO Doc 9303 / российский паспорт (2014).
-- Зеркало TS-функции в src/lib/transliterate.ts.

-- 1) Добавляем колонки.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name_ru TEXT;

ALTER TABLE public.teacher_applications
  ADD COLUMN IF NOT EXISTS full_name_ru TEXT;

COMMENT ON COLUMN public.profiles.full_name_ru IS
  'Оригинал ФИО на кириллице, если при регистрации был ввод на русском. full_name всегда в латинице.';
COMMENT ON COLUMN public.teacher_applications.full_name_ru IS
  'Оригинал ФИО на кириллице (full_name восстанавливается из first_name+last_name на латинице).';

-- 2) plpgsql-транслитератор. Принимает текст, возвращает латиницу.
--    Если в строке нет кириллицы — возвращает её без изменений.
CREATE OR REPLACE FUNCTION public.transliterate_ru(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  ch       TEXT;
  lower_ch TEXT;
  mapped   TEXT;
  out      TEXT := '';
  i        INT;
  is_upper BOOLEAN;
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN input;
  END IF;
  -- Fast path: нет кириллицы — возвращаем как есть.
  IF input !~ '[А-Яа-яЁё]' THEN
    RETURN input;
  END IF;

  FOR i IN 1..char_length(input) LOOP
    ch := substr(input, i, 1);
    lower_ch := lower(ch);
    is_upper := (ch <> lower_ch);

    mapped := CASE lower_ch
      WHEN 'а' THEN 'a'
      WHEN 'б' THEN 'b'
      WHEN 'в' THEN 'v'
      WHEN 'г' THEN 'g'
      WHEN 'д' THEN 'd'
      WHEN 'е' THEN 'e'
      WHEN 'ё' THEN 'e'
      WHEN 'ж' THEN 'zh'
      WHEN 'з' THEN 'z'
      WHEN 'и' THEN 'i'
      WHEN 'й' THEN 'i'
      WHEN 'к' THEN 'k'
      WHEN 'л' THEN 'l'
      WHEN 'м' THEN 'm'
      WHEN 'н' THEN 'n'
      WHEN 'о' THEN 'o'
      WHEN 'п' THEN 'p'
      WHEN 'р' THEN 'r'
      WHEN 'с' THEN 's'
      WHEN 'т' THEN 't'
      WHEN 'у' THEN 'u'
      WHEN 'ф' THEN 'f'
      WHEN 'х' THEN 'kh'
      WHEN 'ц' THEN 'ts'
      WHEN 'ч' THEN 'ch'
      WHEN 'ш' THEN 'sh'
      WHEN 'щ' THEN 'shch'
      WHEN 'ъ' THEN 'ie'
      WHEN 'ы' THEN 'y'
      WHEN 'ь' THEN ''
      WHEN 'э' THEN 'e'
      WHEN 'ю' THEN 'iu'
      WHEN 'я' THEN 'ia'
      ELSE NULL
    END;

    IF mapped IS NULL THEN
      -- Не кириллица — добавляем как есть.
      out := out || ch;
    ELSIF mapped = '' THEN
      -- ь -> ничего.
      NULL;
    ELSIF is_upper THEN
      -- Title-case первого символа: Ш -> Sh, А -> A.
      IF char_length(mapped) = 1 THEN
        out := out || upper(mapped);
      ELSE
        out := out || upper(substr(mapped, 1, 1)) || substr(mapped, 2);
      END IF;
    ELSE
      out := out || mapped;
    END IF;
  END LOOP;

  RETURN out;
END;
$$;

COMMENT ON FUNCTION public.transliterate_ru(TEXT) IS
  'ICAO Doc 9303 / passport scheme. Используется в handle_new_user и backfill-миграциях.';

-- 3) Backfill: сохраняем оригинал в full_name_ru, переписываем full_name/first/last
--    на латиницу. Идемпотентно — повторный запуск ничего не изменит, т.к.
--    после первого прогона уже не останется кириллицы.

UPDATE public.profiles
   SET full_name_ru = COALESCE(full_name_ru, full_name),
       full_name    = public.transliterate_ru(full_name),
       first_name   = public.transliterate_ru(first_name),
       last_name    = public.transliterate_ru(last_name),
       updated_at   = now()
 WHERE full_name   ~ '[А-Яа-яЁё]'
    OR first_name  ~ '[А-Яа-яЁё]'
    OR last_name   ~ '[А-Яа-яЁё]';

UPDATE public.teacher_applications
   SET full_name_ru = COALESCE(full_name_ru,
         NULLIF(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), '')),
       first_name   = public.transliterate_ru(first_name),
       last_name    = public.transliterate_ru(last_name),
       updated_at   = now()
 WHERE first_name ~ '[А-Яа-яЁё]'
    OR last_name  ~ '[А-Яа-яЁё]';

-- 4) Обновляем handle_new_user: транслитерация на лету, чтобы любой будущий
--    путь регистрации (Google OAuth, Apple, magic-link, admin createUser)
--    автоматически писал латиницу. Если в user_metadata уже есть full_name_ru
--    — уважаем его (значит, наш /register уже подготовил данные); иначе
--    транслитерируем `full_name`/`first_name`/`last_name` сами.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

  -- Сырые входные значения (может быть кириллица или латиница).
  v_full_raw text := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_first_raw text := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'given_name',
    split_part(v_full_raw, ' ', 1)
  );
  v_last_raw text := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'family_name',
    NULLIF(regexp_replace(v_full_raw, '^\S+\s*', ''), '')
  );

  -- Транслитерация в латиницу (no-op для ASCII).
  v_full_name  text := public.transliterate_ru(v_full_raw);
  v_first_name text := public.transliterate_ru(v_first_raw);
  v_last_name  text := public.transliterate_ru(v_last_raw);

  -- Оригинал кириллицы (для отката / ручного отображения).
  v_full_ru    text := COALESCE(
    NEW.raw_user_meta_data->>'full_name_ru',
    CASE WHEN v_full_raw ~ '[А-Яа-яЁё]' THEN v_full_raw ELSE NULL END
  );

  v_phone  text := NEW.raw_user_meta_data->>'phone';
  v_avatar text := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
BEGIN
  BEGIN
    INSERT INTO public.profiles
      (id, email, full_name, first_name, last_name, full_name_ru, phone, avatar_url, role)
    VALUES
      (NEW.id, NEW.email, v_full_name, v_first_name, v_last_name, v_full_ru,
       v_phone, v_avatar,
       CASE WHEN v_role IN ('student', 'teacher', 'admin') THEN v_role ELSE 'student' END)
    ON CONFLICT (id) DO UPDATE
      SET email        = EXCLUDED.email,
          full_name    = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
          full_name_ru = COALESCE(public.profiles.full_name_ru, EXCLUDED.full_name_ru),
          avatar_url   = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
          updated_at   = now();

    INSERT INTO public.user_progress
      (user_id, total_xp, current_level, lessons_completed, current_streak, longest_streak)
    VALUES (NEW.id, 0, 0, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    IF v_role = 'teacher' THEN
      INSERT INTO public.teacher_profiles (user_id, hourly_rate, is_listed)
      VALUES (NEW.id, 100000, false)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Defense-in-depth: даже если что-то здесь упадёт, auth.users insert не блокируем.
    RAISE LOG 'handle_new_user failed for user % (role=%): % / %',
      NEW.id, v_role, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
