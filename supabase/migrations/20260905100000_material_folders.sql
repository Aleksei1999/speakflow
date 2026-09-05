-- ============================================================================
-- 20260905100000_material_folders.sql
-- Папки для Библиотеки и Домашних заданий.
--
-- Пул общий (без per-student), учитель/админ могут создавать/переименовывать/
-- удалять папки, студент — только читать. Каждый material привязывается к
-- папке через FK; при удалении папки материалы каскадно удаляются вместе
-- со storage-объектами через триггер приложения (не тут).
--
-- Миграция также создаёт две дефолтные папки («Мои файлы») — по одной
-- для kind='library' и kind='homework' — и переносит все существующие
-- материалы туда, чтобы UI не показывал пустой корень при апгрейде.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.material_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'Новая папка',
  kind        TEXT NOT NULL CHECK (kind IN ('library','homework')),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS material_folders_kind_created_at_idx
  ON public.material_folders (kind, created_at DESC);

-- Связь materials → folder. Nullable → материал в корне (легаси/orphans).
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.material_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS materials_folder_id_idx ON public.materials (folder_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.material_folders ENABLE ROW LEVEL SECURITY;

-- Читать может любой авторизованный (студенты видят Библиотеку/ДЗ read-only).
CREATE POLICY material_folders_read_all
  ON public.material_folders FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Писать может teacher или admin.
CREATE POLICY material_folders_write_teacher_admin
  ON public.material_folders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill: создаём по одной дефолтной папке для library и homework,
-- переносим туда все существующие материалы.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  lib_id UUID;
  hw_id  UUID;
BEGIN
  -- library
  IF NOT EXISTS (SELECT 1 FROM public.material_folders WHERE kind = 'library') THEN
    INSERT INTO public.material_folders (name, kind) VALUES ('Мои файлы', 'library')
      RETURNING id INTO lib_id;
  ELSE
    SELECT id INTO lib_id FROM public.material_folders WHERE kind = 'library' ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- homework
  IF NOT EXISTS (SELECT 1 FROM public.material_folders WHERE kind = 'homework') THEN
    INSERT INTO public.material_folders (name, kind) VALUES ('Мои файлы', 'homework')
      RETURNING id INTO hw_id;
  ELSE
    SELECT id INTO hw_id FROM public.material_folders WHERE kind = 'homework' ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- Публичные материалы → library folder.
  UPDATE public.materials
    SET folder_id = lib_id
    WHERE is_public = true AND folder_id IS NULL;

  -- Приватные материалы, к которым есть material_shares → homework folder.
  UPDATE public.materials
    SET folder_id = hw_id
    WHERE is_public = false AND folder_id IS NULL
      AND id IN (SELECT DISTINCT material_id FROM public.material_shares WHERE material_id IS NOT NULL);
END $$;

COMMIT;
