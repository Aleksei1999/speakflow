// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { createAdminClient } from "@/lib/supabase/admin"
import AdminRawDashboard from "./AdminRawDashboard"

export const dynamic = "force-dynamic"

/**
 * Admin dashboard — pixel-perfect Figma (node 2208:1206).
 * Загружаем минимальный набор реальных данных из БД (списки учеников, учителей,
 * входящих заявок, чатов и ближайших уроков). Всё остальное — placeholder-моки
 * в клиентском компоненте, строго под макет.
 *
 * Fail-soft: любые ошибки БД → падаем на моки (дизайн-превью всё равно работает).
 */
export default async function AdminDashboardFullPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role !== "admin") {
    if (role === "student") redirect("/student")
    if (role === "teacher") redirect("/teacher")
    redirect("/login")
  }

  let teachers: Array<{ id: string; name: string; avatar: string | null }> = []
  let students: Array<{
    id: string
    name: string
    level: string
    avatar: string | null
  }> = []
  let applications: Array<{
    id: string
    name: string
    level: string
    test: boolean
  }> = []
  let upcomingLessons: Array<{
    id: string
    scheduledAt: string
    title: string
  }> = []

  try {
    const admin = createAdminClient() as any

    // Teachers list — profiles.role = 'teacher'.
    const { data: tRows } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("role", "teacher")
      .limit(12)
    teachers = (tRows ?? []).map((r: any) => ({
      id: r.id,
      name: r.full_name || "Учитель",
      avatar: r.avatar_url ?? null,
    }))

    // Students list — profiles.role = 'student' + user_progress.english_level.
    const { data: sRows } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("role", "student")
      .limit(50)
    const ids = (sRows ?? []).map((r: any) => r.id)
    let levelById = new Map<string, string>()
    if (ids.length > 0) {
      const { data: prog } = await admin
        .from("user_progress")
        .select("user_id, english_level")
        .in("user_id", ids)
      for (const p of (prog ?? []) as Array<{
        user_id: string
        english_level: string | null
      }>) {
        if (p.english_level)
          levelById.set(p.user_id, String(p.english_level).toUpperCase())
      }
    }
    students = (sRows ?? []).map((r: any) => ({
      id: r.id,
      name: r.full_name || "Ученик",
      level: levelById.get(r.id) || "A1",
      avatar: r.avatar_url ?? null,
    }))

    // Trial-request applications (используем ту же табличку, что и admin-панель).
    // Тест пока не отслеживаем — ставим test:false; поле оставим для будущего.
    const { data: trials } = await admin
      .from("trial_requests")
      .select("id, first_name, last_name, level, status, created_at")
      .in("status", ["new", "in_review"])
      .order("created_at", { ascending: false })
      .limit(50)
    applications = ((trials ?? []) as any[]).map((r) => {
      const name =
        [r.first_name, r.last_name].filter(Boolean).join(" ") ||
        "Заявка"
      return {
        id: r.id,
        name,
        level: r.level ? String(r.level).toUpperCase() : "A1",
        test: false,
      }
    })

    // Ближайшие уроки (все педагоги, статус scheduled/confirmed).
    const now = new Date().toISOString()
    const { data: lRows } = await admin
      .from("lessons")
      .select("id, scheduled_at, title, student_id")
      .gte("scheduled_at", now)
      .in("status", ["scheduled", "confirmed", "booked"])
      .order("scheduled_at", { ascending: true })
      .limit(6)
    upcomingLessons = ((lRows ?? []) as any[]).map((r) => ({
      id: r.id,
      scheduledAt: r.scheduled_at,
      title: r.title || "Урок",
    }))
  } catch (e) {
    console.error("[admin] dashboard prefetch failed", e)
  }

  return (
    <AdminRawDashboard
      teachers={teachers}
      students={students}
      applications={applications}
      upcomingLessons={upcomingLessons}
    />
  )
}
