-- ============================================================================
-- 61_badges.sql — RLS on public.notification_badges (migration 083)
-- ============================================================================

BEGIN;

SET LOCAL ROLE service_role;

INSERT INTO public.notification_badges (
  id, user_id, category, event_type, payload
) VALUES (
  'bbbbbbbb-0000-0000-0000-000000000099',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'schedule',
  'lesson_booked',
  '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.notification_badges
   WHERE id = 'bbbbbbbb-0000-0000-0000-000000000099' AND seen_at IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'fail 61.1: studentA should see own unread badge (got %)', n;
  END IF;
END $$;

SET LOCAL "request.jwt.claims" = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.notification_badges
   WHERE id = 'bbbbbbbb-0000-0000-0000-000000000099';
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 61.2: stranger leaked badge (% rows)', n;
  END IF;
END $$;

ROLLBACK;
