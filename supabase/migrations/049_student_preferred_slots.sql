-- ==========================================================
-- 049 · student_preferred_slots — закреплённые слоты ученика
-- ==========================================================
-- Когда ученик бронирует урок, у него есть опция «Закрепить за собой
-- это время». Запись в эту таблицу => в дашборде покажем CTA
-- «Записаться повторно: понедельник 10:00». Уникальность по
-- (student, weekday, hour, minute, teacher) — можно держать одно и
-- то же время с разными преподами.

CREATE TABLE IF NOT EXISTS public.student_preferred_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id  uuid REFERENCES public.teacher_profiles(id) ON DELETE SET NULL,
  weekday     smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6), -- 0=Sun..6=Sat (EXTRACT(DOW))
  hour        smallint NOT NULL CHECK (hour >= 0 AND hour < 24),
  minute      smallint NOT NULL DEFAULT 0 CHECK (minute >= 0 AND minute < 60),
  duration_minutes smallint NOT NULL DEFAULT 50 CHECK (duration_minutes > 0 AND duration_minutes <= 240),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, weekday, hour, minute, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_student_preferred_slots_student
  ON public.student_preferred_slots(student_id);

ALTER TABLE public.student_preferred_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "preferred_slots_self_select" ON public.student_preferred_slots;
DROP POLICY IF EXISTS "preferred_slots_self_modify" ON public.student_preferred_slots;

CREATE POLICY "preferred_slots_self_select" ON public.student_preferred_slots
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "preferred_slots_self_modify" ON public.student_preferred_slots
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
