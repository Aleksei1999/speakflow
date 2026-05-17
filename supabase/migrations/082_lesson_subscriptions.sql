-- ============================================================
-- 082_lesson_subscriptions
-- Регулярные «закреплённые» слоты студента у конкретного преподавателя.
--
-- Зачем:
--   После успешного первого урока студент хочет «застолбить» время —
--   пн 19:00 + ср 19:00 на 4/8/12 недель. Создаём контейнер
--   (lesson_subscriptions) + материализуем lessons rolling-window
--   на 14 дней вперёд + cron досоздаёт по мере приближения ends_on.
--
-- Защита от double-booking:
--   полностью лежит на УЖЕ существующих ограничениях lessons —
--     • EXCLUDE GiST `lessons_no_overlap` (012) ловит overlap интервалов;
--     • UNIQUE `lessons_teacher_slot_unique_idx` (068) ловит точное
--       совпадение (teacher_id, scheduled_at) для статусов, занимающих
--       слот.
--   Оба эти ограничения возвращают SQLSTATE 23P01 / 23505 — RPC ловит
--   их и сообщает клиенту конфликтные occurrences. Двое студентов
--   физически не смогут «встать» в один и тот же слот к одному педагогу.
--
-- Search-path locked, SECURITY DEFINER — урок миграции 076/077:
--   привилегированный код в этом проекте больше никогда не делает
--   privilege-escalation guard через триггер. Только REVOKE + явные
--   локальные политики.
-- ============================================================

-- ============================================================
-- 1. Таблица lesson_subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lesson_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- teacher_id это PK teacher_profiles (тот же id, что в lessons.teacher_id).
  teacher_id      uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  -- weekly_pattern: jsonb array [{dow: 0..6, time: "HH:MM", duration_min: int}]
  -- dow = Postgres EXTRACT(dow): 0=Sunday .. 6=Saturday.
  weekly_pattern  jsonb NOT NULL,
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,
  price_kopecks   integer NOT NULL DEFAULT 0 CHECK (price_kopecks >= 0),
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','cancelled')),
  timezone        text NOT NULL DEFAULT 'Europe/Moscow',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lesson_subscriptions_dates_chk CHECK (ends_on >= starts_on),
  -- weekly_pattern должен быть непустым массивом — иначе подписка бессмысленна
  CONSTRAINT lesson_subscriptions_pattern_chk CHECK (
    jsonb_typeof(weekly_pattern) = 'array'
    AND jsonb_array_length(weekly_pattern) > 0
    AND jsonb_array_length(weekly_pattern) <= 14  -- защита от мусора
  )
);

COMMENT ON TABLE public.lesson_subscriptions IS
  'Регулярные слоты: контейнер для материализованных lessons. Cron extend_subscriptions досоздаёт occurrences в окне 14 дней.';

CREATE INDEX IF NOT EXISTS lesson_subscriptions_student_active_idx
  ON public.lesson_subscriptions (student_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS lesson_subscriptions_teacher_active_idx
  ON public.lesson_subscriptions (teacher_id)
  WHERE status = 'active';

-- moddatetime-style trigger для updated_at
CREATE OR REPLACE FUNCTION public.tg_lesson_subscriptions_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_lesson_subscriptions_touch() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lesson_subscriptions_touch ON public.lesson_subscriptions;
CREATE TRIGGER lesson_subscriptions_touch
  BEFORE UPDATE ON public.lesson_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_lesson_subscriptions_touch();

-- ============================================================
-- 2. lessons.subscription_id — FK на серию
-- ============================================================

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS subscription_id uuid
    REFERENCES public.lesson_subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lessons_subscription_idx
  ON public.lessons (subscription_id)
  WHERE subscription_id IS NOT NULL;

COMMENT ON COLUMN public.lessons.subscription_id IS
  'Если NOT NULL — урок сгенерирован из lesson_subscriptions. NULL — разовая бронь.';

-- ============================================================
-- 3. RLS на lesson_subscriptions
-- ============================================================

ALTER TABLE public.lesson_subscriptions ENABLE ROW LEVEL SECURITY;

-- SELECT: студент видит свои, учитель видит свои (через get_teacher_profile_id),
-- админ видит всё.
DROP POLICY IF EXISTS lesson_subscriptions_select ON public.lesson_subscriptions;
CREATE POLICY lesson_subscriptions_select ON public.lesson_subscriptions
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR teacher_id = public.get_teacher_profile_id()
    OR public.is_admin()
  );

