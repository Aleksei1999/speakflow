-- ---------------------------------------------------------------------------
-- Чаты: ужесточение RLS.
-- 1) UPDATE chat_messages участником — только колонки прочтения
--    (раньше любой участник треда мог через PostgREST переписать text /
--    attachment_url / sender_id любого сообщения в треде).
-- 2) INSERT chat_messages — только между связанными пользователями:
--    админ ↔ кто угодно, учитель ↔ свой ученик (уроки / заявки / группы).
-- Применять в Supabase SQL Editor (у CLI нет прав на проект).
-- ---------------------------------------------------------------------------

-- 1) Колоночные права: authenticated может менять только read_at_*.
REVOKE UPDATE ON public.chat_messages FROM authenticated;
GRANT UPDATE (read_at_slot_a, read_at_slot_b) ON public.chat_messages TO authenticated;

-- 2) Связь «можно переписываться».
CREATE OR REPLACE FUNCTION public.can_chat(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ra AS (SELECT role FROM profiles WHERE id = a),
       rb AS (SELECT role FROM profiles WHERE id = b)
  SELECT CASE
    WHEN a = b THEN false
    WHEN (SELECT role FROM ra) = 'admin' OR (SELECT role FROM rb) = 'admin' THEN true
    WHEN (SELECT role FROM ra) = (SELECT role FROM rb) THEN false
    ELSE EXISTS (
      SELECT 1
      FROM teacher_profiles tp
      WHERE tp.user_id = CASE WHEN (SELECT role FROM ra) = 'teacher' THEN a ELSE b END
        AND (
          EXISTS (SELECT 1 FROM lessons l
                  WHERE l.teacher_id = tp.id
                    AND l.student_id = CASE WHEN (SELECT role FROM ra) = 'student' THEN a ELSE b END)
          OR EXISTS (SELECT 1 FROM trial_lesson_requests r
                     WHERE r.assigned_teacher_id = tp.id
                       AND r.user_id = CASE WHEN (SELECT role FROM ra) = 'student' THEN a ELSE b END
                       AND r.status IN ('assigned', 'scheduled'))
          OR EXISTS (SELECT 1 FROM teacher_groups g
                     JOIN teacher_group_members m ON m.group_id = g.id
                     WHERE g.teacher_id = tp.id
                       AND m.student_id = CASE WHEN (SELECT role FROM ra) = 'student' THEN a ELSE b END)
        )
    )
  END;
$$;

DROP POLICY IF EXISTS chat_messages_insert_participant ON public.chat_messages;
CREATE POLICY chat_messages_insert_participant
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_id IN (teacher_id, student_id)
    AND public.can_chat(teacher_id, student_id)
  );
