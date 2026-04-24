-- 038_pg_cron_notifications.sql
-- Move sub-daily notification crons from Vercel (Hobby limit: daily only)
-- to pg_cron + pg_net, calling our Next.js endpoints directly from Postgres.
--
-- Moves:
--   lesson-reminders  (every 5 min)  -> net.http_get  /api/internal/cron/lesson-reminders
--   queue drain       (every 2 min)  -> net.http_post /api/internal/notifications/drain
--
-- Daily crons (daily-challenge, streak-warning, weekly-digest) stay on Vercel Cron.
--
-- Auth: CRON_SECRET is stored in Supabase Vault as name='cron_secret' and read
-- at run time by the cron command. Same value must live in Vercel env CRON_SECRET
-- so both sides share the shared-secret check.
--
-- To set / rotate the secret:
--   SELECT vault.create_secret('<value>', 'cron_secret', 'Shared secret for Vercel cron endpoints');
--   -- rotation:
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'cron_secret'),
--     '<new_value>'
--   );

BEGIN;

-- ==========================================================
-- 1. Extensions
-- ==========================================================
-- pg_cron: already enabled in migration 020 (refresh_leaderboards), but guard anyway.
CREATE EXTENSION IF NOT EXISTS pg_cron  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net   WITH SCHEMA extensions;

-- ==========================================================
-- 2. Unschedule any prior versions (idempotent)
-- ==========================================================
DO $$
BEGIN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname IN (
       'notifications_lesson_reminders',
       'notifications_queue_drain'
     );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ==========================================================
-- 3. Schedule: lesson reminders (every 5 min)
-- ==========================================================
-- Calls GET /api/internal/cron/lesson-reminders with
--   Authorization: Bearer <cron_secret>
-- Endpoint selects lessons starting in +25..+35 min and fan-outs reminders.
SELECT cron.schedule(
  'notifications_lesson_reminders',
  '*/5 * * * *',
  $cron$
    SELECT net.http_get(
      url := 'https://raw-english.com/api/internal/cron/lesson-reminders',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          SELECT decrypted_secret
            FROM vault.decrypted_secrets
           WHERE name = 'cron_secret'
           LIMIT 1
        )
      ),
      timeout_milliseconds := 30000
    );
  $cron$
);

-- ==========================================================
-- 4. Schedule: notifications queue drain (every 2 min)
-- ==========================================================
-- Calls POST /api/internal/notifications/drain directly (skips Vercel bridge)
-- with header x-cron-secret: <cron_secret>. Endpoint drains up to 100 rows
-- per tick from public.notifications_queue.
SELECT cron.schedule(
  'notifications_queue_drain',
  '*/2 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://raw-english.com/api/internal/notifications/drain',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret
            FROM vault.decrypted_secrets
           WHERE name = 'cron_secret'
           LIMIT 1
        )
      ),
      timeout_milliseconds := 30000
    );
  $cron$
);

COMMIT;
