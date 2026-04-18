-- 011_roast_levels.sql
-- Replace CEFR levels (A1..C2) with roast levels (Raw..Well Done).
-- Mapping: A1→Raw, A2→Rare, B1→Medium Rare, B2→Medium, C1→Medium Well, C2→Well Done.

-- user_progress.english_level
ALTER TABLE user_progress DROP CONSTRAINT IF EXISTS user_progress_english_level_check;

UPDATE user_progress SET english_level = CASE english_level
    WHEN 'A1' THEN 'Raw'
    WHEN 'A2' THEN 'Rare'
    WHEN 'B1' THEN 'Medium Rare'
    WHEN 'B2' THEN 'Medium'
    WHEN 'C1' THEN 'Medium Well'
    WHEN 'C2' THEN 'Well Done'
    ELSE english_level
END
WHERE english_level IS NOT NULL;

ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_english_level_check
    CHECK (english_level IN ('Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'));

-- level_tests.level
ALTER TABLE level_tests DROP CONSTRAINT IF EXISTS level_tests_level_check;

UPDATE level_tests SET level = CASE level
    WHEN 'A1' THEN 'Raw'
    WHEN 'A2' THEN 'Rare'
    WHEN 'B1' THEN 'Medium Rare'
    WHEN 'B2' THEN 'Medium'
    WHEN 'C1' THEN 'Medium Well'
    WHEN 'C2' THEN 'Well Done'
    ELSE level
END;

ALTER TABLE level_tests
    ADD CONSTRAINT level_tests_level_check
    CHECK (level IN ('Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'));