-- INSERT: только сам себе (предохранитель; production-путь = RPC SECURITY DEFINER).
DROP POLICY IF EXISTS lesson_subscriptions_insert ON public.lesson_subscriptions;
CREATE POLICY lesson_subscriptions_insert ON public.lesson_subscriptions
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- UPDATE: студент может править свою (например pause/resume). Cancel идёт через RPC.
DROP POLICY IF EXISTS lesson_subscriptions_update ON public.lesson_subscriptions;
CREATE POLICY lesson_subscriptions_update ON public.lesson_subscriptions
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- DELETE: запрещён всем (включая владельца). Удаление = status='cancelled'.

-- Service-role bypass работает автоматически (RLS bypass у service_role).

-- ============================================================
-- 4. RPC create_lesson_subscription
-- ============================================================
--
-- Принимает паттерн, создаёт subscription + lessons-occurrences в окне
-- min(p_weeks * 7, 14) дней. Возвращает:
--   {ok: true, subscription_id, lessons_created} — все INSERT прошли
--   {ok: false, conflicts: [{at, dow, time}]} — хотя бы один конфликт
--
-- Если есть хоть один конфликт — ВСЯ транзакция откатывается (тогда
-- subscription тоже не создаётся). Это нарочно: студент должен видеть
-- честную картину, иначе получит «полудохлую» подписку с дырами.

