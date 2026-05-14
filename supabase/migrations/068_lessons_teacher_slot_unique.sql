-- 068_lessons_teacher_slot_unique.sql
-- Defense-in-depth поверх EXCLUDE GiST constraint из 012:
-- partial UNIQUE INDEX по (teacher_id, scheduled_at) для статусов,
-- которые реально занимают слот. Параллельный POST /api/booking/create
-- больше не может создать два урока на тот же тайм-стамп у одного препода.
-- 23505 ловим в /api/booking/create и /api/booking/teacher-create и
-- возвращаем 409 с человеческим сообщением.

CREATE UNIQUE INDEX IF NOT EXISTS lessons_teacher_slot_unique_idx
    ON public.lessons (teacher_id, scheduled_at)
    WHERE status NOT IN ('cancelled', 'no_show');
