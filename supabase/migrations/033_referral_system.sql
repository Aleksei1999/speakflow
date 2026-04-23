-- 033_referral_system.sql
-- Referral system MVP.
--
-- Economy:
--   * Invitee gets +50 XP on signup (source_type = 'referral_signup_bonus').
--   * Inviter gets +100 XP when the invitee completes their first lesson
--     (source_type = 'referral_activated').
--   * Cap: 10 activations lifetime per inviter (max 1000 XP from referrals).
--   * Achievements (015/023): comm_recruiter (1), comm_ambassador (5),
--     comm_community_builder (10) are granted inside activate_referral so the
--     user_achievements row and the achievement xp_reward fire synchronously.
--
-- Schema (Option B — minimal):
--   profiles.invite_code (UNIQUE, base32 8 chars)
--   profiles.referred_by_user_id (FK auth.users)
--   public.referrals (ledger of sent / registered / activated invites)
--
-- Integration points:
--   * handle_new_user() (migration 032) is extended to:
--       (a) generate an invite_code for the new profile;
--       (b) call claim_referral() if raw_user_meta_data.ref_code is present.
--     The extension lives inside the same BEGIN/EXCEPTION WHEN OTHERS -> RAISE LOG
--     envelope so a broken referral never blocks signup (defense in depth).
--   * on_lesson_completed() (migration 022) is extended to call
--     activate_referral(student_id) after the XP award so the inviter gets
--     rewarded on the student's *first* completed lesson only.
--
-- All SECURITY DEFINER functions SET search_path = public, pg_temp per Supabase
-- best practice.


-- =====================================================================
-- 1. xp_events.source_type — extend CHECK to accept referral sources
-- =====================================================================
ALTER TABLE public.xp_events DROP CONSTRAINT IF EXISTS xp_events_source_type_check;
ALTER TABLE public.xp_events
    ADD CONSTRAINT xp_events_source_type_check
    CHECK (source_type IN (
        'lesson_completed',
        'club_joined',
        'club_attended',
        'club_completed',
        'course_enrolled',
        'course_lesson_completed',
        'course_completed',
        'homework_submitted',
        'streak_bonus',
        'daily_challenge',
        'achievement',
        'level_test',
        'signup_bonus',
        'manual',
        'referral_signup_bonus',
        'referral_activated'
    ));


-- =====================================================================
-- 2. profiles — invite_code + referred_by_user_id
-- =====================================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS invite_code TEXT,
    ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- UNIQUE index (deferred; we backfill before adding the UNIQUE constraint itself).
CREATE INDEX IF NOT EXISTS idx_profiles_invite_code ON public.profiles(invite_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by_user_id);


-- =====================================================================
-- 3. referrals — ledger
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.referrals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_email       TEXT,
    invite_code         TEXT NOT NULL,
    channel             TEXT NOT NULL DEFAULT 'link'
                        CHECK (channel IN ('email', 'link', 'social')),
    status              TEXT NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent', 'registered', 'activated', 'expired')),
    registered_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    xp_awarded          INT NOT NULL DEFAULT 0,
    ip_hash             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    registered_at       TIMESTAMPTZ,
    activated_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ DEFAULT (now() + INTERVAL '90 days'),
    CHECK (inviter_id <> registered_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON public.referrals(inviter_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status)
    WHERE status IN ('sent', 'registered');
CREATE INDEX IF NOT EXISTS idx_referrals_registered_user ON public.referrals(registered_user_id)
    WHERE registered_user_id IS NOT NULL;

-- RLS: inviter reads his own rows. Writes go through SECURITY DEFINER only.
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referrals_select_own ON public.referrals;
CREATE POLICY referrals_select_own
    ON public.referrals FOR SELECT
    TO authenticated
    USING (inviter_id = auth.uid());

-- Intentionally no INSERT/UPDATE/DELETE policies: only service_role (admin)
-- and SECURITY DEFINER functions can mutate the table.


-- =====================================================================
-- 4. generate_invite_code() — unique base32 8-char code
-- =====================================================================
-- Uses Crockford-ish alphabet (no 0/O/1/I confusion). Retries up to 5x on
-- collision; after that raises so the caller can decide (in practice we only
-- need retry for the first few million users).
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
    v_code     TEXT;
    v_exists   BOOLEAN;
    i          INT;
    v_attempts INT := 0;
BEGIN
    LOOP
        v_code := '';
        FOR i IN 1..8 LOOP
            v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::INT, 1);
        END LOOP;

        SELECT EXISTS (SELECT 1 FROM public.profiles WHERE invite_code = v_code)
          INTO v_exists;

        EXIT WHEN NOT v_exists;

        v_attempts := v_attempts + 1;
        IF v_attempts > 5 THEN
            RAISE EXCEPTION 'generate_invite_code: could not allocate a unique code after 5 attempts';
        END IF;
    END LOOP;

    RETURN v_code;
