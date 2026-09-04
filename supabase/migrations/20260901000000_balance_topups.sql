-- ==========================================================
-- 20260901000000 · student balance + balance top-ups (YooKassa)
-- ==========================================================
-- Отдельная от `payments` инфраструктура — там платежи привязаны к
-- lessons (NOT NULL lesson_id). Balance top-up — независимая операция:
-- ученик пополняет виртуальный счёт, дальше платит с него за уроки/
-- лектории/клубы.
--
--   student_balances — running balance каждого юзера (кол-во копеек).
--   balance_topups   — заявка на пополнение через YooKassa. Одна строка
--                      на попытку; unique(yookassa_payment_id) защищает
--                      от дублей при повторе вебхука.
--
-- Кредитование balance происходит в webhook /api/payments/webhook —
-- атомарно при переходе topup.status в 'succeeded'.
-- ==========================================================

CREATE TABLE IF NOT EXISTS student_balances (
    user_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    balance_kopecks BIGINT NOT NULL DEFAULT 0 CHECK (balance_kopecks >= 0),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_balances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='student_balances' AND policyname='student_balances_select_own'
    ) THEN
        CREATE POLICY student_balances_select_own ON student_balances
            FOR SELECT
            USING (user_id = auth.uid());
    END IF;
END $$;

-- ==========================================================

CREATE TABLE IF NOT EXISTS balance_topups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    yookassa_payment_id TEXT UNIQUE,
    amount_kopecks      BIGINT NOT NULL CHECK (amount_kopecks > 0),
    currency            TEXT NOT NULL DEFAULT 'RUB',
    phone               TEXT,
    email               TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','succeeded','cancelled')),
    paid_at             TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_topups_user ON balance_topups(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_balance_topups_yookassa ON balance_topups(yookassa_payment_id)
    WHERE yookassa_payment_id IS NOT NULL;

CREATE TRIGGER trg_balance_topups_updated_at
    BEFORE UPDATE ON balance_topups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE balance_topups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='balance_topups' AND policyname='balance_topups_select_own'
    ) THEN
        CREATE POLICY balance_topups_select_own ON balance_topups
            FOR SELECT
            USING (user_id = auth.uid());
    END IF;
END $$;

-- ==========================================================
-- credit_student_balance(uid, amount) — атомарный upsert balance_kopecks.
-- Используется в webhook при topup.status→'succeeded'. Идемпотентно
-- вызывается снаружи только один раз на topup (защита по topup.status).
-- ==========================================================
CREATE OR REPLACE FUNCTION credit_student_balance(uid UUID, amount_add BIGINT)
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
    DO UPDATE SET
        balance_kopecks = student_balances.balance_kopecks + EXCLUDED.balance_kopecks,
        updated_at = now()
    RETURNING balance_kopecks INTO new_balance;

    RETURN new_balance;
END;
$$;
