-- ==========================================================
-- 043 · Track when a teacher has seen a host-assignment.
-- club_hosts.seen_at NULL → unread for the host. Set via RPC
-- club_hosts_mark_seen() called when teacher opens /teacher/clubs.
-- ==========================================================

ALTER TABLE public.club_hosts
    ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_club_hosts_unseen
    ON public.club_hosts (host_id)
    WHERE seen_at IS NULL;

CREATE OR REPLACE FUNCTION public.club_hosts_mark_seen()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE public.club_hosts
       SET seen_at = now()
     WHERE host_id = auth.uid()
       AND seen_at IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.club_hosts_mark_seen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_hosts_mark_seen() TO authenticated;
