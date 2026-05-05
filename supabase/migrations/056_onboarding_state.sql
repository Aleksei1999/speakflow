-- 056_onboarding_state.sql
-- ============================================================
-- Состояние онбординг-тура: на каком шаге пользователь, прошёл ли его.
-- Шаг хранится строкой ('pending' / 'in_progress' / 'completed' / 'skipped').
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Уже существующих юзеров не достаём туром — отметим их как completed.
UPDATE public.profiles
   SET onboarding_step = 'completed',
       onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())
 WHERE onboarding_step = 'pending'
   AND created_at < NOW() - interval '1 hour';
