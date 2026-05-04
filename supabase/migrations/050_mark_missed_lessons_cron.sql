-- ==========================================================
-- 050 · Авто-отметка пропущенных уроков (no_show)
-- ==========================================================
-- Если урок был status='booked' и никто к нему не подключился через
-- Jitsi (status не сменился на 'in_progress' через /api/jitsi/token),
-- а scheduled_at + duration уже прошли с буфером 10 минут — переводим
-- его в 'no_show'. pg_cron вызывает функцию каждые 5 минут.

CREATE OR REPLACE FUNCTION public.mark_missed_lessons()
RETURNS TABLE (lesson_id uuid, scheduled_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.lessons
     SET status = 'no_show',
         updated_at = NOW()
   WHERE status = 'booked'
     AND scheduled_at + (duration_minutes || ' minutes')::interval + interval '10 minutes' < NOW()
  RETURNING id, scheduled_at;
$$;

REVOKE ALL ON FUNCTION public.mark_missed_lessons() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_missed_lessons() TO service_role;

-- pg_cron — каждые 5 минут (через cron.schedule с проверкой, чтобы
-- migration был идемпотентным при повторном применении).
DO $$
DECLARE existing_id int;
BEGIN
  SELECT jobid INTO existing_id FROM cron.job WHERE jobname = 'mark_missed_lessons';
  IF existing_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_id);
  END IF;
  PERFORM cron.schedule(
    'mark_missed_lessons',
    '*/5 * * * *',
    'SELECT public.mark_missed_lessons();'
  );
END $$;
