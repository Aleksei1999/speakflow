-- 084_badges_live_count.sql
--
-- Переводим notifications_unread_counts на ЖИВОЕ состояние для action items.
-- Раньше (мигр 083): seen_at-based — заход в раздел => badge=0 навсегда.
-- Плохо для homework toDo которая остаётся актуальной пока не сделана.
--
-- Теперь: live SQL count для homework/schedule/students/trial_requests/users.
-- Chat-like категории (support, materials) остаются на seen_at — там
-- 'прочитано' имеет смысл.
--
-- Применена через MCP apply_migration 2026-05-18; этот файл — для
-- repeatability при fresh setup из repo.

CREATE OR REPLACE FUNCTION public.notifications_unread_counts(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  v_role text;
  v_teacher_pid uuid;
  v_count int;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  SELECT id INTO v_teacher_pid FROM teacher_profiles WHERE user_id = p_user_id;

  IF v_role = 'student' THEN
    -- HW assigned/pending (toDo)
    SELECT COUNT(*) INTO v_count FROM homework
    WHERE student_id = p_user_id AND status IN ('pending','assigned','in_progress');
    IF v_count > 0 THEN result := result || jsonb_build_object('homework', v_count); END IF;

    -- Upcoming lessons in next 7 days
    SELECT COUNT(*) INTO v_count FROM lessons
    WHERE student_id = p_user_id
      AND status IN ('booked','scheduled','confirmed','pending_payment','in_progress')
      AND scheduled_at BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() + INTERVAL '7 days';
    IF v_count > 0 THEN result := result || jsonb_build_object('schedule', v_count); END IF;

    -- Unclaimed rewards
    BEGIN
      SELECT COUNT(*) INTO v_count FROM user_rewards
      WHERE user_id = p_user_id AND status = 'awarded';
      IF v_count > 0 THEN result := result || jsonb_build_object('achievements', v_count); END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Chat-like: support / materials остаются seen_at-based
    FOR v_count IN (
      SELECT COUNT(*)::int FROM notification_badges
      WHERE user_id = p_user_id AND category = 'support' AND seen_at IS NULL
    ) LOOP
      IF v_count > 0 THEN result := result || jsonb_build_object('support', v_count); END IF;
    END LOOP;
    FOR v_count IN (
      SELECT COUNT(*)::int FROM notification_badges
      WHERE user_id = p_user_id AND category = 'materials' AND seen_at IS NULL
    ) LOOP
      IF v_count > 0 THEN result := result || jsonb_build_object('materials', v_count); END IF;
    END LOOP;

  ELSIF v_role = 'teacher' AND v_teacher_pid IS NOT NULL THEN
    -- HW submitted, awaiting teacher review
    SELECT COUNT(*) INTO v_count FROM homework
    WHERE (teacher_id::text = v_teacher_pid::text OR teacher_id::text = p_user_id::text)
      AND status = 'submitted';
    IF v_count > 0 THEN result := result || jsonb_build_object('homework', v_count); END IF;

    -- Upcoming lessons next 14 days
    SELECT COUNT(*) INTO v_count FROM lessons
    WHERE teacher_id = v_teacher_pid
      AND status IN ('booked','scheduled','confirmed','pending_payment','in_progress')
      AND scheduled_at BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() + INTERVAL '14 days';
    IF v_count > 0 THEN result := result || jsonb_build_object('schedule', v_count); END IF;

    -- New students (first lesson in last 7 days)
    SELECT COUNT(DISTINCT student_id) INTO v_count FROM lessons
    WHERE teacher_id = v_teacher_pid
      AND created_at > NOW() - INTERVAL '7 days';
    IF v_count > 0 THEN result := result || jsonb_build_object('students', v_count); END IF;

    -- Support
    FOR v_count IN (
      SELECT COUNT(*)::int FROM notification_badges
      WHERE user_id = p_user_id AND category = 'support' AND seen_at IS NULL
    ) LOOP
      IF v_count > 0 THEN result := result || jsonb_build_object('support', v_count); END IF;
    END LOOP;

  ELSIF v_role = 'admin' THEN
    -- trial_lesson_requests без assigned_teacher_id / new
    BEGIN
      SELECT COUNT(*) INTO v_count FROM trial_lesson_requests
      WHERE assigned_teacher_id IS NULL
        AND created_at > NOW() - INTERVAL '30 days';
      IF v_count > 0 THEN result := result || jsonb_build_object('trial_requests', v_count); END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- New users (last 24h)
    SELECT COUNT(*) INTO v_count FROM profiles
    WHERE created_at > NOW() - INTERVAL '24 hours';
    IF v_count > 0 THEN result := result || jsonb_build_object('users', v_count); END IF;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notifications_unread_counts(uuid) TO authenticated, service_role;
