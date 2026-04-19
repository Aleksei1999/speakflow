-- 020_cron_refresh_leaderboards.sql
-- Schedule refresh_leaderboards() via pg_cron.
--
-- NOTE: pg_cron must be enabled in the Supabase project first:
--   Dashboard → Database → Extensions → enable "pg_cron".
-- Supabase installs it into the "extensions" schema.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Idempotent re-schedule: drop any prior job with the same name, then schedule.
DO $$
BEGIN
    PERFORM cron.unschedule(jobid)
       FROM cron.job
      WHERE jobname = 'refresh-leaderboards';
EXCEPTION WHEN OTHERS THEN
    -- cron.job may not exist yet on the very first run; ignore.
    NULL;
END $$;

SELECT cron.schedule(
    'refresh-leaderboards',
    '*/10 * * * *',                     -- every 10 minutes
    $$SELECT refresh_leaderboards()$$
);

-- Verification query (run manually after apply):
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'refresh-leaderboards';
--   SELECT * FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'refresh-leaderboards')
--    ORDER BY start_time DESC LIMIT 5;
