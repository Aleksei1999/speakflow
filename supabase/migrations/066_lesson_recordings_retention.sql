-- ==========================================================
-- 066 · sec(retention): авто-удаление старых записей уроков
-- ==========================================================
-- Записи аудио уроков сейчас живут вечно в bucket lesson-recordings.
-- Это:
--   1) Юридический риск под 152-ФЗ (хранение биометрии/голосовых
--      записей несовершеннолетних без явного срока хранения).
--   2) Растущий счёт за storage.
--   3) Атак-площадка: чем больше записей лежит, тем больше теряем
--      при компрометации service-role ключа.
--
-- Политика: удаляем lesson_recordings + соответствующие чанки в
-- bucket lesson-recordings, когда created_at < NOW() - 60 days.
-- Связанные lesson_transcripts/lesson_summaries/lesson_quizzes —
-- ТЕКСТ, лёгкие, остаются (отдельной retention-политики ещё не
-- согласовали с product/legal).
--
-- ON DELETE CASCADE на lesson_recordings: транскрипт привязан к
-- lesson_id, не к recording_id, так что мы удаляем только audio.

CREATE OR REPLACE FUNCTION public.cleanup_old_lesson_recordings()
RETURNS TABLE (
  deleted_recording_id uuid,
  deleted_lesson_id uuid,
  deleted_objects int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_rec record;
  v_deleted_objects int;
BEGIN
  FOR v_rec IN
    SELECT id, lesson_id, storage_prefix
      FROM public.lesson_recordings
     WHERE created_at < NOW() - INTERVAL '60 days'
     -- В первую очередь чистим уже finalized/failed. Recording'и
     -- в статусе 'recording' старше 60 дней — это бессмертные
     -- зависшие; sweep_stuck должен был их давно закрыть, но если
     -- нет — тоже сносим, скорее всего никогда не доедут.
     ORDER BY created_at
     LIMIT 500 -- батчим, чтобы один запуск cron'а не сидел часами
  LOOP
    -- 1. Storage: удаляем все объекты с префиксом recording'а.
    --    SECURITY DEFINER + search_path содержит schema storage,
    --    но даём явный qualifier чтобы было прозрачно.
    WITH deleted AS (
      DELETE FROM storage.objects
       WHERE bucket_id = 'lesson-recordings'
         AND name LIKE v_rec.storage_prefix || '%'
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_objects FROM deleted;

    -- 2. Row в lesson_recordings.
    DELETE FROM public.lesson_recordings WHERE id = v_rec.id;

    deleted_recording_id := v_rec.id;
    deleted_lesson_id := v_rec.lesson_id;
    deleted_objects := v_deleted_objects;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_lesson_recordings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_lesson_recordings() TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- pg_cron: ежесуточно в 01:00 UTC = 04:00 Москва (минимальный
-- traffic у дашбордов). Идемпотентно: дропаем старый job если был.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE jid int;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'cleanup_old_lesson_recordings' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup_old_lesson_recordings',
  '0 1 * * *', -- 01:00 UTC = 04:00 MSK ежедневно
  'SELECT public.cleanup_old_lesson_recordings();'
);
