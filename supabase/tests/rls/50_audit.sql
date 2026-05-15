-- ============================================================================
-- 50_audit.sql — RLS на audit.audit_log (миграция 071)
-- ============================================================================
-- Покрывает: audit-логи видны ТОЛЬКО admin'у. student/teacher/anon —
-- получают 0 строк.
-- ============================================================================

BEGIN;

-- Сначала запишем одну тестовую строку через INSERT от service-role
-- (audit_log по миграции 071 принимает только service-role INSERT'ы или
-- через SECURITY DEFINER RPC; здесь мы используем direct INSERT под
-- postgres'ом, потому что в тестах CLI запускается из owner-роли).
-- Schema (071): category in {'auth','admin','payment','data'}; используем 'admin'.
INSERT INTO audit.audit_log (category, action, actor_user_id, actor_role, target_type, target_id, payload)
VALUES ('admin', 'rls.test', 'cccccccc-0000-0000-0000-000000000001', 'admin', 'test', 'rls-test', '{"src":"50_audit"}'::jsonb);

-- NB: authenticated/anon обычно НЕ имеют USAGE на schema audit + SELECT на
-- audit.audit_log. RLS policy audit_log_select_admin существует, но
-- grant-слой бьёт первым. Это нормально — admin ходит через service-role
-- (admin client), не через user JWT. Поэтому non-admin тесты считают
-- доступ нулевым, если EXECUTE вернул insufficient_privilege.
--
-- Используем EXECUTE с trapping, чтобы plpgsql не упал на парсинге.

-- ---- student: 0 строк ----
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  BEGIN
    EXECUTE 'SELECT count(*) FROM audit.audit_log WHERE action = ''rls.test''' INTO n;
  EXCEPTION WHEN insufficient_privilege THEN n := 0;
    WHEN OTHERS THEN IF SQLSTATE = '42501' THEN n := 0; ELSE RAISE; END IF;
  END;
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 50.1: leak — student saw % audit rows', n;
  END IF;
END $$;

-- ---- teacher: 0 строк ----
SET LOCAL "request.jwt.claims" = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE n int;
BEGIN
  BEGIN
    EXECUTE 'SELECT count(*) FROM audit.audit_log WHERE action = ''rls.test''' INTO n;
  EXCEPTION WHEN insufficient_privilege THEN n := 0;
    WHEN OTHERS THEN IF SQLSTATE = '42501' THEN n := 0; ELSE RAISE; END IF;
  END;
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 50.2: leak — teacher saw % audit rows', n;
  END IF;
END $$;

-- ---- admin: видит ≥1 (через service-role/postgres) ----
-- Здесь мы НЕ переключаем на authenticated, потому что в проде admin-API
-- использует admin-client (service_role). Под service_role RLS отключён;
-- значит "admin видит" эквивалентно "postgres видит ≥1 строку".
RESET ROLE;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM audit.audit_log WHERE action = 'rls.test';
  IF n < 1 THEN
    RAISE EXCEPTION 'fail 50.3: service-role/admin should see audit row (got %)', n;
  END IF;
END $$;

-- ---- anon: 0 строк ----
-- Anon не имеет USAGE на schema audit, поэтому простой SELECT вызывает
-- permission_denied. Используем EXECUTE чтобы plpgsql не пытался захватить
-- объект на этапе компиляции, и явно ловим SQLSTATE '42501'.
RESET ROLE;
SET LOCAL ROLE anon;

DO $$
DECLARE n int;
BEGIN
  BEGIN
    EXECUTE 'SELECT count(*) FROM audit.audit_log WHERE action = ''rls.test''' INTO n;
  EXCEPTION
    WHEN insufficient_privilege THEN n := 0;
    WHEN OTHERS THEN
      IF SQLSTATE = '42501' THEN n := 0;
      ELSE RAISE;
      END IF;
  END;
  IF n <> 0 THEN
    RAISE EXCEPTION 'fail 50.4: leak — anon saw % audit rows', n;
  END IF;
END $$;

ROLLBACK;
SELECT '50_audit: ok' AS status;
