// ---------------------------------------------------------------
// Shared loader for the "teacher views student profile" page.
//
// Used by:
//   • src/app/api/teacher/students/[id]/route.ts (JSON endpoint)
//   • src/app/(dashboard)/teacher/students/[id]/page.tsx (SSR)
//
// Why one module:
//   Self-fetch from a Server Component back into our own API route
//   doubles cookie parsing + auth.getUser() (см. недавний perf-аудит,
//   feedback в TeacherStudentsPage.loadInitialSnapshot). Сюда логику
//   вынесли, route.ts становится тонким wrapper'ом.
//
// Access policy:
//   - Admin: всегда видит студента.
//   - Teacher: ТОЛЬКО если есть хоть один lesson (any status), где
//     teacher_id = его teacher_profiles.id и student_id = $1.
//   - Если нет доступа / профиль удалён / роль ≠ student → возвращаем
//     null; вызывающий код отвечает 404 (не 403 — чтобы не палить
//     existence).
//
// Returned shape — см. StudentProfilePayload ниже.
// ---------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js"
import { LEVEL_XP_THRESHOLDS, xpToRoastLevel } from "@/lib/level-utils"
import { getLevelCEFR } from "@/lib/level-utils"

export type ViewerRole = "teacher" | "admin"

export type StudentProfilePayload = {
  student: {
    id: string
    full_name: string
    avatar_url: string | null
    email: string | null // admin-only; для teacher всегда null
    created_at: string | null
    cefr: string | null
    streak: number
    total_xp: number
    /** Текущий roast-level от total_xp (не usable-в-DB current_level из user_progress). */
    level: string
    /** 0..100, % внутри текущего уровня по XP. 100 для Well Done. */
    level_progress_pct: number
  }
  stats: {
    total_lessons: number
    completed: number
    cancelled: number
    no_show: number
    upcoming_count: number
    /** Среднее по reviews.rating от этого студента этому преподу. null, если нет отзывов. */
    average_rating: number | null
    /** Нет уроков за 14 дней ИЛИ current_streak = 0. */
    needs_attention: boolean
  }
  upcoming: Array<{
    id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    room_name: string | null
  }>
  recent: Array<{
    id: string
    scheduled_at: string
    status: string
    duration_minutes: number
  }>
  materials: Array<{
    id: string
    title: string
    type: string | null
    shared_at: string
    last_used_at: string | null
  }>
  homework: Array<{
    id: string
    title: string
    due_at: string
    status: string
    submitted_at: string | null
    grade: number | null
  }>
  achievements: Array<{
    slug: string
    title: string
    earned_at: string
    icon_url: string | null
  }>
}

export type AccessDeniedReason = "not_found" | "no_shared_lessons" | "deleted"

export type LoadResult =
  | { ok: true; data: StudentProfilePayload }
  | { ok: false; reason: AccessDeniedReason }

const UPCOMING_STATUSES = new Set([
  "scheduled",
  "confirmed",
  "booked",
  "in_progress",
  "pending_payment",
])

/**
 * Главный loader. Все Supabase-вызовы идут через переданный client'а —
 * server-side anon client (RLS) для teacher и/или admin client от API
 * route'а.
 *
 * @param supabase            anon-server client (auth уже верифицирован caller'ом)
 * @param viewerRole          teacher | admin (определяет какие поля светим: email)
 * @param viewerTeacherProfileId  teacher_profiles.id залогиненного teacher'а —
 *                            обязателен если viewerRole='teacher', иначе игнор.
 * @param studentId           profiles.id студента
 */
