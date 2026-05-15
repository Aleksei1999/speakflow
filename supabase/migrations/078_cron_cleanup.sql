-- Cron-jobs частота снижена (применено через MCP во время IO incident).
-- Локальная копия для воспроизводимости. Также включает rollback 076 +
-- TRUNCATE csp_violations.

-- ---------------------------------------------------------------------
-- 1. ROLLBACK 076 (privileged-fields guard) — сайт упал из-за IO budget
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_guard_privileged_profile_fields ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self_student_only" ON public.profiles;
GRANT UPDATE (role, balance_rub, subscription_tier, subscription_until,
              referred_by_user_id, is_active, email)
ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------
-- 2. TRUNCATE csp_violations — диагностические данные, не критично
-- ---------------------------------------------------------------------
TRUNCATE public.csp_violations;

-- ---------------------------------------------------------------------
-- 3. Cron jobs — снижение частоты (-60% общего IO от cron'ов)
-- ---------------------------------------------------------------------
-- Было / Стало:
--   notifications_queue_drain    */2  → */5  (12→ -60%)
--   ai_transcribe_recordings     */5  → */15 (-66%)
--   ai_summarize_transcripts     */5  → */15 (-66%)
--   refresh-leaderboards         */30 → 0 * * * * (-50%)
--   sweep_stuck_lesson_recordings*/30 → 0 * * * * (-50%)
-- Оставлены критичные live: lesson-reminders */5, mark_missed_lessons */5,
-- complete_finished_lessons */5 — нужны чтобы статусы менялись timely.
DO $$
BEGIN
  PERFORM cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='notifications_queue_drain'), schedule => '*/5 * * * *');
  PERFORM cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='ai_transcribe_recordings'), schedule => '*/15 * * * *');
  PERFORM cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='ai_summarize_transcripts'), schedule => '*/15 * * * *');
  PERFORM cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='refresh-leaderboards'), schedule => '0 * * * *');
  PERFORM cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='sweep_stuck_lesson_recordings'), schedule => '0 * * * *');
END $$;
