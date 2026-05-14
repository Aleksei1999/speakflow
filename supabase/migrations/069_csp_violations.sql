-- Сохраняем CSP violation reports в БД для последующего анализа.
-- До этого летели только в Vercel logs и терялись через 7 дней.
--
-- Запросы будут:
--   SELECT directive, blocked, count(*) FROM csp_violations
--    WHERE created_at > now() - interval '7 days'
--    GROUP BY 1,2 ORDER BY 3 desc;
-- → топ нарушений, чтобы понять что расширить в policy перед enforce.

CREATE TABLE IF NOT EXISTS public.csp_violations (
  id            bigserial PRIMARY KEY,
  directive     text NOT NULL,
  blocked       text NOT NULL,
  document_uri  text,
  sample        text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Индекс для отчётности по типу нарушения и времени.
CREATE INDEX IF NOT EXISTS csp_violations_directive_created_idx
  ON public.csp_violations (directive, created_at DESC);

-- Дедуп: одна и та же связка (directive, blocked, doc) хранится один раз
-- в час. date_trunc нельзя — он не IMMUTABLE (зависит от timezone).
-- Поэтому immutable wrapper над epoch/3600.
CREATE OR REPLACE FUNCTION public.csp_hour_bucket(ts timestamptz)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT (EXTRACT(EPOCH FROM ts)::bigint / 3600)
$$;

CREATE UNIQUE INDEX IF NOT EXISTS csp_violations_dedup_idx
  ON public.csp_violations (
    directive,
    blocked,
    coalesce(document_uri, ''),
    public.csp_hour_bucket(created_at)
  );

-- RLS: только service_role может писать; admin может читать через свои API.
ALTER TABLE public.csp_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS csp_violations_admin_read ON public.csp_violations;
CREATE POLICY csp_violations_admin_read ON public.csp_violations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Ежедневный clean-up: удаляем нарушения старше 30 дней.
CREATE OR REPLACE FUNCTION public.cleanup_old_csp_violations()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  WITH d AS (
    DELETE FROM public.csp_violations
     WHERE created_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_csp_violations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_csp_violations() TO service_role;

DO $$
DECLARE jid int;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'cleanup_csp_violations' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup_csp_violations',
  '15 1 * * *', -- 01:15 UTC каждый день
  'SELECT public.cleanup_old_csp_violations();'
);
