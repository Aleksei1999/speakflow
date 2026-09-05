// -----------------------------------------------------------------------------
// Loader: список учеников текущего учителя для дашборда /teacher.
//
// Отношение teacher ↔ student в проекте определяется через таблицу lessons:
//   lessons.teacher_id → teacher_profiles.id
//   lessons.student_id → profiles.id
//
// Учителю "принадлежат" все ученики, с которыми есть хотя бы один урок
// (в любом статусе). Собираем distinct student_id, затем догружаем profiles
// + user_progress (для CEFR-уровня) + ближайший upcoming lesson (для «до
// следующего занятия»).
// -----------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js"
import { fromRoastLevel } from "@/lib/levels/mapping"

export interface TeacherStudentRow {
  id: string           // profiles.id (auth.uid студента) — используется для чата
  name: string
  level: string        // CEFR: A1/A2/B1/B2/C1/C2
  avatar: string | null
  /** Индекс порядка добавления (1..N). Позволяет UI сортировать «по времени добавления». */
  addedAt: number
  /** Минут до ближайшего upcoming-урока. null если нет запланированных. */
  nextLessonMin: number | null
}

const UPCOMING_STATUSES = new Set([
  "scheduled",
  "confirmed",
  "booked",
  "in_progress",
  "pending_payment",
])

export async function loadTeacherStudents(
  supabase: SupabaseClient,
  teacherProfileId: string
): Promise<TeacherStudentRow[]> {
  // 1. Distinct student_id + первое scheduled_at (для order by seniority).
  //    Тянем «сырьё»: все lessons учителя за всё время. Дедуп в JS —
  //    supabase-js не умеет DISTINCT ON.
  const { data: lessons, error: lessonsErr } = await (supabase as any)
    .from("lessons")
    .select("student_id, scheduled_at, status")
    .eq("teacher_id", teacherProfileId)
    .order("scheduled_at", { ascending: true })
    .limit(1000)

  if (lessonsErr) {
    console.warn("[teacher/students] lessons query failed:", lessonsErr.message)
    return []
  }

  type Row = { student_id: string; scheduled_at: string; status: string }
  const rows: Row[] = (lessons || []) as Row[]
  if (rows.length === 0) return []

  // Сгруппируем по student_id: firstSeen (для «когда появился») + nextUpcoming.
  const now = Date.now()
  const byStudent = new Map<
    string,
    { firstSeenTs: number; nextUpcomingTs: number | null }
  >()
  for (const r of rows) {
    if (!r.student_id) continue
    const ts = new Date(r.scheduled_at).getTime()
    const rec = byStudent.get(r.student_id) || {
      firstSeenTs: Number.MAX_SAFE_INTEGER,
      nextUpcomingTs: null,
    }
    if (!Number.isNaN(ts) && ts < rec.firstSeenTs) rec.firstSeenTs = ts
    if (
      UPCOMING_STATUSES.has(r.status) &&
      !Number.isNaN(ts) &&
      ts > now &&
      (rec.nextUpcomingTs === null || ts < rec.nextUpcomingTs)
    ) {
      rec.nextUpcomingTs = ts
    }
    byStudent.set(r.student_id, rec)
  }

  const studentIds = Array.from(byStudent.keys())

  // 2. Profiles + level в параллели.
  const [profilesRes, progressRes] = await Promise.all([
    (supabase as any)
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .in("id", studentIds)
      .eq("role", "student"),
    (supabase as any)
      .from("user_progress")
      .select("user_id, english_level")
      .in("user_id", studentIds),
  ])

  if (profilesRes.error) {
    console.warn("[teacher/students] profiles query failed:", profilesRes.error.message)
    return []
  }

  const levelByUser = new Map<string, string>()
  for (const row of (progressRes.data || []) as any[]) {
    if (row.english_level) {
      // В БД после миграции 011 хранится roast-нотация ("Medium Rare");
      // UI ожидает CEFR-код (A1..C2). Конвертим.
      levelByUser.set(row.user_id, fromRoastLevel(String(row.english_level)))
    }
  }

  const profiles = ((profilesRes.data || []) as any[]).map((p) => {
    const meta = byStudent.get(p.id)!
    return { profile: p, ...meta }
  })

  // 3. Стабильная сортировка по firstSeenTs asc → индексу добавления.
  profiles.sort((a, b) => a.firstSeenTs - b.firstSeenTs)

  return profiles.map((entry, idx) => {
    const p = entry.profile
    const nextLessonMin =
      entry.nextUpcomingTs !== null
        ? Math.max(0, Math.round((entry.nextUpcomingTs - now) / 60_000))
        : null
    return {
      id: p.id,
      name: p.full_name || "Ученик",
      level: levelByUser.get(p.id) || "A1",
      avatar: p.avatar_url,
      addedAt: idx + 1,
      nextLessonMin,
    }
  })
}
