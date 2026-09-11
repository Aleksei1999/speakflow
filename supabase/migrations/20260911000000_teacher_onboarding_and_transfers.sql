-- ---------------------------------------------------------------------------
-- Преподавателей заводит админ; передача ученика между преподавателями.
-- Применять в Supabase SQL Editor.
--  1) profiles.credentials_pending — преподаватель создан админом с временным
--     логином/паролем и при первом входе обязан задать свою почту и пароль.
--  2) student_transfers — журнал передач ученика (кто, кому, почему, что перенесли).
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credentials_pending boolean NOT NULL DEFAULT false;
REVOKE UPDATE (credentials_pending) ON public.profiles FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.student_transfers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_teacher_id   uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  to_teacher_id     uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  initiated_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason            text NOT NULL,
  lessons_moved     int NOT NULL DEFAULT 0,
  lessons_cancelled int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_transfers_student_idx ON public.student_transfers (student_id, created_at DESC);
ALTER TABLE public.student_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_transfers_select ON public.student_transfers;
CREATE POLICY student_transfers_select ON public.student_transfers
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.teacher_profiles tp WHERE tp.user_id = auth.uid() AND tp.id IN (from_teacher_id, to_teacher_id))
  );
REVOKE INSERT, UPDATE, DELETE ON public.student_transfers FROM anon, authenticated;
