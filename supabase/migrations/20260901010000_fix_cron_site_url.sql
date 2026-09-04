-- ==========================================================
-- 20260901010000 · Fix pg_cron site URL for AI pipeline
-- ==========================================================
-- Миграции 058/059 захардкодили `https://raw-english.com/...` в pg_cron
-- задачах `ai_transcribe_recordings` и `ai_summarize_transcripts`.
-- Прод-домен теперь `speakflow-peach.vercel.app`, поэтому net.http_post
-- падал с DNS-ошибкой и AI-пайплайн не работал.
--
-- Читаем URL из vault.decrypted_secrets['site_url'] — так если домен снова
-- поменяется, надо будет только ротировать vault-секрет, не миграцию.
-- Если секрета нет — фолбэчимся на `speakflow-peach.vercel.app` (текущий).
--
-- Bearer берётся из vault.decrypted_secrets['cron_secret'] — как в 058/059.
-- ==========================================================

-- ---------- site_url secret (idempotent seed) ----------
-- vault.create_secret падает если имя уже занято → делаем через if-exists.
DO $$
DECLARE
  existing UUID;
BEGIN
  SELECT id INTO existing FROM vault.secrets WHERE name = 'site_url' LIMIT 1;
  IF existing IS NULL THEN
    PERFORM vault.create_secret(
      'https://speakflow-peach.vercel.app',
      'site_url',
      'Base URL used by pg_cron → /api/internal/cron/* HTTP-callbacks'
    );
  END IF;
END $$;

-- ---------- ai_transcribe_recordings ----------
DO $$
DECLARE jid int;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'ai_transcribe_recordings' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'ai_transcribe_recordings',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'site_url' LIMIT 1
      ) || '/api/internal/cron/transcribe-recordings',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1
        )
      ),
      timeout_milliseconds := 300000
    );
  $cron$
);

-- ---------- ai_summarize_transcripts ----------
DO $$
DECLARE jid int;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'ai_summarize_transcripts' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'ai_summarize_transcripts',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'site_url' LIMIT 1
      ) || '/api/internal/cron/summarize-transcripts',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1
        )
      ),
      timeout_milliseconds := 300000
    );
  $cron$
);
