-- ---------------------------------------------------------------------------
-- Возвраты пополнений (refund.succeeded из ЮKassa) и резерв баланса.
-- Применять в Supabase SQL Editor после 20260910180000_cabinets_privacy.sql.
--
--  1) balance_topups: статус 'refunded', сумма и время возврата.
--  2) balance_transactions.external_id — id возврата ЮKassa, уникален:
--     повторный вебхук не спишет дважды.
--  3) debit_student_balance(): списание с журналом (kind='refund'), только
--     service_role. Баланс не уходит в минус: если деньги уже потрачены на
--     уроки, списывается доступный остаток, разница пишется в comment.
-- ---------------------------------------------------------------------------

ALTER TABLE public.balance_topups DROP CONSTRAINT IF EXISTS balance_topups_status_check;
ALTER TABLE public.balance_topups
  ADD CONSTRAINT balance_topups_status_check CHECK (status IN ('pending', 'succeeded', 'cancelled', 'refunded'));
ALTER TABLE public.balance_topups ADD COLUMN IF NOT EXISTS refunded_kopecks BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.balance_topups ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

ALTER TABLE public.balance_transactions ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS balance_tx_external_id_idx
  ON public.balance_transactions (external_id) WHERE external_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.debit_student_balance(
  uid uuid, amount_sub bigint, p_topup_id uuid DEFAULT NULL, p_external_id text DEFAULT NULL, p_comment text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance bigint;
  v_debit bigint;
  v_new_balance bigint;
BEGIN
  IF amount_sub <= 0 THEN
    RAISE EXCEPTION 'debit_student_balance: amount must be > 0, got %', amount_sub;
  END IF;
  -- идемпотентность по внешнему id
  IF p_external_id IS NOT NULL AND EXISTS (SELECT 1 FROM balance_transactions WHERE external_id = p_external_id) THEN
    RETURN 0;
  END IF;
  INSERT INTO student_balances (user_id, balance_kopecks, updated_at)
  VALUES (uid, 0, now())
  ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_kopecks INTO v_balance FROM student_balances WHERE user_id = uid FOR UPDATE;
  v_debit := LEAST(COALESCE(v_balance, 0), amount_sub);
  IF v_debit > 0 THEN
    UPDATE student_balances SET balance_kopecks = balance_kopecks - v_debit, updated_at = now()
     WHERE user_id = uid RETURNING balance_kopecks INTO v_new_balance;
  ELSE
    v_new_balance := COALESCE(v_balance, 0);
  END IF;
  INSERT INTO balance_transactions (user_id, topup_id, kind, amount_kopecks, balance_after, external_id, comment)
  VALUES (
    uid, p_topup_id, 'refund', -v_debit, v_new_balance, p_external_id,
    COALESCE(p_comment, 'Возврат пополнения')
      || CASE WHEN v_debit < amount_sub THEN ' — на балансе не хватило ' || ((amount_sub - v_debit) / 100)::text || ' ₽' ELSE '' END
  );
  RETURN v_debit;
END;
$$;
REVOKE ALL ON FUNCTION public.debit_student_balance(uuid, bigint, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_student_balance(uuid, bigint, uuid, text, text) TO service_role;
