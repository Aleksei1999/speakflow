-- 032_fix_handle_new_user_teacher_user_id.sql
-- Root cause: handle_new_user() inserted into public.teacher_profiles as (id=NEW.id, hourly_rate, is_listed)
-- but teacher_profiles.user_id is NOT NULL (and teacher_profiles.id has its own gen_random_uuid() default).
-- That meant every teacher signup raised 23502 (not-null violation on user_id) inside the AFTER INSERT trigger
-- on auth.users, which Supabase Auth surfaces as "Database error saving new user".
--
-- Fix:
--   1. Insert (user_id, hourly_rate, is_listed) -- let id default. ON CONFLICT on user_id (has UNIQUE).
--   2. user_progress insert: only user_id, let id default. ON CONFLICT on user_id.
--   3. Wrap public-table inserts in BEGIN/EXCEPTION WHEN OTHERS -> RAISE LOG, so even if future schema
--      drift breaks the trigger again, it never blocks auth.users insert. Defense-in-depth; root cause fixed.
--   4. SET search_path = public, pg_temp per Supabase SECURITY DEFINER best practice.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_role       TEXT;
    v_first      TEXT;
    v_last       TEXT;
    v_full_name  TEXT;
    v_phone      TEXT;
BEGIN
    v_role  := COALESCE(NEW.raw_user_meta_data ->> 'role', 'student');

    v_first := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'first_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'given_name'), '')
    );
    v_last  := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'last_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'family_name'), '')
    );
    v_phone := NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '');

    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), '')
    );
    IF v_full_name IS NULL THEN
        v_full_name := NULLIF(trim(COALESCE(v_first, '') || ' ' || COALESCE(v_last, '')), '');
    END IF;
    IF v_full_name IS NULL OR v_full_name = '' THEN
        v_full_name := COALESCE(NEW.email, '');
    END IF;

    IF v_first IS NULL AND v_full_name IS NOT NULL AND v_full_name <> '' THEN
        v_first := NULLIF(split_part(v_full_name, ' ', 1), '');
        IF position(' ' IN v_full_name) > 0 THEN
            v_last := NULLIF(trim(substring(v_full_name FROM position(' ' IN v_full_name) + 1)), '');
        ELSE
            v_last := NULL;
        END IF;
    END IF;

    BEGIN
        INSERT INTO public.profiles (id, email, full_name, first_name, last_name, phone, role)
        VALUES (
            NEW.id,
            COALESCE(NEW.email, ''),
            v_full_name,
            v_first,
            v_last,
            v_phone,
            CASE WHEN v_role IN ('student', 'teacher', 'admin') THEN v_role ELSE 'student' END
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.user_progress (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;

        IF v_role = 'teacher' THEN
            INSERT INTO public.teacher_profiles (user_id, hourly_rate, is_listed)
            VALUES (NEW.id, 100000, false)
            ON CONFLICT (user_id) DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'handle_new_user failed for user % (role=%): % / %', NEW.id, v_role, SQLSTATE, SQLERRM;
    END;

    RETURN NEW;
END;
$function$;
