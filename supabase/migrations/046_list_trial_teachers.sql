-- ==========================================================
-- 046 · list_trial_teachers RPC
-- Возвращает СПИСОК преподавателей, доступных на конкретный слот:
-- активная availability на этот час+день недели + нет overlapping lesson.
-- В отличие от find_trial_teacher (LIMIT 1) — отдаёт всех, чтобы ученик
-- сам выбрал на UI.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.list_trial_teachers(
    p_slot     TIMESTAMPTZ,
    p_duration INT  DEFAULT 30,
    p_tz       TEXT DEFAULT 'Europe/Moscow'
)
RETURNS TABLE (
    teacher_profile_id UUID,
    teacher_user_id    UUID,
    full_name          TEXT,
    avatar_url         TEXT,
    rating             NUMERIC,
    total_lessons      INT,
    total_reviews      INT,
    bio                TEXT,
    experience_years   INT,
    specializations    TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tp.id AS teacher_profile_id,
         tp.user_id AS teacher_user_id,
         pr.full_name,
         pr.avatar_url,
         tp.rating,
         tp.total_lessons,
         tp.total_reviews,
         tp.bio,
         tp.experience_years,
         tp.specializations
  FROM public.teacher_profiles tp
  JOIN public.profiles pr ON pr.id = tp.user_id
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
           tp.total_lessons DESC NULLS LAST,
           tp.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.list_trial_teachers(TIMESTAMPTZ, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_trial_teachers(TIMESTAMPTZ, INT, TEXT)
    TO authenticated, service_role;
