-- Storage-buckets: убираем XSS-векторы из allowed_mime_types.
--
-- Аудит #11 (файловые загрузки, XSS через inline-рендер) выявил два вектора:
--
-- 1. `teacher-materials` и `homework-submissions` разрешали 'image/svg+xml'
--    (мигр 027, 034). SVG — это XML с полноценным JS (<script>, onload=…).
--    Файлы отдаются inline через signed URL с того же origin'а, где живёт
--    приложение → cookie-based XSS (кража сессии Supabase, вызов API от имени
--    жертвы). SVG в этих бакетах реально никем не используется — превьюшек
--    для SVG в UI нет, а как «изображение» подойдут jpeg/png/webp/gif/heic/avif.
--
-- 2. `lesson-files` (public bucket) в мигр 052 получил разрешение на прямой
--    upload authenticated-клиентом (в обход /api/lesson/upload — там 4.5 MB
--    Vercel-cap). MIME-whitelist на бакете НЕ был задан → любой участник урока
--    мог залить произвольный .html/.svg/.js напрямую и получить публичный URL
--    с того же origin'а. Server-proxy /api/lesson/upload MIME проверяет, но
--    прямой путь — нет. Синхронизируем bucket-whitelist с ALLOWED_FILE_MIMES
--    из src/lib/api/file-upload.ts.

-- ---------------------------------------------------------------------------
-- 1. teacher-materials: без SVG
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
        -- Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/rtf',
        'text/plain',
        -- Images (без svg)
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/heic',
        'image/heif',
        'image/avif',
        -- Audio
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/mp4',
        'audio/webm',
        'audio/x-m4a',
        'audio/m4a',
        'audio/aac',
        'audio/flac',
        -- Video
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo'
   ]
 WHERE id = 'teacher-materials';

-- ---------------------------------------------------------------------------
-- 2. homework-submissions: без SVG
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
        -- Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/rtf',
        'text/plain',
        -- Images (без svg)
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/heic',
        'image/heif',
        'image/avif',
        -- Audio
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/mp4',
        'audio/webm',
        'audio/x-m4a',
        'audio/m4a',
        'audio/aac',
        'audio/flac',
        -- Video
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo'
   ]
 WHERE id = 'homework-submissions';

-- ---------------------------------------------------------------------------
-- 2b. Существующие SVG в двух приватных бакетах: whitelist блокирует
-- только будущие uploads. Если уже загружено — надо посмотреть глазами
-- и удалить вручную (могут быть легитимные, могут быть эксплойты).
-- Логируем количество через NOTICE, чтобы человек увидел и разобрался.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  svg_tm  INT;
  svg_hw  INT;
BEGIN
  SELECT COUNT(*) INTO svg_tm
    FROM storage.objects
   WHERE bucket_id = 'teacher-materials'
     AND (metadata->>'mimetype') = 'image/svg+xml';
  SELECT COUNT(*) INTO svg_hw
    FROM storage.objects
   WHERE bucket_id = 'homework-submissions'
     AND (metadata->>'mimetype') = 'image/svg+xml';

  IF svg_tm > 0 OR svg_hw > 0 THEN
    RAISE NOTICE
      'XSS-audit: existing SVG uploads — teacher-materials=%, homework-submissions=%. Review manually via storage.objects and delete if not legit.',
      svg_tm, svg_hw;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. lesson-files: явный whitelist (раньше пустой → любой MIME пропускался
-- на прямом upload'е из клиента). Синхронизируем с ALLOWED_FILE_MIMES из
-- src/lib/api/file-upload.ts.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
        -- Documents
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        -- Images (без svg)
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        -- Audio
        'audio/mpeg',
        'audio/mp4',
        'audio/ogg',
        'audio/webm',
        -- Video
        'video/mp4',
        'video/webm',
        -- Archives / legacy office
        'application/zip',
        'application/x-cfb'
   ]
 WHERE id = 'lesson-files';
