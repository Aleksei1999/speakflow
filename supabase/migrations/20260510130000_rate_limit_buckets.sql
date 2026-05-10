-- Sliding-window rate limit, postgres-side. Hranim po dnyu, chistim kazhdyi
-- chas pg_cron'om. Service-role-only — bekend dergaet check_rate_limit()
-- cherez createAdminClient(), klient nikogda.

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id          BIGSERIAL PRIMARY KEY,
  bucket      TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_events_bucket_time_idx
  ON public.rate_limit_events (bucket, occurred_at DESC);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
-- Bez politik anon/authenticated ne imeyut dostupa.

-- check_rate_limit(bucket, max_requests, window_seconds) -> boolean
--   true  — zapros razreshen, sobytiye zapisano
--   false — limit prevyshen, sobytiye NE zapisano
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket          TEXT,
  p_max_requests    INTEGER,
  p_window_seconds  INTEGER
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count INTEGER;
  v_since TIMESTAMPTZ;
BEGIN
  IF p_bucket IS NULL OR length(p_bucket) = 0 THEN
    RETURN true;
  END IF;
  IF p_max_requests <= 0 OR p_window_seconds <= 0 THEN
    RETURN true;
  END IF;

  v_since := now() - make_interval(secs => p_window_seconds);

  SELECT count(*) INTO v_count
  FROM rate_limit_events
  WHERE bucket = p_bucket
    AND occurred_at >= v_since;

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO rate_limit_events (bucket) VALUES (p_bucket);
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- Cleanup raz v chas via pg_cron (ne vklyucheno v migration body iz-za
-- dollar-quoting konflikta). Vypolneno otdel'no:
--   SELECT cron.schedule('rate_limit_cleanup', '17 * * * *',
--     'DELETE FROM public.rate_limit_events WHERE occurred_at < now() - interval ''24 hours''');
