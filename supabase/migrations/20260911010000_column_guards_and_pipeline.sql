-- ---------------------------------------------------------------------------
-- Аудит бэкенда, раунд 2 (11.09.2026). Применять в Supabase SQL Editor.
--
-- 1) Колоночный REVOKE в Postgres не действует, пока у роли остаётся
--    табличная привилегия UPDATE. Проверено пробой: ученик ставил себе оценку
--    за домашку, учитель — рейтинг. Вместо колоночных REVOKE — триггеры-стражи:
--    homework, profiles (роль, баланс, служебные колонки — страж 076 был снят в 077),
--    teacher_profiles, lesson_requests.
-- 2) chat_messages: sender_role обязан совпадать с ролью отправителя;
--    метку прочтения меняет только своя сторона; attachment_url — только путь
--    в Storage, не URL.
-- 3) Пайплайн записи: статусы 'transcribed' / 'summarized', чтобы кроны не
--    застревали на первых 20 записях; попытки саммари ограничены.
-- 4) telegram_chat_id уникален; транскрипт не удаляется вместе с записью.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._is_service_role() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('role', true) = 'service_role'
      OR session_user IN ('service_role', 'supabase_admin', 'postgres')
$$;

CREATE OR REPLACE FUNCTION public._is_admin_uid() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- 1a) homework: ученик меняет только сдачу; учитель урока — всё кроме связей.
CREATE OR REPLACE FUNCTION public.guard_homework_from_client() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF public._is_service_role() OR public._is_admin_uid() THEN RETURN NEW; END IF;
  IF NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
     OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id THEN
    RAISE EXCEPTION 'homework links are immutable' USING ERRCODE = '42501';
  END IF;
  IF v_uid = OLD.teacher_id THEN RETURN NEW; END IF;
  IF v_uid = OLD.student_id THEN
    IF NEW.grade IS DISTINCT FROM OLD.grade OR NEW.score_10 IS DISTINCT FROM OLD.score_10
       OR NEW.teacher_feedback IS DISTINCT FROM OLD.teacher_feedback OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description THEN
      RAISE EXCEPTION 'student can change only the submission' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'submitted' THEN
      RAISE EXCEPTION 'student can only submit homework' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'not a participant of this homework' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS trg_guard_homework_from_client ON public.homework;
CREATE TRIGGER trg_guard_homework_from_client BEFORE UPDATE ON public.homework
  FOR EACH ROW EXECUTE FUNCTION public.guard_homework_from_client();

-- 1b) profiles: служебные колонки только сервер/админ. Страж из 076 был снят
--     миграцией 077 — проверено: ученик выставлял себе role='admin' и balance_rub.
CREATE OR REPLACE FUNCTION public.guard_profile_service_columns() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public._is_service_role() THEN RETURN NEW; END IF;
  -- Роль и активность не меняет даже админ через клиент: только сервер (service_role).
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'profiles.role/is_active are set by the platform' USING ERRCODE = '42501';
  END IF;
  IF public._is_admin_uid() THEN RETURN NEW; END IF;
  IF NEW.email IS DISTINCT FROM OLD.email
     OR NEW.email_verified IS DISTINCT FROM OLD.email_verified
     OR NEW.balance_rub IS DISTINCT FROM OLD.balance_rub
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.subscription_until IS DISTINCT FROM OLD.subscription_until
     OR NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id
     OR NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id
     OR NEW.telegram_username IS DISTINCT FROM OLD.telegram_username
     OR NEW.credentials_pending IS DISTINCT FROM OLD.credentials_pending
     OR NEW.invite_code IS DISTINCT FROM OLD.invite_code THEN
    RAISE EXCEPTION 'service columns of profiles cannot be changed from client' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_profile_service_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_service_columns BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_service_columns();

-- 1c) teacher_profiles: рейтинг, верификация, листинг, счётчики — только сервер/админ.
CREATE OR REPLACE FUNCTION public.guard_teacher_profile_from_client() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public._is_service_role() OR public._is_admin_uid() THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.rating IS DISTINCT FROM OLD.rating OR NEW.total_reviews IS DISTINCT FROM OLD.total_reviews
     OR NEW.total_lessons IS DISTINCT FROM OLD.total_lessons OR NEW.is_listed IS DISTINCT FROM OLD.is_listed THEN
    RAISE EXCEPTION 'rating/verification/listing are set by the platform' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_teacher_profile_from_client ON public.teacher_profiles;
CREATE TRIGGER trg_guard_teacher_profile_from_client BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_profile_from_client();

