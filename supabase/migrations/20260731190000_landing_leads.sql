-- Таблица лидов из landing-формы «Оставь свои данные».
-- Публичный endpoint /api/landing/lead пишет через service-role (RLS bypass).
-- Читают только админы. UI будет в /admin/leads.

CREATE TABLE landing_leads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    email               TEXT NOT NULL,
    phone               TEXT NOT NULL,
    marketing_opt_in    BOOLEAN NOT NULL DEFAULT false,
    source              TEXT NOT NULL DEFAULT 'landing',
    country             TEXT,
    ip                  TEXT,
    user_agent          TEXT,
    status              TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','contacted','archived')),
    admin_notes         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_landing_leads_created_at ON landing_leads(created_at DESC);
CREATE INDEX idx_landing_leads_status ON landing_leads(status);
CREATE INDEX idx_landing_leads_email ON landing_leads(email);

CREATE TRIGGER trg_landing_leads_updated_at
    BEFORE UPDATE ON landing_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS: только админы читают/меняют. INSERT через service-role в endpoint.
ALTER TABLE landing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "landing_leads_admin_read"
    ON landing_leads FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "landing_leads_admin_update"
    ON landing_leads FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "landing_leads_admin_delete"
    ON landing_leads FOR DELETE
    TO authenticated
    USING (public.is_admin());
