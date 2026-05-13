-- ==========================================================
-- 060 · Auto-finalize stuck lesson recordings
-- ==========================================================
-- Если recorder в браузере не дошёл до finalize (краш страницы,
-- закрытие сети, не отработал beforeunload) — row остаётся в
-- status='recording' навсегда. Без него transcribe-cron не подберёт
-- запись, и весь Phase 1.3 pipeline стоит. После 4 часов точно
-- известно что урок закончился, мы помечаем такие записи finalized
-- автоматом — пусть Whisper хотя бы попробует.

CREATE OR REPLACE FUNCTION public.sweep_stuck_lesson_recordings()
RETURNS TABLE (recording_id uuid, started_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.lesson_recordings
     SET status = 'finalized',
         finalized_at = NOW(),
         error_message = COALESCE(error_message, 'auto-finalized: no client finalize within 4h')
   WHERE status = 'recording'
     AND started_at < NOW() - INTERVAL '4 hours'
  RETURNING id, started_at;
$$;

REVOKE ALL ON FUNCTION public.sweep_stuck_lesson_recordings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_stuck_lesson_recordings() TO service_role;

-- pg_cron — каждые 30 минут.
DO $$
DECLARE jid int;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'sweep_stuck_lesson_recordings' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'sweep_stuck_lesson_recordings',
  '*/30 * * * *',
  'SELECT public.sweep_stuck_lesson_recordings();'
);
