-- ---------------------------------------------------------------------------
-- Чистка легаси 10.09.2026: снимаем pg_cron-задачи удалённых фич
-- (лидерборд и подписки на уроки). Код этих фич удалён из приложения.
-- Таблицы не трогаем. Применять в Supabase SQL Editor.
-- Задачи записи/транскрибации уроков (ai_transcribe_recordings,
-- ai_summarize_transcripts, sweep/cleanup recordings) оставляем — запись
-- подключается к LiveKit.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE jobname IN ('refresh-leaderboards', 'lesson_subscriptions_extend') LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'unscheduled %', r.jobname;
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
