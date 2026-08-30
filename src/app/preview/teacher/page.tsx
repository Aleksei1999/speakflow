// Preview-роут: если пользователь залогинен как teacher/admin — подтягиваем
// его реальных учеников из БД (как /teacher). Иначе показываем mock
// из TeacherRawDashboard для дизайн-превью без Supabase.
// @ts-nocheck
import { createClient } from "@/lib/supabase/server"
import { getCachedTeacherStudents } from "@/lib/cache/dashboard"
import TeacherRawDashboard from "@/app/(teacher-full)/teacher/TeacherRawDashboard"

export const dynamic = "force-dynamic"

const UPCOMING_STATUSES = new Set([
  "scheduled", "confirmed", "booked", "in_progress", "pending_payment",
])

export default async function TeacherPreviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))

  if (!user) {
    // Не залогинен → чистый preview с mock.
    return <TeacherRawDashboard />
  }

  const snapshot = await getCachedTeacherStudents(user.id)
  const levelByUser = new Map<string, string>()
  for (const p of snapshot.progress) {
    if (p.english_level) levelByUser.set(p.user_id, String(p.english_level).toUpperCase())
  }

  const now = Date.now()
  const seen = new Map<string, { firstSeenTs: number; nextUpcomingTs: number | null }>()
  for (const l of snapshot.lessons) {
    if (!l.student_id) continue
    const ts = new Date(l.scheduled_at).getTime()
    const rec = seen.get(l.student_id) || { firstSeenTs: Number.MAX_SAFE_INTEGER, nextUpcomingTs: null }
    if (!Number.isNaN(ts) && ts < rec.firstSeenTs) rec.firstSeenTs = ts
    if (UPCOMING_STATUSES.has(l.status) && !Number.isNaN(ts) && ts > now
        && (rec.nextUpcomingTs === null || ts < rec.nextUpcomingTs)) {
      rec.nextUpcomingTs = ts
    }
    seen.set(l.student_id, rec)
  }

  const students = snapshot.profiles
    .map((p) => {
      const meta = seen.get(p.id) || { firstSeenTs: 0, nextUpcomingTs: null }
      return {
        id: p.id,
        name: p.full_name || "Ученик",
        level: levelByUser.get(p.id) || "A1",
        avatar: p.avatar_url,
        firstSeenTs: meta.firstSeenTs,
        nextUpcomingTs: meta.nextUpcomingTs,
      }
    })
    .sort((a, b) => a.firstSeenTs - b.firstSeenTs)
    .map((s, idx) => ({
      id: s.id,
      name: s.name,
      level: s.level,
      avatar: s.avatar,
      addedAt: idx + 1,
      nextLessonMin: s.nextUpcomingTs !== null
        ? Math.max(0, Math.round((s.nextUpcomingTs - now) / 60_000))
        : null,
    }))

  return <TeacherRawDashboard initialStudents={students} teacherId={user.id} />
}
