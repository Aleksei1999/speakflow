-- ==========================================================
-- 044 · Telegram linking codes
-- One-time 6-digit codes used by /api/notifications/telegram (the bot
-- webhook) to attach a user's telegram chat_id to their profile.
-- Only service_role touches this table.
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.telegram_linking_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    code        TEXT NOT NULL CHECK (length(code) = 6),
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tlc_user
    ON public.telegram_linking_codes (user_id, used);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tlc_active_code
    ON public.telegram_linking_codes (code)
    WHERE used = false;

ALTER TABLE public.telegram_linking_codes ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies → only service_role can read/write.
