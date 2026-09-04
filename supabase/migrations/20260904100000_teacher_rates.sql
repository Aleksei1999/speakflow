-- Глобальные тарифы для учителей (единые для всех).
-- Админ ставит их в /admin, учитель видит в плашке «доход» и в /teacher/summaries.
--
-- Три ключа:
--   teacher_rate_60_kopecks   — за индивидуальный урок 60 мин
--   teacher_rate_90_kopecks   — за индивидуальный урок 90 мин
--   teacher_rate_group_kopecks — за одно занятие с группой (клуб)

CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read_all" ON public.app_settings;
CREATE POLICY "app_settings_read_all"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;
CREATE POLICY "app_settings_admin_write"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.app_settings (key, value) VALUES
  ('teacher_rate_60_kopecks', '0'::jsonb),
  ('teacher_rate_90_kopecks', '0'::jsonb),
  ('teacher_rate_group_kopecks', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;
