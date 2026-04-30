-- ==========================================================
-- 040 · Fix recalc_club_seats() to bypass RLS
-- Without SECURITY DEFINER the trigger runs as the row author
-- (e.g. the student inserting into club_registrations) and
-- the UPDATE on clubs is silently filtered by RLS policy
-- "clubs_admin_write" → seats_taken stays 0 even though the
-- registration row exists.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.recalc_club_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_club_id UUID;
BEGIN
    v_club_id := COALESCE(NEW.club_id, OLD.club_id);
    UPDATE public.clubs
       SET seats_taken = (
           SELECT COUNT(*) FROM public.club_registrations
            WHERE club_id = v_club_id
              AND status IN ('registered', 'attended')
       ),
       updated_at = now()
     WHERE id = v_club_id;
    RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_club_seats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_club_seats() TO authenticated, service_role;

-- One-time recalc to repair previously-skipped updates.
UPDATE public.clubs c
SET seats_taken = (
  SELECT COUNT(*) FROM public.club_registrations
  WHERE club_id = c.id AND status IN ('registered', 'attended')
);
