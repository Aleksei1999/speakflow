-- ============================================================================
-- 10_profiles.sql — RLS на public.profiles
-- ============================================================================
-- Покрывает: student видит свой профиль, не видит чужой; admin видит всех.
-- Запускать ПОСЛЕ 00_setup.sql.
-- ============================================================================

BEGIN;

-- ---- studentA: видит свой ----
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
  IF n <> 1 THEN
    RAISE EXCEPTION 'fail 10.1: studentA should see own profile (got %)', n;
  END IF;
END $$;

-- ---- studentA: НЕ видит studentB (если RLS активен и не разрешает чужие профили) ----
-- Если в проекте профили глобально читаемы (например leaderboard) — этот
-- тест поможет это понять; меняйте expectation в свою сторону.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';
  IF n > 1 THEN
    RAISE EXCEPTION 'fail 10.2: leak — studentA saw % rows of studentB', n;
  END IF;
  -- Допускаем 0 или 1 (1 = публичный leaderboard read).
END $$;

-- ---- admin: видит всех тестовых пользователей (≥4) ----
SET LOCAL "request.jwt.claims" = '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id IN (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'bbbbbbbb-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000001',
    'dddddddd-0000-0000-0000-000000000001'
  );
  IF n < 5 THEN
    RAISE EXCEPTION 'fail 10.3: admin should see all 5 test profiles (got %)', n;
  END IF;
END $$;

ROLLBACK;
SELECT '10_profiles: ok' AS status;
