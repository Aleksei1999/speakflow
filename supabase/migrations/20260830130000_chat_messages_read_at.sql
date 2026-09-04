-- ==========================================================
-- 20260830130000 · chat_messages.read_at + partial index + RLS UPDATE
-- ==========================================================
-- Добавляет колонку read_at TIMESTAMPTZ NULL — момент, когда получатель
-- (пока только teacher) реально увидел сообщение. NULL = «не прочитано».
-- Нужно для честного счётчика в бейдже «N новое сообщение» на дашборде.
--
-- Партишн-индекс: `WHERE read_at IS NULL AND sender_role='student'`
-- покрывает основной запрос — суммирование непрочитанных по всем
-- тредам конкретного teacher. Полный индекс не нужен: read_at
-- заполнен у большинства строк.
--
-- RLS UPDATE: policy для teacher, чтобы `.update()` не молчаливо
-- фейлился под RLS. Ученику UPDATE не нужен — student sender не
-- «отмечает как прочитанное сам себя».
-- ==========================================================

ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_by_teacher
    ON chat_messages (teacher_id, student_id)
    WHERE read_at IS NULL AND sender_role = 'student';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_update_teacher_read'
    ) THEN
        -- Teacher может UPDATE своих тредов (для setting read_at).
        -- Проверка `auth.uid() = teacher_id` в обеих ветках гарантирует, что
        -- нельзя переписать чужой тред. Колоночный allow-list через RLS не
        -- выразить — на прикладном уровне будем менять только read_at.
        CREATE POLICY chat_messages_update_teacher_read ON chat_messages
            FOR UPDATE
            USING (
                auth.uid() = teacher_id
                AND EXISTS (
                    SELECT 1 FROM profiles p
                    WHERE p.id = auth.uid() AND p.role IN ('teacher','admin')
                )
            )
            WITH CHECK (
                auth.uid() = teacher_id
            );
    END IF;
END $$;
