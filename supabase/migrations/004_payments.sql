-- 004_payments.sql
-- Payment processing via YooKassa and teacher earnings

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id           UUID NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
    student_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    yookassa_payment_id TEXT UNIQUE,
    amount              INT NOT NULL,                -- kopecks
    currency            TEXT NOT NULL DEFAULT 'RUB',
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending',
                            'waiting_for_capture',
                            'succeeded',
                            'cancelled',
                            'refunded'
                        )),
    payment_method      TEXT,
    paid_at             TIMESTAMPTZ,
    refunded_at         TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_lesson_id ON payments(lesson_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_yookassa_id ON payments(yookassa_payment_id)
    WHERE yookassa_payment_id IS NOT NULL;
CREATE INDEX idx_payments_status ON payments(status);

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Teacher earnings per lesson
CREATE TABLE teacher_earnings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT,
    lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
    payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    gross_amount    INT NOT NULL,            -- kopecks
    platform_fee    INT NOT NULL,            -- kopecks
    net_amount      INT NOT NULL,            -- kopecks
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'available', 'paid_out')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_earnings_teacher_id ON teacher_earnings(teacher_id);
CREATE INDEX idx_teacher_earnings_lesson_id ON teacher_earnings(lesson_id);
CREATE INDEX idx_teacher_earnings_status ON teacher_earnings(status);
