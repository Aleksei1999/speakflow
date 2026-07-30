-- Race-condition hardening for YooKassa webhook.
--
-- src/app/api/payments/webhook/route.ts does:
--   supabase.from('payments').upsert({...}, { onConflict: 'lesson_id' })
--   supabase.from('teacher_earnings').upsert({...}, { onConflict: 'lesson_id' })
-- Both rely on a UNIQUE constraint that never existed — only a plain btree
-- index. Under concurrent webhook retries (YooKassa re-delivers on non-2xx
-- or timeout) two workers can pass the "already succeeded?" pre-check and
-- both INSERT into teacher_earnings → double payout when the payout job
-- sums net_amount by teacher_id.
--
-- The DO $$ block refuses to add the constraint if duplicates already exist,
-- so a silently-broken production dataset surfaces here instead of at ALTER
-- time with a cryptic 23505.

DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT lesson_id FROM payments
    GROUP BY lesson_id HAVING COUNT(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to add UNIQUE(payments.lesson_id): % duplicate lesson_id groups exist. Dedupe manually before re-running.',
      dup_count;
  END IF;

  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT lesson_id FROM teacher_earnings
    GROUP BY lesson_id HAVING COUNT(*) > 1
  ) t;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to add UNIQUE(teacher_earnings.lesson_id): % duplicate lesson_id groups exist. Dedupe manually before re-running.',
      dup_count;
  END IF;
END
$$;

ALTER TABLE payments
  ADD CONSTRAINT payments_lesson_id_unique UNIQUE (lesson_id);

ALTER TABLE teacher_earnings
  ADD CONSTRAINT teacher_earnings_lesson_id_unique UNIQUE (lesson_id);