export async function loadTeacherStudentProfile(
  supabase: SupabaseClient,
  viewerRole: ViewerRole,
  viewerTeacherProfileId: string | null,
  studentId: string
): Promise<LoadResult> {
  // ------- Access check -------
  // Teacher имеет доступ только если есть общий lesson. Admin — всегда.
  if (viewerRole === "teacher") {
    if (!viewerTeacherProfileId) {
      return { ok: false, reason: "not_found" }
    }
    const { data: gateRow, error: gateErr } = await (supabase as any)
      .from("lessons")
      .select("id")
      .eq("teacher_id", viewerTeacherProfileId)
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle()
    if (gateErr) {
      // На любую DB-ошибку — стек 404, чтобы не палить detail'ы.
      console.warn(
        "[teacher/student-profile] gate query failed:",
        gateErr.message
      )
      return { ok: false, reason: "not_found" }
    }
    if (!gateRow) {
      return { ok: false, reason: "no_shared_lessons" }
    }
  }

  // ------- Student profile -------
  const { data: profile, error: profileErr } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, avatar_url, email, role, created_at")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle()

  if (profileErr || !profile) {
    return { ok: false, reason: "deleted" }
  }

  // ------- Per-student aggregates: lessons, progress, achievements,
  // homework, material shares, reviews — параллельно. -------
  const [
    lessonsRes,
    progressRes,
    achievementsRes,
    homeworkRes,
    materialSharesRes,
    reviewsRes,
  ] = await Promise.all([
    (supabase as any)
      .from("lessons")
      .select(
        "id, scheduled_at, status, duration_minutes, jitsi_room_name, teacher_id"
      )
      // если teacher — только свои; если admin — все уроки студента
      .eq("student_id", studentId)
      .order("scheduled_at", { ascending: false })
      .limit(200),
    (supabase as any)
      .from("user_progress")
      .select("total_xp, current_streak, english_level")
      .eq("user_id", studentId)
      .maybeSingle(),
    (supabase as any)
      .from("user_achievements")
      .select(
        "earned_at, achievement:achievement_definitions ( slug, title, icon_url )"
      )
      .eq("user_id", studentId)
      .order("earned_at", { ascending: false })
      .limit(60),
    // homework — только этого преподавателя для teacher; для admin'а так же
    // ограничим viewerTeacherProfileId если задан, иначе показываем всё.
    viewerRole === "teacher" && viewerTeacherProfileId
      ? (supabase as any)
          .from("homework")
          .select(
            "id, title, due_date, status, submitted_at, grade, score_10"
          )
          .eq("student_id", studentId)
          .eq("teacher_id", viewerTeacherProfileId)
          .order("due_date", { ascending: false })
          .limit(20)
      : (supabase as any)
          .from("homework")
          .select(
            "id, title, due_date, status, submitted_at, grade, score_10"
          )
          .eq("student_id", studentId)
          .order("due_date", { ascending: false })
          .limit(20),
    // material_shares: только direct shares на этого student'а (target_type='student').
    // Group/homework-shares опускаем для простоты — это про более общую раздачу,
    // а нам нужен список "что я расшарил конкретно ему".
    (supabase as any)
      .from("material_shares")
      .select(
        "created_at, material:materials ( id, title, file_type, mime_type, teacher_id, created_at )"
      )
      .eq("target_type", "student")
      .eq("target_id", studentId)
      .order("created_at", { ascending: false })
      .limit(50),
    // reviews от этого студента — фильтруем по teacher_id если teacher,
    // для admin'а берём всё (среднее по всем преподам).
    viewerRole === "teacher" && viewerTeacherProfileId
      ? (supabase as any)
          .from("reviews")
          .select("rating")
          .eq("student_id", studentId)
          .eq("teacher_id", viewerTeacherProfileId)
      : (supabase as any).from("reviews").select("rating").eq("student_id", studentId),
  ])

  if (lessonsRes.error) {
    console.warn(
      "[teacher/student-profile] lessons query failed:",
      lessonsRes.error.message
    )
  }

  type LessonRow = {
    id: string
    scheduled_at: string
    status: string
    duration_minutes: number
    jitsi_room_name: string | null
    teacher_id: string
  }
  const allLessons: LessonRow[] = (lessonsRes.data || []) as LessonRow[]

  // Teacher видит только свои уроки в upcoming/recent; admin — все.
  const scopedLessons =
    viewerRole === "teacher" && viewerTeacherProfileId
      ? allLessons.filter((l) => l.teacher_id === viewerTeacherProfileId)
      : allLessons

  // ------- Stats -------
  const now = Date.now()
  let total = 0
  let completed = 0
  let cancelled = 0
  let no_show = 0
  let upcoming_count = 0
  let lastNonCancelledTs = 0

  for (const l of scopedLessons) {
    total += 1
    if (l.status === "completed") completed += 1
    else if (l.status === "cancelled") cancelled += 1
    else if (l.status === "no_show") no_show += 1
    const ts = new Date(l.scheduled_at).getTime()
    if (
      !Number.isNaN(ts) &&
      l.status !== "cancelled" &&
      ts > lastNonCancelledTs
    ) {
      lastNonCancelledTs = ts
    }
    if (UPCOMING_STATUSES.has(l.status) && !Number.isNaN(ts) && ts > now) {
      upcoming_count += 1
    }
  }

  const upcoming = scopedLessons
    .filter((l) => {
      const ts = new Date(l.scheduled_at).getTime()
      return UPCOMING_STATUSES.has(l.status) && !Number.isNaN(ts) && ts > now
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() -
        new Date(b.scheduled_at).getTime()
    )
    .slice(0, 10)
    .map((l) => ({
      id: l.id,
      scheduled_at: l.scheduled_at,
      duration_minutes: l.duration_minutes,
      status: l.status,
      room_name: l.jitsi_room_name,
    }))

  const recent = scopedLessons
    .filter((l) => {
      const ts = new Date(l.scheduled_at).getTime()
      return Number.isNaN(ts) || ts <= now
    })
    .slice(0, 20)
    .map((l) => ({
      id: l.id,
      scheduled_at: l.scheduled_at,
      status: l.status,
      duration_minutes: l.duration_minutes,
    }))

  // ------- Progress / level -------
  const up: { total_xp?: number; current_streak?: number; english_level?: string | null } =
    (progressRes.data as any) || {}
  const total_xp = up.total_xp || 0
  const streak = up.current_streak || 0
  const roastLevel = xpToRoastLevel(total_xp)
  const thresholds = LEVEL_XP_THRESHOLDS[roastLevel]
  let level_progress_pct = 100
  if (thresholds.next !== null) {
    const span = thresholds.next - thresholds.min
    const within = total_xp - thresholds.min
    level_progress_pct =
      span > 0 ? Math.max(0, Math.min(100, Math.round((within / span) * 100))) : 0
  }

  // CEFR: предпочитаем english_level из user_progress если есть, иначе
  // выводим из roast-level.
  const cefr = (up.english_level && String(up.english_level).trim()) || getLevelCEFR(roastLevel)

  // ------- Rating -------
  const reviewRows: Array<{ rating: number | null }> = (reviewsRes.data || []) as any
  const ratingsArr = reviewRows
    .map((r) => (typeof r.rating === "number" ? r.rating : null))
    .filter((v): v is number => v !== null && Number.isFinite(v))
  const average_rating =
    ratingsArr.length > 0
      ? Number(
          (ratingsArr.reduce((s, v) => s + v, 0) / ratingsArr.length).toFixed(2)
        )
      : null

  // ------- needs_attention -------
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000
  const noLessonsRecent =
    lastNonCancelledTs === 0 || lastNonCancelledTs < fourteenDaysAgo
  const needs_attention = streak === 0 || noLessonsRecent

  // ------- Materials -------
  type ShareRow = {
    created_at: string
    material:
      | {
          id: string
          title: string
          file_type: string | null
          mime_type: string | null
          teacher_id: string
          created_at: string
        }
      | Array<{
          id: string
          title: string
          file_type: string | null
          mime_type: string | null
          teacher_id: string
          created_at: string
        }>
      | null
  }
  const shareRows: ShareRow[] = (materialSharesRes.data || []) as any
  const materials = shareRows
    .map((s) => {
      const m = Array.isArray(s.material) ? s.material[0] : s.material
      if (!m) return null
      // teacher: только свои материалы. RLS должно отсекать чужие, но дублируем
      // на уровне приложения (defense-in-depth).
      if (
        viewerRole === "teacher" &&
        viewerTeacherProfileId &&
        m.teacher_id !== viewerTeacherProfileId
      ) {
        return null
      }
      return {
        id: m.id,
        title: m.title,
        type: m.file_type || m.mime_type || null,
        shared_at: s.created_at,
        last_used_at: null as string | null, // в схеме нет — оставляем null
      }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .slice(0, 30)

  // ------- Homework -------
  type HwRow = {
    id: string
    title: string
    due_date: string
    status: string
    submitted_at: string | null
    grade: number | null
    score_10: number | null
  }
  const hwRows: HwRow[] = (homeworkRes.data || []) as HwRow[]
  const homework = hwRows.map((h) => ({
    id: h.id,
    title: h.title,
    due_at: h.due_date,
    status: h.status,
    submitted_at: h.submitted_at,
    // grade — int 0..100; score_10 — numeric 0..10 (мигр 029). UI хочет один —
    // приоритет: score_10 (10 = новая шкала). Fallback на grade.
    grade:
      typeof h.score_10 === "number"
        ? h.score_10
        : typeof h.grade === "number"
          ? h.grade
          : null,
  }))

  // ------- Achievements (earned only) -------
  type AchRow = {
    earned_at: string
    achievement:
      | { slug: string; title: string; icon_url: string | null }
      | Array<{ slug: string; title: string; icon_url: string | null }>
      | null
  }
  const achRows: AchRow[] = (achievementsRes.data || []) as any
  const achievements = achRows
    .map((a) => {
      const def = Array.isArray(a.achievement) ? a.achievement[0] : a.achievement
      if (!def) return null
      return {
        slug: def.slug,
        title: def.title,
        earned_at: a.earned_at,
        icon_url: def.icon_url,
      }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)

  return {
    ok: true,
    data: {
      student: {
        id: profile.id,
        full_name: profile.full_name || "Ученик",
        avatar_url: profile.avatar_url,
        email: viewerRole === "admin" ? profile.email : null,
        created_at: profile.created_at,
        cefr,
        streak,
        total_xp,
        level: roastLevel,
        level_progress_pct,
      },
      stats: {
        total_lessons: total,
        completed,
        cancelled,
        no_show,
        upcoming_count,
        average_rating,
        needs_attention,
      },
      upcoming,
      recent,
      materials,
      homework,
      achievements,
    },
  }
}
