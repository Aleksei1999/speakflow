-- ---------------------------------------------------------------------------
-- Снимок функций, которые жили только в проде (созданы через MCP/Studio),
-- выгружен из pg_get_functiondef 12.09.2026. Без него при переносе проекта
-- падают дашборды ученика и учителя и выделение seq для чанков записи.
--
-- Применять не обязательно (в проде они уже есть); файл нужен, чтобы
-- `supabase db reset` / новый проект поднимались из миграций. CREATE OR REPLACE —
-- повторное применение безопасно.
--
-- Примечание: get_student_dashboard всё ещё собирает legacy-поля (user_progress,
-- achievement_definitions, get_leaderboard, xp_events, jitsi_room_name).
-- В интерфейсе они не используются; чистить функцию — отдельной миграцией,
-- вместе с удалением этих таблиц.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_student_dashboard(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  result jsonb;
BEGIN
  -- Авторизация: либо сам user, либо admin. service_role вызовы тоже валидны
  -- (auth.uid() возвращает NULL под service_role) — пускаем, потому что
  -- service_role и так может всё; но если auth.uid() ЕСТЬ и не совпадает —
  -- блокируем.
  IF v_caller IS NOT NULL
     AND v_caller <> p_user_id
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'profile', (
      SELECT to_jsonb(p) FROM (
        SELECT id, full_name, avatar_url, role, email, created_at,
               first_name, last_name
        FROM profiles WHERE id = p_user_id
      ) p
    ),
    'progress', (
      SELECT to_jsonb(up) FROM (
        SELECT total_xp, english_level, current_streak, longest_streak,
               current_level, lessons_completed, last_lesson_date, updated_at
        FROM user_progress WHERE user_id = p_user_id
      ) up
    ),
    'stats', (
      SELECT jsonb_build_object(
        'total_lessons', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'upcoming', COUNT(*) FILTER (
          WHERE status IN ('booked','confirmed','scheduled','pending_payment','in_progress')
            AND scheduled_at > now()
        ),
        'completed_30d', COUNT(*) FILTER (
          WHERE status = 'completed' AND scheduled_at >= now() - interval '30 days'
        ),
        'month_total', COUNT(*) FILTER (
          WHERE scheduled_at >= now() - interval '30 days'
        )
      )
      FROM lessons WHERE student_id = p_user_id
    ),
    'upcoming_lessons', (
      SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.scheduled_at), '[]'::jsonb)
      FROM (
        SELECT l.id,
               l.scheduled_at,
               l.duration_minutes,
               l.status,
               l.teacher_id,
               l.jitsi_room_name AS room_name,
               tp.user_id        AS teacher_user_id,
               tprof.full_name   AS teacher_name,
               tprof.avatar_url  AS teacher_avatar
        FROM lessons l
        LEFT JOIN teacher_profiles tp ON tp.id = l.teacher_id
        LEFT JOIN profiles tprof      ON tprof.id = tp.user_id
        WHERE l.student_id = p_user_id
          AND l.status IN ('booked','confirmed','scheduled','in_progress','pending_payment','completed','cancelled','missed','no_show')
          AND l.scheduled_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow'
          AND l.scheduled_at <= (date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow') + interval '14 days'
        ORDER BY l.scheduled_at ASC
        LIMIT 30
      ) l
    ),
    'achievement_defs', (
      SELECT COALESCE(jsonb_agg(to_jsonb(ad) ORDER BY ad.sort_order), '[]'::jsonb)
      FROM (
        SELECT id, slug, title, description, icon_emoji, icon_url,
               rarity, sort_order, xp_reward, category
        FROM achievement_definitions
        WHERE is_hidden = false
        ORDER BY sort_order
      ) ad
    ),
    'achievements_earned', (
      SELECT COALESCE(jsonb_agg(to_jsonb(ua)), '[]'::jsonb)
      FROM (
        SELECT achievement_id, earned_at
        FROM user_achievements
        WHERE user_id = p_user_id
        ORDER BY earned_at DESC
      ) ua
    ),
    'leaderboard_weekly', (
      SELECT COALESCE(jsonb_agg(to_jsonb(lb)), '[]'::jsonb)
      FROM (
        -- get_leaderboard SECURITY DEFINER читает auth.uid(); тут v_caller
        -- может быть NULL (service_role) — в этом случае friends_only=false
        -- всё равно работает (мы и так передаём false).
        SELECT * FROM public.get_leaderboard('weekly'::text, NULL::text, false, 5)
      ) lb
    ),
    'recent_xp_events', (
      SELECT COALESCE(jsonb_agg(to_jsonb(xe) ORDER BY xe.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, amount, source_type, source_id, description, metadata, created_at
        FROM xp_events
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 10
      ) xe
    ),
    'xp_events_week', (
      -- Для streak-календаря на дашборде: только timestamps за последние 7 дней.
      SELECT COALESCE(jsonb_agg(to_jsonb(xe) ORDER BY xe.created_at), '[]'::jsonb)
      FROM (
        SELECT created_at
        FROM xp_events
        WHERE user_id = p_user_id
          AND created_at >= now() - interval '7 days'
      ) xe
    ),
    'trial_request', (
      SELECT to_jsonb(tr) FROM (
        SELECT id, status, preferred_slot, assigned_lesson_id,
               assigned_teacher_id, created_at, updated_at
        FROM trial_lesson_requests
        WHERE user_id = p_user_id
          AND status IN ('pending','assigned','scheduled')
        ORDER BY created_at DESC
        LIMIT 1
      ) tr
    ),
    'referral', (
      SELECT jsonb_build_object(
        'invite_code', (SELECT invite_code FROM profiles WHERE id = p_user_id),
        'activated_count', (
          SELECT COUNT(*) FROM referrals
          WHERE inviter_id = p_user_id AND status = 'activated'
        ),
        'pending_count', (
          SELECT COUNT(*) FROM referrals
          WHERE inviter_id = p_user_id AND status = 'pending'
        )
      )
    ),
    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_teacher_dashboard(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  result jsonb;
  v_teacher_profile_id uuid;
  v_caller uuid := auth.uid();
  v_now timestamptz := now();
  v_today_start timestamptz := date_trunc('day', (v_now AT TIME ZONE 'Europe/Moscow')) AT TIME ZONE 'Europe/Moscow';
  v_today_end   timestamptz := v_today_start + interval '1 day';
  v_week_start  timestamptz := date_trunc('week', (v_now AT TIME ZONE 'Europe/Moscow')) AT TIME ZONE 'Europe/Moscow';
  v_week_end    timestamptz := v_week_start + interval '1 week';
  v_month_start timestamptz := date_trunc('month', (v_now AT TIME ZONE 'Europe/Moscow')) AT TIME ZONE 'Europe/Moscow';
  v_month_end   timestamptz := v_month_start + interval '1 month';
  v_prev_month_start timestamptz := v_month_start - interval '1 month';
BEGIN
  -- Guard: если caller известен (JWT user) и НЕ owner/admin — реджектим.
  -- service_role (v_caller IS NULL) проходит — доступен только серверу.
  IF v_caller IS NOT NULL AND v_caller <> p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_teacher_profile_id
  FROM teacher_profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  SELECT jsonb_build_object(
    'profile', (
      SELECT to_jsonb(p) FROM (
        SELECT
          id, full_name, first_name, last_name, avatar_url, role, email,
          created_at
        FROM profiles
        WHERE id = p_user_id
      ) p
    ),
    'teacher_profile', (
      SELECT to_jsonb(tp) FROM (
        SELECT
          id, user_id, bio, specializations, hourly_rate, trial_rate,
          video_intro_url, rating, total_reviews, experience_years,
          languages, certificates, is_verified, is_listed,
          total_lessons
        FROM teacher_profiles
        WHERE id = v_teacher_profile_id
      ) tp
    ),
    'today', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.scheduled_at)
      FROM (
        SELECT
          l.id, l.scheduled_at, l.duration_minutes, l.status,
          l.price, l.student_id,
          sp.full_name AS student_name,
          sp.avatar_url AS student_avatar,
          (tlr.assigned_lesson_id IS NOT NULL) AS is_trial
        FROM lessons l
        LEFT JOIN profiles sp ON sp.id = l.student_id
        LEFT JOIN trial_lesson_requests tlr ON tlr.assigned_lesson_id = l.id
        WHERE l.teacher_id = v_teacher_profile_id
          AND l.scheduled_at >= v_today_start
          AND l.scheduled_at <  v_today_end
          AND l.status IN ('booked','confirmed','scheduled','in_progress','pending_payment','completed')
      ) t
    ), '[]'::jsonb),
    'upcoming', COALESCE((
      SELECT jsonb_agg(row_to_json(u) ORDER BY u.scheduled_at)
      FROM (
        SELECT
          l.id, l.scheduled_at, l.duration_minutes, l.status,
          l.price, l.student_id,
          sp.full_name AS student_name,
          sp.avatar_url AS student_avatar,
          (tlr.assigned_lesson_id IS NOT NULL) AS is_trial
        FROM lessons l
        LEFT JOIN profiles sp ON sp.id = l.student_id
        LEFT JOIN trial_lesson_requests tlr ON tlr.assigned_lesson_id = l.id
        WHERE l.teacher_id = v_teacher_profile_id
          AND l.scheduled_at >= v_today_start
          AND l.scheduled_at <  v_today_start + interval '14 days'
          AND l.status IN ('booked','confirmed','scheduled','in_progress','pending_payment','completed')
        ORDER BY l.scheduled_at ASC
        LIMIT 50
      ) u
    ), '[]'::jsonb),
    'today_clubs', COALESCE((
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.starts_at)
      FROM (
        SELECT
          c.id, c.topic, c.starts_at, c.duration_min,
          c.is_published, c.cancelled_at,
          c.seats_taken, c.capacity, c.max_seats
        FROM club_hosts ch
        JOIN clubs c ON c.id = ch.club_id
        WHERE ch.host_id = p_user_id
          AND c.starts_at >= v_today_start
          AND c.starts_at <  v_today_end
          AND c.is_published = true
          AND c.cancelled_at IS NULL
      ) c
    ), '[]'::jsonb),
    'week_stats', (
      SELECT jsonb_build_object(
        'total',     COUNT(*),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status IN ('cancelled','no_show'))
      )
      FROM lessons
      WHERE teacher_id = v_teacher_profile_id
        AND scheduled_at >= v_week_start
        AND scheduled_at <  v_week_end
    ),
    'month_stats', (
      SELECT jsonb_build_object(
        'this_month_count', (
          SELECT COUNT(*) FROM lessons
          WHERE teacher_id = v_teacher_profile_id
            AND scheduled_at >= v_month_start
            AND scheduled_at <  v_month_end
        ),
        'prev_month_count', (
          SELECT COUNT(*) FROM lessons
          WHERE teacher_id = v_teacher_profile_id
            AND scheduled_at >= v_prev_month_start
            AND scheduled_at <  v_month_start
        ),
        'earnings_kopecks', COALESCE((
          SELECT SUM(COALESCE(price, 0))::bigint
          FROM lessons
          WHERE teacher_id = v_teacher_profile_id
            AND status = 'completed'
            AND scheduled_at >= v_month_start
            AND scheduled_at <  v_month_end
        ), 0)
      )
    ),
    'active_lesson', (
      SELECT row_to_json(al) FROM (
        SELECT id, scheduled_at, duration_minutes, status, student_id
        FROM lessons
        WHERE teacher_id = v_teacher_profile_id
          AND status = 'in_progress'
        ORDER BY scheduled_at DESC
        LIMIT 1
      ) al
    ),
    'club_hosts_unread', (
      SELECT COUNT(*) FROM club_hosts
      WHERE host_id = p_user_id AND seen_at IS NULL
    ),
    'pending_trial_count', (
      SELECT COUNT(*) FROM trial_lesson_requests
      WHERE assigned_teacher_id = v_teacher_profile_id
        AND status = 'assigned'
    ),
    'generated_at', v_now,
    'teacher_profile_id', v_teacher_profile_id
  ) INTO result;

  RETURN result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.lesson_recordings_next_seq(p_recording_id uuid, p_role text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seq int;
BEGIN
  IF p_role = 'T' THEN
    UPDATE public.lesson_recordings
       SET next_seq_t = next_seq_t + 1
     WHERE id = p_recording_id
       AND status = 'recording'
    RETURNING next_seq_t - 1 INTO v_seq;
  ELSIF p_role = 'S' THEN
    UPDATE public.lesson_recordings
       SET next_seq_s = next_seq_s + 1
     WHERE id = p_recording_id
       AND status = 'recording'
    RETURNING next_seq_s - 1 INTO v_seq;
  ELSE
    RAISE EXCEPTION 'invalid role %', p_role;
  END IF;
  RETURN v_seq;
END;
$function$;

-- Права как у остальных service-only RPC (миграция 20260910160000 уже отозвала
-- их у anon/authenticated для дашбордов; next_seq вызывается только сервером).
REVOKE ALL ON FUNCTION public.lesson_recordings_next_seq(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_recordings_next_seq(uuid, text) TO service_role;
