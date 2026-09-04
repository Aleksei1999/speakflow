// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { getCachedTeacherStudents } from "@/lib/cache/dashboard"
import { getCachedTeacherDashboard } from "@/lib/dashboard/teacher"
import { createAdminClient } from "@/lib/supabase/admin"
import TeacherRawDashboard from "./TeacherRawDashboard"
import { fetchTeacherRates } from "@/lib/settings/rates"
import { fetchTeacherSchedule, getCalendarConnection } from "./calendar-actions"
import { fetchLessonRequests } from "./request-actions"
import { fetchTrialApplications } from "./trial-request-fetch"
import { fetchChatList } from "@/lib/chat/list"

export const dynamic = "force-dynamic"

const UPCOMING_STATUSES = new Set([
  "scheduled",
  "confirmed",
  "booked",
  "in_progress",
  "pending_payment",
])

export default async function TeacherNewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role !== "teacher" && role !== "admin") {
    if (role === "student") redirect("/student")
    redirect("/login")
  }

  // Используем кешированный loader из /lib/cache/dashboard.ts —
  // тот же источник, что применяется в существующих teacher-страницах.
  const snapshot = await getCachedTeacherStudents(user.id)
  const levelByUser = new Map<string, string>()
  // DB хранит роаст-уровни (Raw..Well Done) — маппим обратно на CEFR.
  const { fromRoastLevel } = await import("@/lib/levels/mapping")
  for (const p of snapshot.progress) {
    if (p.english_level) levelByUser.set(p.user_id, fromRoastLevel(p.english_level))
  }

  // firstSeen + nextUpcoming по lessons
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

  // Google Calendar + lessons + lesson_requests + dashboard snapshot — fail-soft:
  // если что-то упадёт, дашборд всё равно должен отрендериться.
  let initialSchedule: Awaited<ReturnType<typeof fetchTeacherSchedule>> = []
  let calendarConnection: Awaited<ReturnType<typeof getCalendarConnection>> = {
    connected: false,
    googleEmail: null,
    syncedAt: null,
  }
  let initialRequests: Awaited<ReturnType<typeof fetchLessonRequests>> = []
  let dashSnap: Awaited<ReturnType<typeof getCachedTeacherDashboard>> = null
  let initialChats: Awaited<ReturnType<typeof fetchChatList>> = []
  let initialApplications: Awaited<ReturnType<typeof fetchTrialApplications>> = []
  try {
    ;[initialSchedule, calendarConnection, initialRequests, dashSnap, initialChats, initialApplications] = await Promise.all([
      fetchTeacherSchedule(),
      getCalendarConnection(),
      fetchLessonRequests(),
      getCachedTeacherDashboard(user.id),
      fetchChatList({ includeTeacherGroups: true }),
      fetchTrialApplications(),
    ])
  } catch (e) {
    console.error("[teacher] dashboard prefetch failed", e)
  }

  // YTD-заработок: sum(price) по completed lessons с 1 января по сейчас.
  // Отдельным запросом (в RPC пока только month_stats). Копейки → рубли.
  let ytdEarningsKopecks = 0
  const teacherPkForYtd = dashSnap?.teacher_profile_id
  if (teacherPkForYtd) {
    try {
      const admin = createAdminClient() as any
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
      const { data: ytdRows } = await admin
        .from("lessons")
        .select("price")
        .eq("teacher_id", teacherPkForYtd)
        .eq("status", "completed")
        .gte("scheduled_at", yearStart)
      for (const r of (ytdRows ?? []) as Array<{ price: number | null }>) {
        if (typeof r.price === "number") ytdEarningsKopecks += r.price
      }
    } catch (e) {
      console.error("[teacher] YTD earnings query failed", e)
    }
  }

  const incomeStats = {
    lessonsThisMonth: dashSnap?.month_stats.this_month_count ?? 0,
    earningsThisMonthKopecks: dashSnap?.month_stats.earnings_kopecks ?? 0,
    earningsYtdKopecks: ytdEarningsKopecks,
    monthLabel: new Date().toLocaleDateString("ru", { month: "long" }),
  }

  // Глобальные тарифы для плашки «как считается доход» (админ настраивает).
  const teacherRates = await fetchTeacherRates().catch(() => ({
    rate60Kopecks: 0, rate90Kopecks: 0, rateGroupKopecks: 0,
  }))

  return (
    <TeacherRawDashboard
      initialStudents={students}
      teacherId={user.id}
      initialSchedule={initialSchedule}
      calendarConnection={calendarConnection}
      initialRequests={initialRequests}
      incomeStats={incomeStats}
      initialChats={initialChats}
      initialApplications={initialApplications}
      teacherRates={teacherRates}
    />
  )
}
