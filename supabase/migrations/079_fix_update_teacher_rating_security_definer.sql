-- 079: update_teacher_rating должен быть SECURITY DEFINER
-- Иначе при INSERT отзыва студентом триггер пытается обновить
-- teacher_profiles чужой строки, RLS-политика teacher_profiles_update_own
-- (user_id = auth.uid()) блокирует UPDATE тихо — 0 rows, без error.
-- Результат: rating/total_reviews всегда 0 у живого продакшна.

CREATE OR REPLACE FUNCTION public.update_teacher_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    UPDATE teacher_profiles
    SET
        rating = (
            SELECT COALESCE(ROUND(AVG(r.rating)::NUMERIC, 2), 0)
            FROM reviews r
            WHERE r.teacher_id = NEW.teacher_id
              AND r.is_visible = true
        ),
        total_reviews = (
            SELECT COUNT(*)
            FROM reviews r
            WHERE r.teacher_id = NEW.teacher_id
              AND r.is_visible = true
        ),
        updated_at = now()
    WHERE id = NEW.teacher_id;

    RETURN NEW;
END;
$function$;

-- Backfill: пересчитать rating/total_reviews для всех teacher_profiles,
-- у которых исторически уже были отзывы (триггер раньше молча падал).
UPDATE teacher_profiles tp
SET
    rating = COALESCE(agg.avg_rating, 0),
    total_reviews = COALESCE(agg.cnt, 0),
    updated_at = now()
FROM (
    SELECT
        teacher_id,
        ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating,
        COUNT(*) AS cnt
    FROM reviews
    WHERE is_visible = true
    GROUP BY teacher_id
) agg
WHERE tp.id = agg.teacher_id;