CREATE OR REPLACE FUNCTION public.create_lesson_subscription(
  p_teacher_id uuid,
  p_pattern    jsonb,
  p_starts_on  date,
  p_weeks      int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_sub_id         uuid;
  v_ends_on        date;
  v_window_end     date;
  v_conflicts      jsonb := '[]'::jsonb;
  v_created        int := 0;
  v_pat            jsonb;
  v_dow            int;
  v_time           text;
  v_dur            int;
  v_day            date;
  v_at             timestamptz;
  v_tz             text := 'Europe/Moscow';
  v_teacher_exists boolean;
BEGIN
  -- ---- 1. validations -----------------------------------------------------
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF p_teacher_id IS NULL THEN
    RAISE EXCEPTION 'p_teacher_id required' USING ERRCODE = '22023';
  END IF;

  IF p_weeks IS NULL OR p_weeks < 1 OR p_weeks > 26 THEN
    RAISE EXCEPTION 'p_weeks must be in [1, 26]' USING ERRCODE = '22023';
  END IF;

  IF p_starts_on IS NULL OR p_starts_on < current_date THEN
    RAISE EXCEPTION 'p_starts_on must be today or later' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_pattern) <> 'array' OR jsonb_array_length(p_pattern) = 0 THEN
    RAISE EXCEPTION 'p_pattern must be a non-empty array' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = p_teacher_id)
    INTO v_teacher_exists;
  IF NOT v_teacher_exists THEN
    RAISE EXCEPTION 'teacher not found' USING ERRCODE = '23503';
  END IF;

  -- Per-entry validation паттерна
  FOR v_pat IN SELECT * FROM jsonb_array_elements(p_pattern) LOOP
    v_dow := (v_pat->>'dow')::int;
    v_time := v_pat->>'time';
    v_dur := COALESCE((v_pat->>'duration_min')::int, 50);

    IF v_dow IS NULL OR v_dow < 0 OR v_dow > 6 THEN
      RAISE EXCEPTION 'dow must be 0..6, got %', v_dow USING ERRCODE = '22023';
    END IF;
    IF v_time IS NULL OR v_time !~ '^[0-2][0-9]:[0-5][0-9]$' THEN
      RAISE EXCEPTION 'time must match HH:MM, got %', v_time USING ERRCODE = '22023';
    END IF;
    IF v_dur < 15 OR v_dur > 180 THEN
      RAISE EXCEPTION 'duration_min must be in [15, 180], got %', v_dur USING ERRCODE = '22023';
    END IF;
  END LOOP;

  v_ends_on := p_starts_on + (p_weeks * 7 - 1);
  v_window_end := LEAST(v_ends_on, (current_date + 14));

  -- ---- 2. создаём subscription -------------------------------------------
  INSERT INTO public.lesson_subscriptions (
    student_id, teacher_id, weekly_pattern,
    starts_on, ends_on, timezone, status
  )
  VALUES (v_uid, p_teacher_id, p_pattern, p_starts_on, v_ends_on, v_tz, 'active')
  RETURNING id INTO v_sub_id;

  -- ---- 3. материализуем lessons-occurrences ------------------------------
  -- День → если EXTRACT(dow) совпал с любым паттерном → INSERT lesson.
  FOR v_day IN
    SELECT d::date
    FROM generate_series(p_starts_on, v_window_end, interval '1 day') AS d
  LOOP
    FOR v_pat IN SELECT * FROM jsonb_array_elements(p_pattern) LOOP
      v_dow := (v_pat->>'dow')::int;
      v_time := v_pat->>'time';
      v_dur := COALESCE((v_pat->>'duration_min')::int, 50);

      CONTINUE WHEN EXTRACT(dow FROM v_day)::int <> v_dow;

      -- "Локальное" время в timezone подписки → UTC timestamptz
      v_at := ((v_day::text || ' ' || v_time)::timestamp AT TIME ZONE v_tz);

      -- Не создаём уроки в прошлом (если starts_on = today, ранние часы могли уйти).
      CONTINUE WHEN v_at <= now();

      BEGIN
        INSERT INTO public.lessons (
          student_id, teacher_id, scheduled_at, duration_minutes,
          status, price, subscription_id
        )
        VALUES (
          v_uid, p_teacher_id, v_at, v_dur,
          'booked', 0, v_sub_id
        );
        v_created := v_created + 1;
      EXCEPTION
        WHEN unique_violation OR exclusion_violation THEN
          v_conflicts := v_conflicts || jsonb_build_object(
            'at', v_at,
            'dow', v_dow,
            'time', v_time
          );
      END;
    END LOOP;
  END LOOP;

  -- Если хоть один конфликт — откатываем всё.
  IF jsonb_array_length(v_conflicts) > 0 THEN
    RAISE EXCEPTION 'subscription_slot_conflict'
      USING ERRCODE = '23P01',  -- exclusion_violation, чтобы клиент сразу знал тип
            DETAIL = v_conflicts::text;
  END IF;

  -- ---- 4. audit ----------------------------------------------------------
  INSERT INTO audit.audit_log (
    actor_user_id, actor_role, category, action,
    target_type, target_id, payload
  )
  VALUES (
    v_uid,
    (SELECT role FROM public.profiles WHERE id = v_uid),
    'data', 'lesson_subscription_created',
    'lesson_subscriptions', v_sub_id::text,
    jsonb_build_object(
      'teacher_id', p_teacher_id,
      'weeks', p_weeks,
      'pattern', p_pattern,
      'starts_on', p_starts_on,
      'ends_on', v_ends_on,
      'lessons_created', v_created
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_sub_id,
    'lessons_created', v_created
  );
EXCEPTION
  WHEN SQLSTATE '23P01' THEN
    -- Specific case: наш собственный raise со списком конфликтов
    IF SQLERRM = 'subscription_slot_conflict' THEN
      RETURN jsonb_build_object('ok', false, 'conflicts', v_conflicts);
    END IF;
    -- Чужой 23P01 (вряд ли — но прозрачно пробрасываем)
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lesson_subscription(uuid, jsonb, date, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lesson_subscription(uuid, jsonb, date, int)
  TO authenticated;

COMMENT ON FUNCTION public.create_lesson_subscription(uuid, jsonb, date, int) IS
  'Creates lesson subscription + materializes lessons in 14-day rolling window. Returns {ok, subscription_id, lessons_created} or {ok:false, conflicts:[]}.';

-- ============================================================
-- 5. RPC cancel_lesson_subscription
-- ============================================================
--
-- p_from = NULL → отменяем ВСЁ: status='cancelled', все будущие lessons → cancelled
-- p_from = date → ends_on = p_from - 1, lessons с scheduled_at >= p_from → cancelled
--
-- Никаких прав-checks внутри (помимо ownership) — student только свою,
-- teacher только свою (отказ преподавателя), admin — любую.

CREATE OR REPLACE FUNCTION public.cancel_lesson_subscription(
  p_sub_id uuid,
  p_from   date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_sub            public.lesson_subscriptions%ROWTYPE;
  v_cutoff_ts      timestamptz;
  v_lessons_cancel int;
  v_actor_kind     text;
  v_reason         text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_sub FROM public.lesson_subscriptions WHERE id = p_sub_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription not found' USING ERRCODE = '02000';
  END IF;

  IF v_sub.student_id = v_uid THEN
    v_actor_kind := 'student';
  ELSIF v_sub.teacher_id = public.get_teacher_profile_id() THEN
    v_actor_kind := 'teacher';
  ELSIF public.is_admin() THEN
    v_actor_kind := 'admin';
  ELSE
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_reason := format('Subscription cancelled by %s', v_actor_kind);

  IF p_from IS NULL THEN
    -- Полная отмена: режем будущие уроки от сейчас.
    v_cutoff_ts := now();

    UPDATE public.lesson_subscriptions
      SET status = 'cancelled', updated_at = now()
    WHERE id = p_sub_id;
  ELSE
    -- Частичная отмена: новый ends_on, режем будущие от p_from.
    v_cutoff_ts := (p_from::text || ' 00:00')::timestamp AT TIME ZONE v_sub.timezone;

    UPDATE public.lesson_subscriptions
      SET ends_on = p_from - 1,
          updated_at = now(),
          status = CASE WHEN (p_from - 1) < starts_on THEN 'cancelled' ELSE status END
    WHERE id = p_sub_id;
  END IF;

  WITH upd AS (
    UPDATE public.lessons
      SET status = 'cancelled',
          cancelled_by = v_uid,
          cancellation_reason = v_reason,
          updated_at = now()
    WHERE subscription_id = p_sub_id
      AND scheduled_at >= v_cutoff_ts
      AND status NOT IN ('completed', 'cancelled', 'no_show', 'in_progress')
    RETURNING 1
  )
  SELECT count(*) INTO v_lessons_cancel FROM upd;

  INSERT INTO audit.audit_log (
    actor_user_id, actor_role, category, action,
    target_type, target_id, payload
  )
  VALUES (
    v_uid,
    (SELECT role FROM public.profiles WHERE id = v_uid),
    'data', 'lesson_subscription_cancelled',
    'lesson_subscriptions', p_sub_id::text,
    jsonb_build_object(
      'actor_kind', v_actor_kind,
      'p_from', p_from,
      'cutoff_ts', v_cutoff_ts,
      'lessons_cancelled', v_lessons_cancel
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', p_sub_id,
    'lessons_cancelled', v_lessons_cancel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_lesson_subscription(uuid, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_lesson_subscription(uuid, date)
  TO authenticated;

COMMENT ON FUNCTION public.cancel_lesson_subscription(uuid, date) IS
  'Cancels subscription fully (p_from NULL) or partially (from date). Cancels future lessons. Student/teacher/admin only.';

-- ============================================================
-- 6. RPC extend_lesson_subscriptions  (cron-only)
-- ============================================================
--
-- Каждый день: для каждой active subscription, у которой материализованные
-- lessons не дотягиваются до min(ends_on, now+14d), генерим недостающие.
-- Конфликты SKIP-аем (log в audit), а не откатываем — иначе один
-- проблемный слот заблокирует продление всей подписки.

CREATE OR REPLACE FUNCTION public.extend_lesson_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sub          public.lesson_subscriptions%ROWTYPE;
  v_max_at       timestamptz;
  v_window_end   date;
  v_start_day    date;
  v_day          date;
  v_pat          jsonb;
  v_dow          int;
  v_time         text;
  v_dur          int;
  v_at           timestamptz;
  v_created      int;
  v_skipped      int;
  v_total_created int := 0;
  v_total_skipped int := 0;
  v_subs_touched  int := 0;
BEGIN
  FOR v_sub IN
    SELECT * FROM public.lesson_subscriptions
    WHERE status = 'active'
      AND ends_on >= current_date
  LOOP
    SELECT max(scheduled_at) INTO v_max_at
      FROM public.lessons
     WHERE subscription_id = v_sub.id
       AND status NOT IN ('cancelled');

    v_window_end := LEAST(v_sub.ends_on, current_date + 14);

    -- Стартуем с дня ПОСЛЕ последнего материализованного.
    -- Если ни одного ещё нет (странно, но возможно при manual reset) — с current_date.
    IF v_max_at IS NULL THEN
      v_start_day := GREATEST(v_sub.starts_on, current_date);
    ELSE
      v_start_day := (v_max_at AT TIME ZONE v_sub.timezone)::date + 1;
    END IF;

    -- Нечего делать, если окно уже покрыто.
    CONTINUE WHEN v_start_day > v_window_end;

    v_created := 0;
    v_skipped := 0;

    FOR v_day IN
      SELECT d::date FROM generate_series(v_start_day, v_window_end, interval '1 day') AS d
    LOOP
      FOR v_pat IN SELECT * FROM jsonb_array_elements(v_sub.weekly_pattern) LOOP
        v_dow  := (v_pat->>'dow')::int;
        v_time := v_pat->>'time';
        v_dur  := COALESCE((v_pat->>'duration_min')::int, 50);

        CONTINUE WHEN EXTRACT(dow FROM v_day)::int <> v_dow;

        v_at := ((v_day::text || ' ' || v_time)::timestamp AT TIME ZONE v_sub.timezone);
        CONTINUE WHEN v_at <= now();

        BEGIN
          INSERT INTO public.lessons (
            student_id, teacher_id, scheduled_at, duration_minutes,
            status, price, subscription_id
          )
          VALUES (
            v_sub.student_id, v_sub.teacher_id, v_at, v_dur,
            'booked', 0, v_sub.id
          );
          v_created := v_created + 1;
        EXCEPTION
          WHEN unique_violation OR exclusion_violation THEN
            v_skipped := v_skipped + 1;
            INSERT INTO audit.audit_log (
              actor_user_id, category, action,
              target_type, target_id, payload
            )
            VALUES (
              NULL, 'data', 'lesson_subscription_slot_skipped',
              'lesson_subscriptions', v_sub.id::text,
              jsonb_build_object(
                'at', v_at,
                'dow', v_dow,
                'time', v_time,
                'reason', SQLSTATE
              )
            );
        END;
      END LOOP;
    END LOOP;

    IF v_created > 0 OR v_skipped > 0 THEN
      v_subs_touched := v_subs_touched + 1;
      v_total_created := v_total_created + v_created;
      v_total_skipped := v_total_skipped + v_skipped;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'subs_touched', v_subs_touched,
    'lessons_created', v_total_created,
    'lessons_skipped', v_total_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.extend_lesson_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_lesson_subscriptions() TO postgres, service_role;

COMMENT ON FUNCTION public.extend_lesson_subscriptions() IS
  'Cron-only. Extends rolling 14-day window for each active subscription. Conflicts are skipped + audited.';

-- ============================================================
-- 7. pg_cron: ежедневно 23:00 UTC = 02:00 МСК
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lesson_subscriptions_extend') THEN
      PERFORM cron.unschedule('lesson_subscriptions_extend');
    END IF;

    PERFORM cron.schedule(
      'lesson_subscriptions_extend',
      '0 23 * * *',
      $cron$ SELECT public.extend_lesson_subscriptions(); $cron$
    );
  END IF;
END
$$;

-- ============================================================
-- 8. Подключаем audit trigger на новую таблицу (data category)
-- ============================================================

DROP TRIGGER IF EXISTS audit_lesson_subscriptions_change ON public.lesson_subscriptions;
CREATE TRIGGER audit_lesson_subscriptions_change
  AFTER INSERT OR UPDATE OR DELETE ON public.lesson_subscriptions
  FOR EACH ROW EXECUTE FUNCTION audit.trg_data_change();
