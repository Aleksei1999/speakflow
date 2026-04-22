-- 024_profile_expansion.sql
-- Expands profiles with fields driving the student profile page:
--   balance_rub          — integer rubles (no decimals — Yookassa also uses kopecks/100)
--   subscription_tier    — 'free' | 'pro'
--   subscription_until   — expiry for paid tier
--   city / occupation / english_goal / interests — self-reported about fields
--
-- Idempotent: every column uses IF NOT EXISTS so re-running is safe.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS balance_rub        integer                  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subscription_tier  text                     NOT NULL DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS subscription_until timestamptz              NULL,
    ADD COLUMN IF NOT EXISTS city               text                     NULL,
    ADD COLUMN IF NOT EXISTS occupation         text                     NULL,
    ADD COLUMN IF NOT EXISTS english_goal       text                     NULL,
    ADD COLUMN IF NOT EXISTS interests          text[]                   NOT NULL DEFAULT '{}'::text[];

-- Constrain subscription_tier to the known enum values.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_subscription_tier_chk'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_subscription_tier_chk
            CHECK (subscription_tier IN ('free','pro'));
    END IF;
END $$;

-- Prevent negative balance slipping in.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_balance_rub_nonneg_chk'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_balance_rub_nonneg_chk
            CHECK (balance_rub >= 0);
    END IF;
END $$;

-- Allow owners to update their own about-fields (city/occupation/english_goal/interests).
-- Existing RLS on profiles already restricts most columns via app-level validation;
-- we just need to make sure the owner can UPDATE their row at all. If there's already
-- a self-update policy it stays.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='profiles'
          AND policyname='profiles_update_own'
    ) THEN
        CREATE POLICY profiles_update_own
            ON public.profiles
            FOR UPDATE
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;
