-- ---------------------------------------------------------------------------
-- Исправление 20260910130000: баланс не уходит в минус.
--  * Возвращаем CHECK (balance_kopecks >= 0) — предварительно обнуляем
--    отрицательные остатки, если такие успели появиться.
--  * Триггер списания: списывает не больше, чем есть на балансе,
--    недостачу пишет в комментарий журнала.
-- Применять в Supabase SQL Editor.
-- ---------------------------------------------------------------------------

UPDATE public.student_balances SET balance_kopecks = 0, updated_at = now() WHERE balance_kopecks < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_balances_balance_kopecks_check'
      AND conrelid = 'public.student_balances'::regclass
  ) THEN
    ALTER TABLE public.student_balances
      ADD CONSTRAINT student_balances_balance_kopecks_check CHECK (balance_kopecks >= 0);
  END IF;
END $$;

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
