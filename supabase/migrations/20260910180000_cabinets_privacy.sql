-- ---------------------------------------------------------------------------
-- Аудит безопасности 10.09.2026, часть 4: приватность кабинетов.
-- Применять в Supabase SQL Editor после 20260910170000_lesson_client_guard.sql.
--
--  1) profiles: преподаватель видел ВСЕХ учеников (email, телефон, telegram,
--     баланс) прямым запросом к PostgREST. Теперь — только своих (урок, пробная
--     заявка, группа: та же связь, что и для чатов — can_chat). Админ — всех.
--  2) user_progress: то же правило для прогресса учеников.
--  3) reviews: скрытые отзывы (is_visible = false) и student_id читались всеми.
--     Теперь скрытый отзыв видят только автор, преподаватель урока и админ.
--  4) guard_privileged_profile_fields: сравнение email было NEW с NEW (всегда
--     false) — исправлено на OLD. Колонка и так закрыта колоночным REVOKE.
-- ---------------------------------------------------------------------------

-- 1) profiles
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (role IN ('teacher', 'admin') AND COALESCE(is_active, true))
    OR public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'teacher' AND public.can_chat(auth.uid(), id))
  );

-- 2) user_progress
DO $$ BEGIN
  DROP POLICY IF EXISTS user_progress_select_own_or_staff ON public.user_progress;
  CREATE POLICY user_progress_select_own_or_staff
    ON public.user_progress FOR SELECT
    TO authenticated
    USING (
      user_id = auth.uid()
      OR public.get_user_role() = 'admin'
      OR (public.get_user_role() = 'teacher' AND public.can_chat(auth.uid(), user_id))
    );
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 3) reviews
DROP POLICY IF EXISTS reviews_select_all ON public.reviews;
CREATE POLICY reviews_select_visible_or_own
  ON public.reviews FOR SELECT
  USING (
    is_visible = true
    OR student_id = auth.uid()
    OR public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.teacher_profiles tp WHERE tp.id = reviews.teacher_id AND tp.user_id = auth.uid())
  );

-- 4) guard_privileged_profile_fields: правильное сравнение email
CREATE OR REPLACE FUNCTION public.guard_privileged_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_is_service_role boolean := current_setting('role', true) = 'service_role'
    OR session_user = 'service_role'
    OR session_user = 'supabase_admin'
    OR session_user = 'postgres';
  v_role_changed boolean := COALESCE(NEW.role, '') IS DISTINCT FROM COALESCE(OLD.role, '');
  v_balance_changed boolean := COALESCE(NEW.balance_rub, 0) IS DISTINCT FROM COALESCE(OLD.balance_rub, 0);
  v_tier_changed boolean := COALESCE(NEW.subscription_tier, '') IS DISTINCT FROM COALESCE(OLD.subscription_tier, '');
  v_until_changed boolean := NEW.subscription_until IS DISTINCT FROM OLD.subscription_until;
  v_referrer_changed boolean := NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id;
  v_active_changed boolean := COALESCE(NEW.is_active, true) IS DISTINCT FROM COALESCE(OLD.is_active, true);
  v_email_changed boolean := COALESCE(NEW.email, '') IS DISTINCT FROM COALESCE(OLD.email, '');
BEGIN
  IF v_is_service_role THEN
    RETURN NEW;
  END IF;
  IF NOT (v_role_changed OR v_balance_changed OR v_tier_changed
          OR v_until_changed OR v_referrer_changed OR v_active_changed
          OR v_email_changed) THEN
    RETURN NEW;
  END IF;
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF v_caller_role = 'admin' THEN
    RETURN NEW;
  END IF;
  IF v_role_changed THEN
    RAISE EXCEPTION 'cannot update profiles.role from client (forbidden field)' USING ERRCODE = '42501';
  END IF;
  IF v_balance_changed THEN
    RAISE EXCEPTION 'cannot update profiles.balance_rub from client' USING ERRCODE = '42501';
  END IF;
  IF v_tier_changed OR v_until_changed THEN
    RAISE EXCEPTION 'cannot update profiles.subscription_* from client' USING ERRCODE = '42501';
  END IF;
  IF v_referrer_changed THEN
    RAISE EXCEPTION 'cannot update profiles.referred_by_user_id from client' USING ERRCODE = '42501';
  END IF;
  IF v_active_changed THEN
    RAISE EXCEPTION 'cannot update profiles.is_active from client' USING ERRCODE = '42501';
  END IF;
  IF v_email_changed THEN
    RAISE EXCEPTION 'cannot update profiles.email from client (use auth.users)' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
