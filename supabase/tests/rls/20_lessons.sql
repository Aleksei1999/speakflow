-- ============================================================================
-- 20_lessons.sql — RLS на public.lessons
-- ============================================================================
-- Покрывает:
--   • student видит ТОЛЬКО свои уроки
--   • teacher видит ТОЛЬКО свои уроки
--   • stranger не видит ничего из тестовых уроков
--   • admin видит оба тестовых урока
-- ============================================================================

BEGIN;

-- ---- studentA видит L1 (свой) и НЕ видит L2 (чужой) ----
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n_own int; n_other int;
BEGIN
  SELECT count(*) INTO n_own   FROM public.lessons WHERE id = '11111111-0000-0000-0000-000000000001';
  SELECT count(*) INTO n_other FROM public.lessons WHERE id = '11111111-0000-0000-0000-000000000002';
  IF n_own <> 1 THEN
    RAISE EXCEPTION 'fail 20.1: studentA should see own lesson L1 (got %)', n_own;
  END IF;
  IF n_other <> 0 THEN
    RAISE EXCEPTION 'fail 20.2: leak — studentA saw L2 (% rows)', n_other;
  END IF;
END $$;

-- ---- teacher T видит ОБА урока ----
SET LOCAL "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.lessons WHERE id IN (
    '11111111-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000002'
  );
  IF n <> 2 THEN
    RAISE EXCEPTION 'fail 20.3: teacher T should see both lessons (got %)', n;
  END IF;
END $$;

-- ---- stranger Z не видит ни одного тестового урока ----
SET LOCAL "request.jwt.claims" = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.lessons WHERE id IN (
    '11111111-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000002'
  );
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 20.4: leak — stranger saw % test lessons', n;
  END IF;
END $$;

-- ---- admin X видит оба ----
SET LOCAL "request.jwt.claims" = '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.lessons WHERE id IN (
    '11111111-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000002'
  );
  IF n <> 2 THEN
    RAISE EXCEPTION 'fail 20.5: admin should see both test lessons (got %)', n;
  END IF;
END $$;

ROLLBACK;
SELECT '20_lessons: ok' AS status;
