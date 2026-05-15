-- ============================================================================
-- 30_materials.sql — RLS на public.materials + material_shares
-- ============================================================================
-- Покрывает:
--   • teacher T (owner) видит M1
--   • studentA (участник L1, к которому привязан M1) видит M1
--   • studentB (НЕ участник) НЕ видит M1 БЕЗ share
--   • studentB видит M1 после INSERT material_shares.target_type='student'
--   • stranger Z никогда не видит M1
-- ============================================================================

BEGIN;

-- ---- teacher (owner) видит свой material ----
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.materials WHERE id = '22222222-0000-0000-0000-000000000001';
  IF n <> 1 THEN
    RAISE EXCEPTION 'fail 30.1: teacher owner should see own material (got %)', n;
  END IF;
END $$;

-- ---- studentA — участник L1, должен видеть M1 ----
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.materials WHERE id = '22222222-0000-0000-0000-000000000001';
  IF n <> 1 THEN
    RAISE EXCEPTION 'fail 30.2: lesson participant should see material (got %)', n;
  END IF;
END $$;

-- ---- studentB — НЕ участник L1, НЕ должен видеть M1 ----
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.materials WHERE id = '22222222-0000-0000-0000-000000000001';
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 30.3: leak — non-participant studentB saw % material rows', n;
  END IF;
END $$;

-- ---- share studentB → M1: ДОЛЖЕН увидеть ----
-- Создаём share от роли teacher (он owner).
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
SET LOCAL ROLE authenticated;

INSERT INTO public.material_shares (material_id, target_type, target_id)
VALUES (
  '22222222-0000-0000-0000-000000000001',
  'student',
  'aaaaaaaa-0000-0000-0000-000000000002'
)
ON CONFLICT DO NOTHING;

SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.materials WHERE id = '22222222-0000-0000-0000-000000000001';
  IF n <> 1 THEN
    RAISE EXCEPTION 'fail 30.4: share recipient studentB should see material (got %)', n;
  END IF;
END $$;

-- ---- stranger Z — НИКОГДА не видит ----
SET LOCAL "request.jwt.claims" = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.materials WHERE id = '22222222-0000-0000-0000-000000000001';
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 30.5: leak — stranger saw % material rows', n;
  END IF;
END $$;

ROLLBACK;
SELECT '30_materials: ok' AS status;