-- 1d) lesson_requests: связи неизменны; статус с клиента — только отмена своей заявки.
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.guard_lesson_request_from_client() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $f$
  BEGIN
    IF public._is_service_role() OR public._is_admin_uid() THEN RETURN NEW; END IF;
    IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id OR NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'lesson request links are immutable' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (NEW.status = 'cancelled' AND auth.uid() = OLD.student_id) THEN
      RAISE EXCEPTION 'lesson request status is set by the platform' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END $f$;
  DROP TRIGGER IF EXISTS trg_guard_lesson_request_from_client ON public.lesson_requests;
  CREATE TRIGGER trg_guard_lesson_request_from_client BEFORE UPDATE ON public.lesson_requests
    FOR EACH ROW EXECUTE FUNCTION public.guard_lesson_request_from_client();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 1e) user_rewards: фича удалена, клиенту писать нечего.
DO $$ BEGIN REVOKE INSERT, UPDATE, DELETE ON public.user_rewards FROM anon, authenticated; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 2) chat_messages
CREATE OR REPLACE FUNCTION public.guard_chat_message_from_client() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := auth.uid(); v_role text;
BEGIN
  IF public._is_service_role() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
    IF NEW.sender_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'sender_id must be the current user' USING ERRCODE = '42501';
    END IF;
    IF v_role = 'admin' THEN
      NEW.sender_role := CASE WHEN v_uid = NEW.teacher_id THEN 'teacher' ELSE 'student' END;
    ELSIF NEW.sender_role IS DISTINCT FROM v_role THEN
      RAISE EXCEPTION 'sender_role must match the sender profile role' USING ERRCODE = '42501';
    END IF;
    IF NEW.attachment_url IS NOT NULL AND NEW.attachment_url ~* '^\s*[a-z][a-z0-9+.-]*:' THEN
      RAISE EXCEPTION 'attachment_url must be a storage path' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: своя сторона меняет только свою метку прочтения.
  IF v_uid = OLD.teacher_id AND NEW.read_at_slot_b IS DISTINCT FROM OLD.read_at_slot_b THEN
    RAISE EXCEPTION 'cannot change the other side read marker' USING ERRCODE = '42501';
  END IF;
  IF v_uid = OLD.student_id AND NEW.read_at_slot_a IS DISTINCT FROM OLD.read_at_slot_a THEN
    RAISE EXCEPTION 'cannot change the other side read marker' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_chat_message_from_client ON public.chat_messages;
CREATE TRIGGER trg_guard_chat_message_from_client BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_chat_message_from_client();
DO $$ BEGIN
  ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_text_len CHECK (text IS NULL OR char_length(text) <= 4000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Пайплайн записи: статусы прогресса и попытки саммари.
ALTER TABLE public.lesson_recordings DROP CONSTRAINT IF EXISTS lesson_recordings_status_check;
ALTER TABLE public.lesson_recordings ADD CONSTRAINT lesson_recordings_status_check
  CHECK (status IN ('recording', 'finalized', 'transcribed', 'failed'));
ALTER TABLE public.lesson_transcripts DROP CONSTRAINT IF EXISTS lesson_transcripts_status_check;
ALTER TABLE public.lesson_transcripts ADD CONSTRAINT lesson_transcripts_status_check
  CHECK (status IN ('ok', 'summarized', 'failed'));
ALTER TABLE public.lesson_transcripts ADD COLUMN IF NOT EXISTS summary_attempts int NOT NULL DEFAULT 0;
-- Уже обработанные: записи с ok-транскриптом → transcribed, транскрипты с саммари → summarized.
UPDATE public.lesson_recordings r SET status = 'transcribed'
  WHERE r.status = 'finalized' AND EXISTS (SELECT 1 FROM public.lesson_transcripts t WHERE t.recording_id = r.id AND t.status IN ('ok', 'summarized'));
UPDATE public.lesson_transcripts t SET status = 'summarized'
  WHERE t.status = 'ok' AND EXISTS (SELECT 1 FROM public.lesson_summaries s WHERE s.lesson_id = t.lesson_id AND s.source = 'recording');
-- Транскрипт переживает удаление аудио по retention.
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.lesson_transcripts'::regclass AND contype = 'f'
     AND pg_get_constraintdef(oid) LIKE '%lesson_recordings%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.lesson_transcripts DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE public.lesson_transcripts ALTER COLUMN recording_id DROP NOT NULL;
  ALTER TABLE public.lesson_transcripts ADD CONSTRAINT lesson_transcripts_recording_id_fkey
    FOREIGN KEY (recording_id) REFERENCES public.lesson_recordings(id) ON DELETE SET NULL;
END $$;

-- 4) Один Telegram-чат — один профиль (если дублей нет).
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_chat_id_unique ON public.profiles (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'telegram_chat_id duplicates exist, index skipped'; END $$;
