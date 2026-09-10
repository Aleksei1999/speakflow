-- ---------------------------------------------------------------------------
-- Аудит безопасности 10.09.2026, часть 3: уроки со стороны клиента.
-- Применять в Supabase SQL Editor после 20260910160000_security_rls_hardening.sql.
--
-- Что закрываем (подтверждено пробами с JWT ученика):
--  1) Ученик мог перевести СВОЙ урок in_progress/completed -> cancelled прямым
--     PATCH через PostgREST и тем самым уйти от списания за проведённый урок.
--     Теперь с клиента отменить можно только pending_payment/booked, ученик —
--     не позднее чем за 24 часа до начала (та же политика, что в API).
--  2) Ученик мог писать jitsi_room_name / google_event_id / student_google_event_id
--     (подмена комнаты Jitsi чужого урока, удаление чужих событий календаря).
--     Эти колонки теперь пишет только сервер (service_role).
--  3) Уроки по подписке создавались с price = 0 и никогда не списывались.
--     Цена проставляется триггером по тем же тарифам, что и разовая бронь.
-- ---------------------------------------------------------------------------

-- 2) колонки только для сервера
REVOKE UPDATE (jitsi_room_name, google_event_id, student_google_event_id)
  ON public.lessons FROM anon, authenticated;

-- 1) статус с клиента: только отмена, только из pending_payment/booked,
--    ученик — не позднее чем за 24 часа. Админ и учитель — без ограничения по времени.
CREATE OR REPLACE FUNCTION public.guard_lesson_status_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_service boolean := current_setting('role', true) = 'service_role'
    OR session_user IN ('service_role', 'supabase_admin', 'postgres');
  v_uid uuid;
  v_is_admin boolean := false;
BEGIN
  IF v_is_service THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'lessons.status can only be set to cancelled from client' USING ERRCODE = '42501';
  END IF;
  IF OLD.status NOT IN ('pending_payment', 'booked') THEN
    RAISE EXCEPTION 'lesson with status % cannot be cancelled from client', OLD.status USING ERRCODE = '42501';
  END IF;

  v_uid := auth.uid();
  BEGIN
    v_is_admin := public.get_user_role() = 'admin';
  EXCEPTION WHEN OTHERS THEN v_is_admin := false;
  END;

  -- ученик (не админ и не учитель этого урока): не позднее чем за 24 часа
  IF NOT v_is_admin AND v_uid IS NOT NULL AND v_uid = OLD.student_id
     AND NOT EXISTS (SELECT 1 FROM public.teacher_profiles tp WHERE tp.id = OLD.teacher_id AND tp.user_id = v_uid)
  THEN
    IF OLD.scheduled_at - now() < interval '24 hours' THEN
      RAISE EXCEPTION 'student can cancel a lesson no later than 24 hours before start' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_lesson_status_from_client ON public.lessons;
CREATE TRIGGER trg_guard_lesson_status_from_client
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.guard_lesson_status_from_client();

-- 3) цена урока по подписке = тариф (60/90 мин из app_settings, иначе hourly_rate пропорционально)
CREATE OR REPLACE FUNCTION public.lesson_price_kopecks(p_teacher_profile_id uuid, p_duration integer)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fixed integer := 0;
  v_hourly integer := 0;
BEGIN
  IF p_duration IN (60, 90) THEN
    SELECT COALESCE((value #>> '{}')::integer, 0) INTO v_fixed
    FROM public.app_settings
    WHERE key = CASE WHEN p_duration = 60 THEN 'teacher_rate_60_kopecks' ELSE 'teacher_rate_90_kopecks' END;
    IF COALESCE(v_fixed, 0) > 0 THEN RETURN v_fixed; END IF;
  END IF;
  SELECT COALESCE(hourly_rate, 0) INTO v_hourly FROM public.teacher_profiles WHERE id = p_teacher_profile_id;
  RETURN GREATEST(0, round(COALESCE(v_hourly, 0) * COALESCE(p_duration, 50) / 60.0))::integer;
END;
$$;
REVOKE ALL ON FUNCTION public.lesson_price_kopecks(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_price_kopecks(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.set_subscription_lesson_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.subscription_id IS NOT NULL AND COALESCE(NEW.price, 0) = 0 THEN
    NEW.price := public.lesson_price_kopecks(NEW.teacher_id, NEW.duration_minutes);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_subscription_lesson_price ON public.lessons;
CREATE TRIGGER trg_set_subscription_lesson_price
  BEFORE INSERT ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_lesson_price();

-- Будущие уроки по подписке, созданные с нулевой ценой, — проставляем тариф.
UPDATE public.lessons l
SET price = public.lesson_price_kopecks(l.teacher_id, l.duration_minutes)
WHERE l.subscription_id IS NOT NULL
  AND COALESCE(l.price, 0) = 0
  AND l.status IN ('booked', 'pending_payment')
  AND l.scheduled_at > now();
