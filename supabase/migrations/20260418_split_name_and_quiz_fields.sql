-- 20260418_split_name_and_quiz_fields.sql
-- Split profiles.full_name into first_name/last_name, extend level_tests for quiz flow,
-- update handle_new_user to pull first_name/last_name/phone from raw_user_meta_data.

-- ── profiles ──────────────────────────────────────────────────────────────────

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- Backfill: split existing full_name on first whitespace
UPDATE profiles
SET
    first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), '')),
    last_name  = COALESCE(
        last_name,
        NULLIF(trim(substring(full_name FROM position(' ' IN full_name) + 1)), '')
    )
WHERE first_name IS NULL OR last_name IS NULL;

-- Keep full_name in sync with first_name + last_name
CREATE OR REPLACE FUNCTION sync_profile_full_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL THEN
        NEW.full_name := trim(
            COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_sync_full_name ON profiles;
CREATE TRIGGER trg_profiles_sync_full_name
    BEFORE INSERT OR UPDATE OF first_name, last_name ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_full_name();

-- ── handle_new_user: pull extra fields from signup metadata ──────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role       TEXT;
    v_first      TEXT;
    v_last       TEXT;
    v_full_name  TEXT;
    v_phone      TEXT;
BEGIN
    v_role  := COALESCE(NEW.raw_user_meta_data ->> 'role', 'student');
    v_first := NULLIF(trim(NEW.raw_user_meta_data ->> 'first_name'), '');
    v_last  := NULLIF(trim(NEW.raw_user_meta_data ->> 'last_name'), '');
    v_phone := NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '');

    v_full_name := NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), '');
    IF v_full_name IS NULL THEN
        v_full_name := trim(COALESCE(v_first, '') || ' ' || COALESCE(v_last, ''));
    END IF;
    IF v_full_name = '' THEN
        v_full_name := COALESCE(NEW.email, '');
    END IF;

    INSERT INTO profiles (id, email, full_name, first_name, last_name, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        v_full_name,
        v_first,
        v_last,
        v_phone,
        CASE WHEN v_role IN ('student', 'teacher', 'admin') THEN v_role ELSE 'student' END
    );

    -- Student progress row
    INSERT INTO user_progress (id, user_id)
    VALUES (gen_random_uuid(), NEW.id)
    ON CONFLICT DO NOTHING;

    -- Teacher profile auto-create (gated, not listed in catalog by default)
    IF v_role = 'teacher' THEN
        INSERT INTO teacher_profiles (id, hourly_rate, is_listed)
        VALUES (NEW.id, 100000, false)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── level_tests: total_questions + xp for quiz popup ─────────────────────────

ALTER TABLE level_tests
    ADD COLUMN IF NOT EXISTS total_questions INT,
    ADD COLUMN IF NOT EXISTS xp              INT;
