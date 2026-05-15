-- EMERGENCY: проект упёрся в Supabase Disk IO Budget на Micro tier.
-- Применить сразу как только DB recover'ится (через MCP, SQL editor,
-- или psql).
--
-- Что делает:
--   1. DROP trigger из миграции 076 (вернёт UPDATE-привилегии)
--   2. DROP generic data triggers с миграции 071 (audit на каждый
--      INSERT/UPDATE/DELETE — главный killer IO)
--   3. Reschedule cron jobs пореже / отключение лишних
--   4. TRUNCATE csp_violations (накопилось много, не критично)
--
-- ВАЖНО: audit explicit events (signin, payment_created, role_changed)
-- из API routes — продолжают работать (они вызывают audit.log_event
-- RPC, не через trigger). Сохраняем самое важное audit-покрытие.

-- ===========================================================
-- 1. ROLLBACK 076 (privileged-fields guard)
-- ===========================================================
DROP TRIGGER IF EXISTS trg_guard_privileged_profile_fields ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self_student_only" ON public.profiles;
GRANT UPDATE (role, balance_rub, subscription_tier, subscription_until,
              referred_by_user_id, is_active, email)
ON public.profiles TO authenticated;

-- ===========================================================
-- 2. DROP generic data audit triggers (миграция 071)
-- ===========================================================
DROP TRIGGER IF EXISTS audit_profiles_change ON public.profiles;
DROP TRIGGER IF EXISTS audit_lessons_change ON public.lessons;
DROP TRIGGER IF EXISTS audit_payments_change ON public.payments;
DROP TRIGGER IF EXISTS audit_materials_change ON public.materials;

-- ===========================================================
-- 3. CRON jobs — reschedule пореже
-- ===========================================================
-- Удалим / отключим лишние. Сохраняем критичные (lesson-reminders,
-- mark-missed-lessons).
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT jobname FROM cron.job LOOP
    -- список job'ов которые удаляем (раз в неделю + ежечасные cleanup)
    IF j.jobname IN (
      'audit_ensure_partitions',   -- партиции на месяц вперёд можно делать раз в день
      'transcribe_recordings',
      'summarize_transcripts',
      'streak_warning',
      'weekly_digest',
      'daily_challenge'
    ) THEN
      PERFORM cron.unschedule(j.jobname);
      RAISE NOTICE 'unscheduled cron job: %', j.jobname;
    END IF;
  END LOOP;
END $$;

-- ===========================================================
-- 4. TRUNCATE логи которые накопились
-- ===========================================================
TRUNCATE public.csp_violations;

-- Старые партиции audit_log за 2026-04..06 — освободить место
DO $$
DECLARE
  p text;
BEGIN
  FOR p IN
    SELECT n.nspname || '.' || c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'audit'
      AND c.relname LIKE 'audit_log_2026%'
      AND c.relkind = 'r'
      AND c.relname < 'audit_log_202607'  -- старше июля 2026
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || p || ' CASCADE';
    RAISE NOTICE 'dropped partition: %', p;
  END LOOP;
END $$;

-- ===========================================================
-- 5. VACUUM крупных таблиц чтобы реально освободить место
-- ===========================================================
-- VACUUM FULL требует ACCESS EXCLUSIVE — выполнять отдельно после
-- основной миграции, в момент низкой нагрузки.
-- Не делаем в одной транзакции с TRUNCATE.

SELECT 'emergency reduce IO done' AS status;
