-- ---------------------------------------------------------------------------
-- lesson_notes: код сохраняет заметку через upsert по (lesson_id, user_id),
-- но уникального ключа не было — каждое сохранение падало с 42P10
-- («no unique or exclusion constraint matching the ON CONFLICT»).
-- Схлопываем дубли (оставляем последнюю) и добавляем уникальный индекс.
-- Применять в Supabase SQL Editor.
-- ---------------------------------------------------------------------------
DELETE FROM public.lesson_notes n
USING public.lesson_notes m
WHERE n.lesson_id = m.lesson_id AND n.user_id = m.user_id
  AND (COALESCE(n.updated_at, 'epoch'), n.id) < (COALESCE(m.updated_at, 'epoch'), m.id);
CREATE UNIQUE INDEX IF NOT EXISTS lesson_notes_lesson_user_unique
  ON public.lesson_notes (lesson_id, user_id);
