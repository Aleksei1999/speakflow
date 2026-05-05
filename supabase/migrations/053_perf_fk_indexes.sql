-- ==========================================================
-- 053 · FK indexes для всех колонок-внешних-ключей без индекса.
-- Аудит database-optimizer показал seq scans на support_threads (191×),
-- profiles (4.7×), leaderboards (~30×). Большинство — из-за RLS-предикатов
-- идущих через FK без индексов. Все CREATE IF NOT EXISTS — идемпотентно.
-- ==========================================================

-- HOT (high-traffic)
CREATE INDEX IF NOT EXISTS idx_homework_lesson_id           ON public.homework(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson_id   ON public.lesson_materials(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_teacher_id  ON public.lesson_materials(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_messages_sender_id    ON public.lesson_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_id         ON public.lesson_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_cancelled_by         ON public.lessons(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id   ON public.support_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON public.user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_reward_id       ON public.user_rewards(reward_id);

-- support_threads — 191× seq scans, главный hot-spot после leaderboards.
CREATE INDEX IF NOT EXISTS idx_support_threads_user_id      ON public.support_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_support_threads_status_lastmsg
  ON public.support_threads(status, last_user_message_at)
  WHERE status NOT IN ('resolved','closed');

-- WARM
CREATE INDEX IF NOT EXISTS idx_clubs_created_by             ON public.clubs(created_by);
CREATE INDEX IF NOT EXISTS idx_clubs_assigned_by            ON public.clubs(assigned_by);
CREATE INDEX IF NOT EXISTS idx_club_payments_club_id        ON public.club_payments(club_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_current_lesson_id ON public.course_enrollments(current_lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_progress_course_id ON public.course_lesson_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_course_lesson_progress_lesson_id ON public.course_lesson_progress(course_lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_payments_course_id    ON public.course_payments(course_id);
CREATE INDEX IF NOT EXISTS idx_courses_author_id            ON public.courses(author_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_lesson_id    ON public.calendar_events(lesson_id);
CREATE INDEX IF NOT EXISTS idx_trial_requests_assigned_lesson  ON public.trial_lesson_requests(assigned_lesson_id);
CREATE INDEX IF NOT EXISTS idx_trial_requests_assigned_teacher ON public.trial_lesson_requests(assigned_teacher_id);
CREATE INDEX IF NOT EXISTS idx_trial_requests_level_test    ON public.trial_lesson_requests(level_test_id);
CREATE INDEX IF NOT EXISTS idx_teacher_applications_reviewed_by ON public.teacher_applications(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_teacher_earnings_payment_id  ON public.teacher_earnings(payment_id);
CREATE INDEX IF NOT EXISTS idx_student_preferred_slots_teacher ON public.student_preferred_slots(teacher_id);
CREATE INDEX IF NOT EXISTS idx_user_achievement_progress_achievement ON public.user_achievement_progress(achievement_id);

-- ==========================================================
-- 053b · refresh_leaderboards: каждые 10 мин было слишком часто.
-- Это 80% всего DB CPU времени (по pg_stat_statements). Урезаем до
-- раз в 30 минут — данные на лидерборде не настолько динамичны.
-- ==========================================================
DO $$
DECLARE existing_id int;
BEGIN
  SELECT jobid INTO existing_id FROM cron.job WHERE jobname = 'refresh-leaderboards';
  IF existing_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_id);
    PERFORM cron.schedule(
      'refresh-leaderboards',
      '*/30 * * * *',
      'SELECT refresh_leaderboards()'
    );
  END IF;
END $$;
