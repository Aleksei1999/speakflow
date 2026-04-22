-- 025_settings_prefs.sql
-- Adds jsonb preference columns driving /student/settings:
--   notification_prefs   — toggles + channel selector
--   ui_prefs             — theme, xp visibility, sounds, confetti, language
--   profile_visibility   — leaderboard/teacher visibility
--   language             — interface language (ru | en), kept as plain text for easy filtering
--
-- All columns have sensible defaults so existing rows stay functional without backfill.
-- Idempotent: ADD COLUMN IF NOT EXISTS everywhere.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS notification_prefs  jsonb NOT NULL DEFAULT jsonb_build_object(
        'lesson_reminders',    true,
        'daily_challenge',     true,
        'streak_warning',      true,
        'new_clubs',           true,
        'achievements',        true,
        'leaderboard',         false,
        'email_digest',        true,
        'marketing',           false,
        'channel',             'telegram'
    ),
    ADD COLUMN IF NOT EXISTS ui_prefs            jsonb NOT NULL DEFAULT jsonb_build_object(
        'theme',               'light',
        'show_xp_bar',         true,
        'sounds',              true,
        'confetti',            true
    ),
    ADD COLUMN IF NOT EXISTS profile_visibility  jsonb NOT NULL DEFAULT jsonb_build_object(
        'leaderboard_public',  true,
        'visible_to_teachers', true
    ),
    ADD COLUMN IF NOT EXISTS language            text  NOT NULL DEFAULT 'ru';

-- Constrain language to known values.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_language_chk'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_language_chk
            CHECK (language IN ('ru','en'));
    END IF;
END $$;

-- Constrain theme to known values. We enforce via expression index-backed check so jsonb doesn't drift.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_ui_theme_chk'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_ui_theme_chk
            CHECK (
                ui_prefs->>'theme' IS NULL
                OR ui_prefs->>'theme' IN ('light','dark','auto')
            );
    END IF;
END $$;
