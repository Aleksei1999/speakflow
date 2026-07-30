-- handleRefundSucceeded в src/app/api/payments/webhook/route.ts делает
--   supabase.from('teacher_earnings').update({ status: 'cancelled' })
-- Но CHECK из 004_payments.sql разрешает только ('pending','available','paid_out').
-- При первом же реальном refund handler бросит 23514 и upstream 500.
-- Добавляем 'cancelled' в разрешённый набор.

ALTER TABLE teacher_earnings
  DROP CONSTRAINT IF EXISTS teacher_earnings_status_check;

ALTER TABLE teacher_earnings
  ADD CONSTRAINT teacher_earnings_status_check
  CHECK (status IN ('pending', 'available', 'paid_out', 'cancelled'));
