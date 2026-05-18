-- ============================================================================
-- 60_subscriptions.sql — RLS on public.lesson_subscriptions (migration 082)
-- ============================================================================

BEGIN;

-- studentA sees own subscription row only (inserted in setup via service role below)
SET LOCAL ROLE service_role;

INSERT INTO public.lesson_subscriptions (
  id, student_id, teacher_id, weekly_pattern, starts_on, ends_on, price_kopecks, status
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000099',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  '[{"dow":1,"time":"19:00","duration_min":50}]'::jsonb,
  CURRENT_DATE,
  CURRENT_DATE + 28,
  0,
  'active'
) ON CONFLICT (id) DO NOTHING;

-- studentA sees own
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.lesson_subscriptions
   WHERE id = 'aaaaaaaa-0000-0000-0000-000000000099';
  IF n <> 1 THEN
    RAISE EXCEPTION 'fail 60.1: studentA should see own subscription (got %)', n;
  END IF;
END $$;

-- stranger cannot see
SET LOCAL "request.jwt.claims" = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.lesson_subscriptions
   WHERE id = 'aaaaaaaa-0000-0000-0000-000000000099';
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 60.2: stranger leaked subscription (% rows)', n;
  END IF;
END $$;

ROLLBACK;
