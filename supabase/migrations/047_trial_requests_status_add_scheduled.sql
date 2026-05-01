-- ==========================================================
-- 047 · trial_lesson_requests: разрешаем status='scheduled'
-- ==========================================================
-- Старый CHECK позволял только pending|assigned|completed|cancelled.
-- autoAssignTrial всё это время пытался писать 'scheduled', но UPDATE
-- молча заворачивался — lesson создавался, а trial_lesson_requests
-- оставался pending (с assigned_lesson_id=NULL). Из-за этого UI
-- студенту показывал «куратор подтвердит», а препод не получал
-- Telegram (notification gated на status='scheduled').

ALTER TABLE public.trial_lesson_requests
  DROP CONSTRAINT IF EXISTS trial_lesson_requests_status_check;

ALTER TABLE public.trial_lesson_requests
  ADD CONSTRAINT trial_lesson_requests_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'assigned'::text, 'scheduled'::text, 'completed'::text, 'cancelled'::text]));
