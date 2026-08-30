-- ==========================================================
-- 20260803150843 · google_calendar: OAuth токены + кеш событий
-- ==========================================================
-- Read-only интеграция Google Calendar: учитель подключает свой
-- личный календарь по OAuth 2.0, мы кешируем события в БД и
-- показываем их в дашборде рядом с уроками из `lessons`.
--
-- Двусторонняя запись НЕ реализована — учитель редактирует
-- события ТОЛЬКО в Google Calendar, мы их только читаем.
--
-- Токены (access/refresh) хранятся ТОЛЬКО в service_role scope:
-- обычному authenticated даём SELECT на «безопасные» поля через
-- отдельную view (см. ниже) — сам row с секретами закрыт.

-- ----------------------------------------------------------
-- google_calendar_tokens: OAuth токены на юзера
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    access_token      TEXT NOT NULL,
    refresh_token     TEXT NOT NULL,
    token_expires_at  TIMESTAMPTZ NOT NULL,
    google_email      TEXT,
    calendar_id       TEXT NOT NULL DEFAULT 'primary',
    synced_at         TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_google_calendar_tokens_updated_at
    BEFORE UPDATE ON google_calendar_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Никаких policies для authenticated: обычный юзер НЕ видит секреты.
-- Все чтения/записи access_token/refresh_token идут через
-- createAdminClient() (service_role) в server actions.
--
-- Для UI («у меня привязан аккаунт X?») используем view ниже.

-- ----------------------------------------------------------
-- google_calendar_status: безопасная view для UI
-- ----------------------------------------------------------
-- Показывает факт подключения + email, но НЕ токены.
-- security_invoker=on гарантирует, что RLS проверяется от имени юзера.
CREATE OR REPLACE VIEW google_calendar_status
    WITH (security_invoker = on)
AS
SELECT
    user_id,
    google_email,
    calendar_id,
    synced_at,
    created_at
FROM google_calendar_tokens;

-- Чтобы через view хоть что-то возвращалось, добавляем RLS-policy
-- на само поле user_id — но только SELECT и только на этот столбец
-- эффективно (view не отдаёт остальные поля).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='google_calendar_tokens'
          AND policyname='gcal_tokens_select_owner_status_only'
    ) THEN
        -- policy пропускает SELECT только владельцу.
        -- Тем не менее прямой SELECT на таблицу из authenticated
        -- НЕ рекомендуется — используйте google_calendar_status.
        CREATE POLICY gcal_tokens_select_owner_status_only
            ON google_calendar_tokens
            FOR SELECT TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Grants: revoke по умолчанию + разрешаем select только на view.
REVOKE ALL ON google_calendar_tokens FROM authenticated, anon;
GRANT SELECT ON google_calendar_status TO authenticated;

-- ----------------------------------------------------------
-- google_calendar_events: кеш событий из Google Calendar
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_calendar_events (
    id                 TEXT PRIMARY KEY,          -- Google event.id
    user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title              TEXT,
    description        TEXT,
    start_at           TIMESTAMPTZ NOT NULL,
    end_at             TIMESTAMPTZ NOT NULL,
    location           TEXT,                       -- Google Meet-ссылка часто тут
    attendees          JSONB,                      -- массив email'ов
    google_updated_at  TIMESTAMPTZ,                -- etag/updated для инкрементального sync
    synced_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gcal_events_user_start
    ON google_calendar_events (user_id, start_at);

ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;

-- SELECT: юзер видит свои события. INSERT/UPDATE/DELETE — только service_role.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='google_calendar_events'
          AND policyname='gcal_events_select_owner'
    ) THEN
        CREATE POLICY gcal_events_select_owner
            ON google_calendar_events
            FOR SELECT TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE ON google_calendar_events FROM authenticated, anon;
