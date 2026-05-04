-- ==========================================================
-- 051 · Уведомления при переходе lessons.status booked → no_show
-- ==========================================================
-- Когда cron-job mark_missed_lessons (мигр 050) переводит урок в no_show,
-- триггер фан-аутит две записи в notifications_queue:
--   • преподавателю (user_id = teacher_profiles.user_id)
--   • ученику       (user_id = lessons.student_id)
--
-- Drain-эндпоинт /api/internal/notifications/drain (cron каждые 2 мин)
-- читает очередь и шлёт через sendNotification() — там добавлен case
-- 'lesson_missed' (TRANSACTIONAL_TYPES, оба канала).
--
-- Идемпотентность: триггер срабатывает только при OLD.status='booked'
-- AND NEW.status='no_show' — повторное обновление в no_show уже
-- не сработает (OLD будет 'no_show').

BEGIN;

CREATE OR REPLACE FUNCTION public.nq_enqueue_lesson_missed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_user_id UUID;
    v_student_name    TEXT;
    v_teacher_name    TEXT;
    v_payload         JSONB;
BEGIN
    -- teacher_id на lessons -> teacher_profiles.id ; нужно user_id профиля
    SELECT tp.user_id
      INTO v_teacher_user_id
      FROM public.teacher_profiles tp
     WHERE tp.id = NEW.teacher_id
     LIMIT 1;

    SELECT COALESCE(p.full_name, p.email, 'Ученик')
      INTO v_student_name
      FROM public.profiles p
     WHERE p.id = NEW.student_id
     LIMIT 1;

    IF v_teacher_user_id IS NOT NULL THEN
        SELECT COALESCE(p.full_name, p.email, 'Преподаватель')
          INTO v_teacher_name
          FROM public.profiles p
         WHERE p.id = v_teacher_user_id
         LIMIT 1;
    ELSE
        v_teacher_name := 'Преподаватель';
    END IF;

    v_payload := jsonb_build_object(
        'lesson_id',     NEW.id,
        'scheduled_at',  NEW.scheduled_at,
        'duration',      NEW.duration_minutes,
        'studentName',   v_student_name,
        'teacherName',   v_teacher_name
    );

    -- Преподавателю
    IF v_teacher_user_id IS NOT NULL THEN
        INSERT INTO public.notifications_queue (user_id, type, payload)
        VALUES (
            v_teacher_user_id,
            'lesson_missed',
            v_payload || jsonb_build_object('recipientRole', 'teacher')
        );
    END IF;

    -- Ученику
    IF NEW.student_id IS NOT NULL THEN
        INSERT INTO public.notifications_queue (user_id, type, payload)
        VALUES (
            NEW.student_id,
            'lesson_missed',
            v_payload || jsonb_build_object('recipientRole', 'student')
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nq_lesson_missed ON public.lessons;
CREATE TRIGGER trg_nq_lesson_missed
    AFTER UPDATE OF status ON public.lessons
    FOR EACH ROW
    WHEN (OLD.status = 'booked' AND NEW.status = 'no_show')
    EXECUTE FUNCTION public.nq_enqueue_lesson_missed();

COMMIT;
