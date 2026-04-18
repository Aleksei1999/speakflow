-- 012_lesson_slot_exclusion.sql
-- Prevents overlapping lessons for the same teacher at the DB level.
-- Uses a GiST exclusion constraint with tstzrange over (scheduled_at, scheduled_at + duration).
-- Only applies to lessons that still occupy a slot: pending_payment, booked, in_progress.
-- btree_gist is required to mix a scalar `=` (teacher_id) with a range `&&` (time range) in one EXCLUDE.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- IMMUTABLE wrapper so Postgres accepts the expression inside EXCLUDE USING gist.
CREATE OR REPLACE FUNCTION lesson_slot_range(ts timestamptz, mins integer)
RETURNS tstzrange
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT tstzrange(ts, ts + (mins || ' minutes')::interval, '[)') $$;

ALTER TABLE lessons
    ADD CONSTRAINT lessons_no_overlap
    EXCLUDE USING gist (
        teacher_id WITH =,
        lesson_slot_range(scheduled_at, duration_minutes) WITH &&
    )
    WHERE (status IN ('pending_payment', 'booked', 'in_progress'));