END;
$$;

COMMENT ON FUNCTION public.generate_invite_code()
    IS 'Returns a unique 8-char base32 invite code. Retries up to 5x on collision.';

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO service_role;


-- =====================================================================
-- 5. Backfill invite_code for existing profiles + add UNIQUE
-- =====================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.profiles WHERE invite_code IS NULL LOOP
        UPDATE public.profiles
           SET invite_code = public.generate_invite_code()
         WHERE id = r.id;
    END LOOP;
END;
$$;

-- Now that every row has a code, enforce uniqueness.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'profiles_invite_code_key'
           AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_invite_code_key UNIQUE (invite_code);
    END IF;
END;
$$;


-- =====================================================================
-- 6. claim_referral(invitee_user_id, code)
-- =====================================================================
-- Called from handle_new_user when raw_user_meta_data.ref_code is present.
-- Validates the code, writes profiles.referred_by_user_id, inserts a
-- referrals row with status='registered', and awards +50 XP to the invitee.
--
-- Safety:
--   * self-referral blocked (CHECK + explicit guard).
--   * unknown code -> log and return FALSE (don't crash signup).
--   * idempotent: if the user already has referred_by_user_id, returns FALSE
--     without mutating state.
CREATE OR REPLACE FUNCTION public.claim_referral(
    p_invitee_user_id UUID,
    p_code            TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inviter_id    UUID;
    v_already       UUID;
BEGIN
    IF p_code IS NULL OR length(trim(p_code)) = 0 OR p_invitee_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Idempotency: if already claimed, do nothing.
    SELECT referred_by_user_id INTO v_already
      FROM public.profiles
     WHERE id = p_invitee_user_id;

    IF v_already IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    -- Look up the inviter by code.
    SELECT id INTO v_inviter_id
      FROM public.profiles
     WHERE invite_code = upper(trim(p_code))
     LIMIT 1;

    IF v_inviter_id IS NULL THEN
        RAISE LOG 'claim_referral: unknown code % for user %', p_code, p_invitee_user_id;
        RETURN FALSE;
    END IF;

    -- Block self-referral (also enforced by table CHECK once registered_user_id is set).
    IF v_inviter_id = p_invitee_user_id THEN
        RAISE LOG 'claim_referral: self-referral blocked for user %', p_invitee_user_id;
        RETURN FALSE;
    END IF;

    -- Stamp referred_by.
    UPDATE public.profiles
       SET referred_by_user_id = v_inviter_id
     WHERE id = p_invitee_user_id;

    -- Ledger row.
    INSERT INTO public.referrals (
        inviter_id, invite_code, channel, status,
        registered_user_id, registered_at
    ) VALUES (
        v_inviter_id, upper(trim(p_code)), 'link', 'registered',
        p_invitee_user_id, now()
    );

    -- +50 XP welcome bonus to the invitee. No daily cap on this source.
    PERFORM public.award_xp(
        p_invitee_user_id,
        'referral_signup_bonus',
        NULL,
        50,
        'Бонус за регистрацию по инвайту',
        jsonb_build_object('inviter_id', v_inviter_id, 'code', upper(trim(p_code)))
    );

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'claim_referral failed (user=%, code=%): % / %',
        p_invitee_user_id, p_code, SQLSTATE, SQLERRM;
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.claim_referral(UUID, TEXT)
    IS 'Claims a referral code for a newly-registered user. Writes profiles.referred_by_user_id, inserts a referrals ledger row, awards +50 XP to the invitee. Idempotent. Returns TRUE on success.';

REVOKE ALL ON FUNCTION public.claim_referral(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral(UUID, TEXT) TO service_role;


-- =====================================================================
-- 7. activate_referral(user_id)
-- =====================================================================
-- Called from on_lesson_completed() when a student completes a lesson.
-- Idempotent: only the FIRST call per invitee flips the ledger row to
-- 'activated' and awards +100 XP to the inviter. Subsequent calls no-op.
--
-- Cap enforcement: if the inviter already has 10 activated referrals, the
-- ledger row is still flipped to 'activated' (history is truthful) but
-- xp_awarded=0 and no XP is paid out. This keeps the counter accurate for
-- the community achievements (Recruiter/Ambassador/Community Builder) while
-- honoring the 1000 XP cap.
--
-- Achievements: after each successful activation we sync user_achievements
-- with the comm_recruiter / comm_ambassador / comm_community_builder
-- thresholds so the dashboard lights up without an external cron.
CREATE OR REPLACE FUNCTION public.activate_referral(
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inviter_id       UUID;
    v_activated_count  INT;
    v_referral_id      UUID;
    v_xp_to_award      INT := 100;
    v_new_count        INT;
    v_ach              RECORD;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT referred_by_user_id INTO v_inviter_id
      FROM public.profiles
     WHERE id = p_user_id;

    IF v_inviter_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Find the pending ledger row for this invitee. If it's already activated,
    -- this is a no-op (e.g. second lesson completion after the first).
    SELECT id INTO v_referral_id
      FROM public.referrals
     WHERE registered_user_id = p_user_id
       AND inviter_id = v_inviter_id
       AND status = 'registered'
     ORDER BY registered_at ASC
     LIMIT 1;

    IF v_referral_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Count already-activated referrals for this inviter to enforce the cap.
    SELECT COUNT(*) INTO v_activated_count
      FROM public.referrals
     WHERE inviter_id = v_inviter_id
       AND status = 'activated';

    IF v_activated_count >= 10 THEN
        v_xp_to_award := 0;
    END IF;

    -- Flip the row (within a single SQL statement for atomicity).
    UPDATE public.referrals
       SET status       = 'activated',
           activated_at = now(),
           xp_awarded   = v_xp_to_award
     WHERE id = v_referral_id;

    -- Pay the inviter if we are still under the cap.
    IF v_xp_to_award > 0 THEN
        PERFORM public.award_xp(
            v_inviter_id,
            'referral_activated',
            p_user_id,
            v_xp_to_award,
            'Друг прошёл первый урок',
            jsonb_build_object('invitee_id', p_user_id, 'referral_id', v_referral_id)
        );
    END IF;

    -- Sync community achievements based on the new activated_count.
    v_new_count := v_activated_count + 1;

    FOR v_ach IN
        SELECT id, slug, threshold, xp_reward
          FROM public.achievement_definitions
         WHERE slug IN ('comm_recruiter', 'comm_ambassador', 'comm_community_builder')
    LOOP
        IF v_new_count >= v_ach.threshold THEN
            INSERT INTO public.user_achievements (user_id, achievement_id)
            VALUES (v_inviter_id, v_ach.id)
            ON CONFLICT (user_id, achievement_id) DO NOTHING;

            -- If the INSERT actually happened, award the achievement XP once.
            IF FOUND THEN
                PERFORM public.award_xp(
                    v_inviter_id,
                    'achievement',
                    v_ach.id,
                    v_ach.xp_reward,
                    v_ach.slug,
                    jsonb_build_object('achievement_slug', v_ach.slug)
                );
            END IF;
        END IF;
    END LOOP;

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'activate_referral failed for user %: % / %',
        p_user_id, SQLSTATE, SQLERRM;
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.activate_referral(UUID)
    IS 'Called from on_lesson_completed when a referred user completes a lesson. Idempotent. Flips the referrals row to activated and awards +100 XP to the inviter (capped at 10 activations = 1000 XP). Also syncs comm_recruiter/ambassador/community_builder achievements.';

REVOKE ALL ON FUNCTION public.activate_referral(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_referral(UUID) TO service_role;


-- =====================================================================
-- 8. Extend handle_new_user() to allocate invite_code and claim ref_code
-- =====================================================================
-- The body is a superset of migration 032. The inner BEGIN/EXCEPTION block is
-- kept so any failure in the referral step RAISES LOG but never blocks the
-- auth.users insert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_role       TEXT;
    v_first      TEXT;
    v_last       TEXT;
    v_full_name  TEXT;
    v_phone      TEXT;
    v_ref_code   TEXT;
    v_code       TEXT;
BEGIN
    v_role  := COALESCE(NEW.raw_user_meta_data ->> 'role', 'student');

    v_first := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'first_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'given_name'), '')
    );
    v_last  := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'last_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'family_name'), '')
    );
    v_phone := NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '');

    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), '')
    );
    IF v_full_name IS NULL THEN
        v_full_name := NULLIF(trim(COALESCE(v_first, '') || ' ' || COALESCE(v_last, '')), '');
    END IF;
    IF v_full_name IS NULL OR v_full_name = '' THEN
        v_full_name := COALESCE(NEW.email, '');
    END IF;

    IF v_first IS NULL AND v_full_name IS NOT NULL AND v_full_name <> '' THEN
        v_first := NULLIF(split_part(v_full_name, ' ', 1), '');
        IF position(' ' IN v_full_name) > 0 THEN
            v_last := NULLIF(trim(substring(v_full_name FROM position(' ' IN v_full_name) + 1)), '');
        ELSE
            v_last := NULL;
        END IF;
    END IF;

    v_ref_code := NULLIF(trim(NEW.raw_user_meta_data ->> 'ref_code'), '');

    BEGIN
        -- Allocate a unique invite_code for the NEW user up-front so the
        -- INSERT below can carry it (avoids a separate UPDATE + races).
        v_code := public.generate_invite_code();

        INSERT INTO public.profiles (id, email, full_name, first_name, last_name, phone, role, invite_code)
        VALUES (
            NEW.id,
            COALESCE(NEW.email, ''),
            v_full_name,
            v_first,
            v_last,
            v_phone,
            CASE WHEN v_role IN ('student', 'teacher', 'admin') THEN v_role ELSE 'student' END,
            v_code
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.user_progress (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;

        IF v_role = 'teacher' THEN
            INSERT INTO public.teacher_profiles (user_id, hourly_rate, is_listed)
            VALUES (NEW.id, 100000, false)
            ON CONFLICT (user_id) DO NOTHING;
        END IF;

        -- Referral claim (best-effort — own exception handler inside the fn).
        IF v_ref_code IS NOT NULL THEN
            PERFORM public.claim_referral(NEW.id, v_ref_code);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'handle_new_user failed for user % (role=%): % / %', NEW.id, v_role, SQLSTATE, SQLERRM;
    END;

    RETURN NEW;
END;
$function$;


-- =====================================================================
-- 9. Extend on_lesson_completed() to call activate_referral()
-- =====================================================================
-- Only the final PERFORM line is new. Everything else matches migration 022.
CREATE OR REPLACE FUNCTION public.on_lesson_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_amount INT;
BEGIN
    v_amount := CASE NEW.duration_minutes
                    WHEN 45 THEN 40
                    WHEN 50 THEN 45
                    WHEN 60 THEN 55
                    ELSE GREATEST(1, ROUND(NEW.duration_minutes * 55.0 / 60)::INT)
                END;

    PERFORM award_xp(
        NEW.student_id,
        'lesson_completed',
        NEW.id,
        v_amount,
        'Урок ' || NEW.duration_minutes || ' мин',
        jsonb_build_object(
            'lesson_id',       NEW.id,
            'duration',        NEW.duration_minutes,
            'teacher_id',      NEW.teacher_id,
            'scheduled_at',    NEW.scheduled_at
        )
    );

    INSERT INTO user_progress (user_id, lessons_completed, updated_at)
    VALUES (NEW.student_id, 1, now())
    ON CONFLICT (user_id) DO UPDATE
        SET lessons_completed = user_progress.lessons_completed + 1,
            updated_at        = now();

    -- Referral activation — idempotent, self-guarded, only first lesson counts.
    PERFORM public.activate_referral(NEW.student_id);

    RETURN NEW;
END;
$$;
