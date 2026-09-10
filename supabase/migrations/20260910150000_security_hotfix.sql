-- ---------------------------------------------------------------------------
-- СРОЧНО. Закрываем дыры, подтверждённые проверкой 10.09.2026:
--  1) credit_student_balance() вызывалась через PostgREST RPC кем угодно,
--     включая анонима — зачисление денег на любой баланс.
--  2) Ученик мог менять любые поля своих уроков напрямую через API
--     (цена, время, статус), учитель — своих. Оставляем клиенту только
--     колонки отмены/техполя, статус из клиента — только «cancelled».
--     Создание уроков — только сервером (service_role).
--  3) Служебные функции (завершение уроков, пересчёт лидерборда, очистки)
--     закрываем от anon/authenticated.
-- Применять в Supabase SQL Editor немедленно.
-- ---------------------------------------------------------------------------

-- 1) деньги
REVOKE ALL ON FUNCTION public.credit_student_balance(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_student_balance(uuid, bigint) TO service_role;

-- 3) служебные функции (если какой-то нет — пропускаем)
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.complete_finished_lessons()',
    'public.refresh_leaderboards()',
    'public.cleanup_old_csp_violations()',
    'public.cleanup_old_lesson_recordings()',
    'public.sweep_stuck_lesson_recordings()',
    'public.transliterate_name(text)',
    'public.transliterate_ru(text)'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

-- 2) уроки: колоночные права для клиента
REVOKE INSERT, UPDATE ON public.lessons FROM anon, authenticated;
GRANT UPDATE (status, cancelled_by, cancellation_reason, jitsi_room_name, google_event_id, student_google_event_id)
  ON public.lessons TO authenticated;

-- Статус из клиента — только отмена. Сервер (service_role) — без ограничений.
CREATE OR REPLACE FUNCTION public.guard_lesson_status_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service boolean := current_setting('role', true) = 'service_role'
    OR session_user IN ('service_role', 'supabase_admin', 'postgres');
BEGIN
  IF v_is_service THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'lessons.status can only be set to cancelled from client' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_lesson_status_from_client ON public.lessons;
CREATE TRIGGER trg_guard_lesson_status_from_client
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.guard_lesson_status_from_client();
