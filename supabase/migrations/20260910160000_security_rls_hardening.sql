-- ---------------------------------------------------------------------------
-- Аудит безопасности 10.09.2026, часть 2: RLS, права на функции и колонки.
-- Применять в Supabase SQL Editor после 20260910150000_security_hotfix.sql.
-- Каждый блок обёрнут в DO с игнорированием отсутствующих объектов.
-- ---------------------------------------------------------------------------

-- Служебная: отозвать выполнение функций по имени (все перегрузки).
CREATE OR REPLACE FUNCTION public._revoke_fn(p_names text[], p_grant_authenticated boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (p_names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    IF p_grant_authenticated THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- 1) XP: начислять может только сервер (иначе любой рисует себе XP и награды).
SELECT public._revoke_fn(ARRAY['award_xp']);
-- 2) Дашборды и служебные: только service_role.
SELECT public._revoke_fn(ARRAY['get_student_dashboard', 'get_teacher_dashboard', 'refresh_leaderboards']);
-- 3) Проверки связей: только залогиненным (аноним не перебирает пары).
SELECT public._revoke_fn(ARRAY['can_chat', 'is_group_participant'], true);
DROP FUNCTION public._revoke_fn(text[], boolean);

-- 4) search_path у SECURITY DEFINER-хелперов.
DO $$ BEGIN
  ALTER FUNCTION public.get_user_role() SET search_path = public, pg_temp;
  ALTER FUNCTION public.get_teacher_profile_id() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- 5) profiles: ещё колонки, которые нельзя менять с клиента.
DO $$ BEGIN
  REVOKE UPDATE (email_verified, telegram_chat_id, telegram_username) ON public.profiles FROM anon, authenticated;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- 6) teacher_profiles: рейтинг/верификацию/листинг ставит только сервер; чужие
--    незалистованные профили не видны.
DO $$ BEGIN
  REVOKE UPDATE (is_verified, rating, total_reviews, total_lessons, is_listed) ON public.teacher_profiles FROM anon, authenticated;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DROP POLICY IF EXISTS teacher_profiles_select_all ON public.teacher_profiles;
DROP POLICY IF EXISTS teacher_profiles_select ON public.teacher_profiles;
CREATE POLICY teacher_profiles_select ON public.teacher_profiles
  FOR SELECT USING (is_listed = true OR user_id = auth.uid() OR public.get_user_role() = 'admin');

-- 7) homework: оценки и статусы ставит сервер.
DO $$ BEGIN
  REVOKE UPDATE (grade, score_10, status, teacher_feedback, reviewed_at, teacher_id, student_id) ON public.homework FROM anon, authenticated;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- 8) Регистрации/записи — только сервером.
DO $$ BEGIN REVOKE INSERT, UPDATE ON public.club_registrations FROM anon, authenticated; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN REVOKE INSERT, UPDATE ON public.course_enrollments FROM anon, authenticated; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN REVOKE INSERT ON public.lecture_registrations FROM anon, authenticated; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN REVOKE INSERT, UPDATE ON public.lesson_subscriptions FROM anon, authenticated; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DROP POLICY IF EXISTS teacher_apps_insert_public ON public.teacher_applications;

-- 9) Заявки на пробный урок: пишет только сервер и админ.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='trial_lesson_requests' AND cmd IN ('INSERT','UPDATE') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.trial_lesson_requests', r.policyname);
  END LOOP;
END $$;
CREATE POLICY trial_requests_update_admin ON public.trial_lesson_requests
  FOR UPDATE TO authenticated USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');

-- 10) lesson_requests: статус/участников меняет сервер.
DO $$ BEGIN
  REVOKE UPDATE (status, teacher_id, student_id) ON public.lesson_requests FROM anon, authenticated;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- 11) level_tests: анонимные результаты (email, ответы) не читаются всеми.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='level_tests' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.level_tests', r.policyname);
  END LOOP;
END $$;
CREATE POLICY level_tests_select_own_or_staff ON public.level_tests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.get_user_role() IN ('teacher', 'admin'));

-- 12) Прогресс и достижения: свои или для преподавателя/админа.
DROP POLICY IF EXISTS user_progress_select_all ON public.user_progress;
DROP POLICY IF EXISTS user_progress_select_own_or_staff ON public.user_progress;
CREATE POLICY user_progress_select_own_or_staff ON public.user_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.get_user_role() IN ('teacher', 'admin'));
DROP POLICY IF EXISTS user_achievements_select_all ON public.user_achievements;

-- 13) Награды: статус доставки меняет админ.
DO $$ BEGIN
  REVOKE UPDATE (status, fulfilled_at, tracking_number, admin_notes) ON public.user_rewards FROM anon, authenticated;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- 14) Вложения чата: загрузка только в тред с тем, с кем можно переписываться.
DROP POLICY IF EXISTS chat_attach_participant_upload ON storage.objects;
CREATE POLICY chat_attach_participant_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND auth.uid() IS NOT NULL
    AND ((storage.foldername(name))[1] = auth.uid()::text OR (storage.foldername(name))[2] = auth.uid()::text)
    AND public.can_chat(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid)
  );
