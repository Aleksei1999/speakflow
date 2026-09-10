-- ---------------------------------------------------------------------------
-- Автосписание стоимости урока с баланса ученика при завершении урока.
--
--  * balance_transactions — журнал движений баланса (пополнения, списания).
--  * Баланс не уходит в минус: ученик без достаточного баланса не может
--    подключиться к уроку (проверка в /api/livekit/token). Если к моменту
--    завершения денег всё же не хватило — списывается остаток, в журнале
--    отмечается недостача.
--  * Триггер на lessons: status → completed ⇒ списать lessons.price (копейки),
--    если урок не был оплачен отдельным платежом (payments.status='succeeded')
--    и списание ещё не делалось (идемпотентно).
--  * credit_student_balance дополнительно пишет строку журнала.
-- Применять в Supabase SQL Editor.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id       UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  topup_id        UUID REFERENCES public.balance_topups(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('topup', 'lesson_charge', 'refund', 'adjustment')),
  amount_kopecks  BIGINT NOT NULL,          -- со знаком: пополнение > 0, списание < 0
  balance_after   BIGINT NOT NULL,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_balance_tx_user ON public.balance_transactions (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS balance_tx_one_charge_per_lesson
  ON public.balance_transactions (lesson_id) WHERE kind = 'lesson_charge';

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS balance_tx_select_own ON public.balance_transactions;
CREATE POLICY balance_tx_select_own ON public.balance_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Пополнение: как раньше + строка журнала.
CREATE OR REPLACE FUNCTION public.credit_student_balance(uid UUID, amount_add BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance BIGINT;
BEGIN
  IF amount_add <= 0 THEN
    RAISE EXCEPTION 'credit_student_balance: amount must be > 0, got %', amount_add;
  END IF;
  INSERT INTO student_balances (user_id, balance_kopecks, updated_at)
  VALUES (uid, amount_add, now())
  ON CONFLICT (user_id)
  DO UPDATE SET balance_kopecks = student_balances.balance_kopecks + EXCLUDED.balance_kopecks,
                updated_at = now()
  RETURNING balance_kopecks INTO new_balance;
  INSERT INTO balance_transactions (user_id, kind, amount_kopecks, balance_after, comment)
  VALUES (uid, 'topup', amount_add, new_balance, 'Пополнение баланса');
  RETURN new_balance;
END;
$$;

-- Списание за завершённый урок.
CREATE OR REPLACE FUNCTION public.charge_lesson_from_balance()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price BIGINT := COALESCE(NEW.price, 0);
  v_balance BIGINT;
  v_charge BIGINT;
  v_new_balance BIGINT;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status IS NOT DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.student_id IS NULL OR v_price <= 0 THEN
    RETURN NEW;
  END IF;
  -- Урок оплачен отдельным платежом — с баланса не списываем.
  IF EXISTS (SELECT 1 FROM payments p WHERE p.lesson_id = NEW.id AND p.status = 'succeeded') THEN
    RETURN NEW;
  END IF;
  -- Уже списано (идемпотентность).
  IF EXISTS (SELECT 1 FROM balance_transactions t WHERE t.lesson_id = NEW.id AND t.kind = 'lesson_charge') THEN
    RETURN NEW;
  END IF;
  INSERT INTO student_balances (user_id, balance_kopecks, updated_at)
  VALUES (NEW.student_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_kopecks INTO v_balance FROM student_balances WHERE user_id = NEW.student_id FOR UPDATE;
  v_charge := LEAST(COALESCE(v_balance, 0), v_price);
  IF v_charge > 0 THEN
    UPDATE student_balances
       SET balance_kopecks = balance_kopecks - v_charge, updated_at = now()
     WHERE user_id = NEW.student_id
     RETURNING balance_kopecks INTO v_new_balance;
  ELSE
    v_new_balance := COALESCE(v_balance, 0);
  END IF;
  INSERT INTO balance_transactions (user_id, lesson_id, kind, amount_kopecks, balance_after, comment)
  VALUES (
    NEW.student_id, NEW.id, 'lesson_charge', -v_charge, v_new_balance,
    'Урок ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Moscow', 'DD.MM HH24:MI')
      || CASE WHEN v_charge < v_price THEN ' — не хватило ' || ((v_price - v_charge) / 100)::text || ' ₽' ELSE '' END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_charge_lesson_from_balance ON public.lessons;
CREATE TRIGGER trg_charge_lesson_from_balance
  AFTER UPDATE OF status ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.charge_lesson_from_balance();
