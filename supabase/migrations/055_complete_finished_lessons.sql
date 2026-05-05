-- 055_complete_finished_lessons.sql
-- ============================================================
-- Авто-завершение уроков, на которые подключились (in_progress).
--
-- Было: /api/jitsi/token при первом подключении переводил status в
-- 'in_progress', но никто не переводил 'in_progress' в 'completed'.
-- Урок «висел» в личном кабинете и студент не получал XP (триггер
-- on_lesson_completed срабатывает только при переходе → completed).
--
-- Теперь: pg_cron каждые 5 минут переводит в completed уроки, у
-- которых scheduled_at + duration + LESSON_POST_WINDOW (5 мин) уже
-- прошёл. Окно 5 минут совпадает с LESSON_POST_WINDOW в
-- src/lib/constants.ts — после него jitsi-комната всё равно
-- закрывается через jitsi/token.
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_finished_lessons()
RETURNS TABLE (lesson_id uuid, scheduled_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.lessons
     SET status = 'completed',
         updated_at = NOW()
   WHERE status = 'in_progress'
     AND scheduled_at + (duration_minutes || ' minutes')::interval + interval '5 minutes' < NOW()
  RETURNING id, scheduled_at;
$$;

REVOKE ALL ON FUNCTION public.complete_finished_lessons() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_finished_lessons() TO service_role;

-- pg_cron — каждые 5 минут (идемпотентно).
DO $$
DECLARE existing_id int;
BEGIN
  SELECT jobid INTO existing_id FROM cron.job WHERE jobname = 'complete_finished_lessons';
  IF existing_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_id);
  END IF;
  PERFORM cron.schedule(
    'complete_finished_lessons',
    '*/5 * * * *',
    'SELECT public.complete_finished_lessons();'
  );
END $$;
