-- 20260421_trial_preferred_slot.sql
-- Add preferred_slot to trial_lesson_requests so signups can record the
-- slot the student picked during /register, and admins can see it in the
-- Telegram notification and backlog.

ALTER TABLE trial_lesson_requests
    ADD COLUMN IF NOT EXISTS preferred_slot TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trial_requests_preferred_slot
    ON trial_lesson_requests(preferred_slot)
    WHERE preferred_slot IS NOT NULL;
