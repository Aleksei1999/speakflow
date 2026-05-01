-- ==========================================================
-- 045 · Teacher applications (заявки с лендинга /teach)
-- Любой может POST'нуть заявку (анонимно, без auth). Только
-- админы могут читать / менять статус.
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.teacher_applications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name   TEXT NOT NULL CHECK (length(trim(first_name)) > 0),
    last_name    TEXT NOT NULL CHECK (length(trim(last_name))  > 0),
    email        TEXT NOT NULL CHECK (length(trim(email)) > 0),
    contact      TEXT NOT NULL CHECK (length(trim(contact)) > 0),
    notes        TEXT,
    status       TEXT NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'in_review', 'approved', 'rejected', 'archived')),
    reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_apps_status_created
    ON public.teacher_applications (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_teacher_apps_updated_at ON public.teacher_applications;
CREATE TRIGGER trg_teacher_apps_updated_at
    BEFORE UPDATE ON public.teacher_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.teacher_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a new row (public form). Only the safe columns
-- can be set; status / reviewed_* defaults will hold via column defaults.
DROP POLICY IF EXISTS teacher_apps_insert_public ON public.teacher_applications;
CREATE POLICY teacher_apps_insert_public
    ON public.teacher_applications
    FOR INSERT
    WITH CHECK (true);

-- Admins read everything.
DROP POLICY IF EXISTS teacher_apps_select_admin ON public.teacher_applications;
CREATE POLICY teacher_apps_select_admin
    ON public.teacher_applications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- Admins update.
DROP POLICY IF EXISTS teacher_apps_update_admin ON public.teacher_applications;
CREATE POLICY teacher_apps_update_admin
    ON public.teacher_applications
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );
