-- ==========================================================
-- 042 · find_trial_teacher RPC
-- Picks the highest-rated listed teacher whose weekly availability
-- covers p_slot (Moscow-local) AND who has no overlapping lesson.
-- Returns teacher_profiles.id (the FK lessons.teacher_id) and the
-- corresponding profiles.id (FK trial_lesson_requests.assigned_teacher_id),
-- or zero rows when nobody fits.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.find_trial_teacher(
    p_slot     TIMESTAMPTZ,
    p_duration INT  DEFAULT 30,
    p_tz       TEXT DEFAULT 'Europe/Moscow'
)
RETURNS TABLE (
    teacher_profile_id UUID,
    teacher_user_id    UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tp.id AS teacher_profile_id,
         tp.user_id AS teacher_user_id
  FROM public.teacher_profiles tp
  JOIN public.teacher_availability ta
    ON ta.teacher_id = tp.id
   AND ta.is_active = true
   AND ta.day_of_week = EXTRACT(DOW FROM (p_slot AT TIME ZONE p_tz))::int
   AND ta.start_time <= ((p_slot AT TIME ZONE p_tz)::time)
   AND ta.end_time   >  ((p_slot AT TIME ZONE p_tz)::time)
  WHERE tp.is_listed = true
    AND NOT EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.teacher_id = tp.id
        AND l.status IN ('booked', 'in_progress', 'pending_payment')
        AND l.scheduled_at < p_slot + (p_duration || ' minutes')::INTERVAL
        AND p_slot < l.scheduled_at + (l.duration_minutes || ' minutes')::INTERVAL
    )
  ORDER BY tp.rating DESC NULLS LAST,
           tp.total_lessons ASC,
           tp.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_trial_teacher(TIMESTAMPTZ, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_trial_teacher(TIMESTAMPTZ, INT, TEXT)
    TO authenticated, service_role;
