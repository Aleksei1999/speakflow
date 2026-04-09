-- 005_notifications.sql
-- Multi-channel notification system

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    channel     TEXT NOT NULL
                CHECK (channel IN ('email', 'telegram', 'in_app')),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    metadata    JSONB NOT NULL DEFAULT '{}',
    is_read     BOOLEAN NOT NULL DEFAULT false,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_sent
    ON notifications(user_id, sent_at DESC);
CREATE INDEX idx_notifications_unread
    ON notifications(user_id, sent_at DESC)
    WHERE is_read = false;
