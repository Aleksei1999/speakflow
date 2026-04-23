-- 036_clubs_admin_assign.sql
-- Extends clubs for admin-driven assign flow:
--   - capacity      : soft admin-facing cap (mirrors/caps max_seats at ≤15)
--   - assigned_by   : admin who created the club
--   - created_by_role : 'admin' for admin-assigned clubs, 'teacher' otherwise
--
-- Adds a BEFORE INSERT trigger on club_registrations to reject when the
-- club is already full (counting status='registered').

BEGIN;

-- ===================================================================
-- 1. Columns (idempotent)
-- ===================================================================

ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS capacity         INT,
    ADD COLUMN IF NOT EXISTS assigned_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by_role  TEXT NOT NULL DEFAULT 'teacher';

-- Backfill capacity from max_seats (capped at 15) where null.
UPDATE public.clubs
   SET capacity = LEAST(COALESCE(max_seats, 15), 15)
 WHERE capacity IS NULL;

-- Sensible default for future inserts (max 15).
ALTER TABLE public.clubs
    ALTER COLUMN capacity SET DEFAULT 15;

-- Constrain role.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'clubs_created_by_role_chk'
    ) THEN
        ALTER TABLE public.clubs
            ADD CONSTRAINT clubs_created_by_role_chk
            CHECK (created_by_role IN ('admin', 'teacher'));
    END IF;
END $$;

-- Constrain capacity: positive + ≤15 (admin rule).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'clubs_capacity_chk'
    ) THEN
        ALTER TABLE public.clubs
            ADD CONSTRAINT clubs_capacity_chk
            CHECK (capacity IS NULL OR (capacity > 0 AND capacity <= 15));
    END IF;
END $$;

-- ===================================================================
-- 2. Capacity guard trigger on club_registrations
-- ===================================================================

CREATE OR REPLACE FUNCTION public.enforce_club_capacity()
RETURNS TRIGGER AS $$
DECLARE
    v_capacity INT;
    v_taken    INT;
BEGIN
    -- Only seat-holding inserts need the check.
    IF NEW.status NOT IN ('registered', 'pending_payment') THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(capacity, max_seats, 15)
      INTO v_capacity
      FROM public.clubs
     WHERE id = NEW.club_id;

    IF v_capacity IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)
      INTO v_taken
      FROM public.club_registrations
     WHERE club_id = NEW.club_id
       AND status IN ('registered', 'pending_payment', 'attended');

    IF v_taken >= v_capacity THEN
        RAISE EXCEPTION 'Клаб заполнен (% из %)', v_taken, v_capacity
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_club_regs_capacity ON public.club_registrations;
CREATE TRIGGER trg_club_regs_capacity
    BEFORE INSERT ON public.club_registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_club_capacity();

COMMIT;
