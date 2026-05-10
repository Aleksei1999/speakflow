-- Fix RLS on lesson_messages and lesson_notes.
--
-- Predyduschie politiki sravnivali lessons.teacher_id = auth.uid(),
-- no v lessons.teacher_id hranitsja teacher_profiles.id, a ne user_id.
-- V resul'tate teacher voobsche ne mog ni chitat', ni pisat' v chat
-- cherez supabase-js anon (i ne poluchal Realtime broadcasts), poka
-- API rabotali cherez service role.
--
-- Etot patch:
--  1. Pravil'no resolvit teacher cherez JOIN s teacher_profiles.
--  2. Razresheaet admin'u SELECT/INSERT (back-office monitoring chat'a).
--  3. Dobavlyaet WITH CHECK na lesson_notes, chtoby user mog pisat'
--     zametki tol'ko v urok, gde on uchastnik.

-- ------------------------------------------------------------------
-- Helper: caller is a participant of THIS lesson (student / teacher
-- of that lesson / admin). SECURITY DEFINER so RLS doesn't recurse.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_lesson_participant(p_lesson_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM lessons l
    LEFT JOIN teacher_profiles tp ON tp.id = l.teacher_id
    WHERE l.id = p_lesson_id
      AND (
        l.student_id = auth.uid()
        OR tp.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_lesson_participant(uuid) TO authenticated;

-- ------------------------------------------------------------------
-- lesson_messages — replace existing policies
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Lesson participants view messages" ON public.lesson_messages;
DROP POLICY IF EXISTS "Lesson participants send messages" ON public.lesson_messages;

CREATE POLICY "lesson_messages_select_participant"
  ON public.lesson_messages
  FOR SELECT
  TO authenticated
  USING (public.is_lesson_participant(lesson_id));

-- INSERT: kalleryushij oserator pishет ot svoego imeni i tol'ko v
-- urok, v kotorom on uchastnik. (Admin tozhe mozhet — naprimer dlya
-- broadcasta servisnyh soobschenij.)
CREATE POLICY "lesson_messages_insert_participant"
  ON public.lesson_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_lesson_participant(lesson_id)
  );

-- ------------------------------------------------------------------
-- lesson_notes — keep "own notes only", but add lesson-participation
-- check on writes so user can't dump notes into a random lesson.
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Users manage own notes" ON public.lesson_notes;

CREATE POLICY "lesson_notes_select_own"
  ON public.lesson_notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "lesson_notes_insert_own"
  ON public.lesson_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_lesson_participant(lesson_id)
  );

CREATE POLICY "lesson_notes_update_own"
  ON public.lesson_notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_lesson_participant(lesson_id)
  );

CREATE POLICY "lesson_notes_delete_own"
  ON public.lesson_notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
