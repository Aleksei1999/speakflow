-- Phase 1 AI-саммари: храним факт что урок пишется + где лежат
-- сырые чанки в Storage. Реальные транскрипт/саммари — в отдельных
-- таблицах на следующих фазах (lesson_transcripts, lesson_summaries,
-- lesson_quizzes).

CREATE TABLE IF NOT EXISTS public.lesson_recordings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  -- Префикс в bucket lesson-recordings: lessons/{lesson_id}/{recording_id}/
  -- Каждый chunk = отдельный файл chunk-{seq:04}.webm внутри префикса.
  storage_prefix text NOT NULL,
  status        text NOT NULL DEFAULT 'recording'
                CHECK (status IN ('recording','finalized','failed')),
  chunks_count  int  NOT NULL DEFAULT 0,
  duration_sec  int,
  total_bytes   bigint NOT NULL DEFAULT 0,
  mime_type     text NOT NULL DEFAULT 'audio/webm',
  error_message text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finalized_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_recordings_status_idx
  ON public.lesson_recordings (status, finalized_at);

ALTER TABLE public.lesson_recordings ENABLE ROW LEVEL SECURITY;

-- SELECT: участникам урока + admin (helper из мигр 20260510120000).
DROP POLICY IF EXISTS "lesson_recordings_select_participant" ON public.lesson_recordings;
CREATE POLICY "lesson_recordings_select_participant"
  ON public.lesson_recordings FOR SELECT
  TO authenticated
  USING (public.is_lesson_participant(lesson_id));

-- INSERT/UPDATE/DELETE — закрыты для anon/authenticated. API ходит через
-- createAdminClient после requireLessonTeacherOrAdmin gate. Без policy
-- = доступ только service_role.

-- updated_at тригер
CREATE OR REPLACE FUNCTION public.lesson_recordings_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lesson_recordings_updated_at ON public.lesson_recordings;
CREATE TRIGGER lesson_recordings_updated_at
  BEFORE UPDATE ON public.lesson_recordings
  FOR EACH ROW EXECUTE FUNCTION public.lesson_recordings_set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- Storage bucket lesson-recordings (private). RLS policies на
-- storage.objects, чтобы участники могли только READ через signed URL,
-- а WRITE — только service_role (через наш API после авторизации).
-- ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-recordings', 'lesson-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- SELECT — участникам урока + admin. Лессон id — первый сегмент после
-- "lessons/" в storage_path: lessons/{lesson_id}/{recording_id}/chunk-N.webm
DROP POLICY IF EXISTS "lesson_recordings_storage_select" ON storage.objects;
CREATE POLICY "lesson_recordings_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lesson-recordings'
    AND (
      EXISTS (
        SELECT 1 FROM public.lesson_recordings lr
        WHERE lr.storage_prefix = (storage.foldername(name))[1] || '/' || (storage.foldername(name))[2] || '/' || (storage.foldername(name))[3] || '/'
          AND public.is_lesson_participant(lr.lesson_id)
      )
    )
  );

-- INSERT/UPDATE/DELETE для anon/authenticated — закрыто. Service-role
-- (наш API) пишет напрямую, либо выдаёт signed upload URLs.
