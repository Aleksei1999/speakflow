// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchChatList } from "@/lib/chat/list"
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
    createdAt: string
    testAnswers?: Array<{ text: string; options: string[]; chosen: number; correct: number; lvl?: 1 | 2 | 3 | 4 }>
  }> = []
  let upcomingLessons: Array<{
    id: string
    scheduledAt: string
    title: string
    studentName: string | null
    teacherName: string | null
    teacherUserId: string | null
    studentId: string | null
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
      // DB хранит роаст-уровни (Raw..Well Done) — маппим на CEFR для UI.
      const { fromRoastLevel } = await import("@/lib/levels/mapping")
      for (const p of (prog ?? []) as Array<{
        user_id: string
        english_level: string | null
      }>) {
        if (p.english_level)
          levelById.set(p.user_id, fromRoastLevel(p.english_level))
      }
    }
    students = (sRows ?? []).map((r: any) => ({
      id: r.id,
      name: r.full_name || "Ученик",
      level: levelById.get(r.id) || "A1",
      avatar: r.avatar_url ?? null,
    }))

    // fromRoastLevel мапит Raw..Well Done обратно на A1..C2 для UI.
    const { fromRoastLevel } = await import("@/lib/levels/mapping")
    // Заявки для админа — объединяем два источника:
    //   1) trial_lesson_requests — зарегистрированные ученики, ждут пробного
    //      (fetchTrialApplications у учителя уже использует эту таблицу).
    //   2) landing_leads — анонимные подачи с лендинг-формы «Оставь свои данные»
    //      (ещё не зарегистрированы).
    // Тег «тест пройден» подтягиваем через level_tests: по user_id для trial-заявок,
    // по email для landing_leads (LEFT JOIN в коде — Postgrest не даёт union).
    const [trialsRes, leadsRes] = await Promise.all([
      admin
        .from("trial_lesson_requests")
        .select("id, user_id, level_test_id, status, created_at")
        .in("status", ["pending", "new"])
        .is("assigned_teacher_id", null)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("landing_leads")
        .select("id, name, email, status, created_at")
        .in("status", ["new", "contacted"])
        .is("assigned_teacher_id", null)
        .order("created_at", { ascending: false })
        .limit(100),
    ])
    const trialRows = (trialsRes.data ?? []) as Array<{
      id: string
      user_id: string
      level_test_id: string | null
      status: string
      created_at: string
    }>
    const leadRows = (leadsRes.data ?? []) as Array<{
      id: string
      name: string
      email: string
      status: string
      created_at: string
    }>

    // Резолвим имена + level+test для trial-строк.
    const trialUserIds = Array.from(new Set(trialRows.map((r) => r.user_id)))
    const leadEmails = Array.from(new Set(leadRows.map((r) => r.email).filter(Boolean)))
    const [profsByIdRes, progByIdRes, testsByUserRes, testsByEmailRes] = await Promise.all([
      trialUserIds.length
        ? admin.from("profiles").select("id, full_name, email").in("id", trialUserIds)
        : Promise.resolve({ data: [] }),
      trialUserIds.length
        ? admin.from("user_progress").select("user_id, english_level").in("user_id", trialUserIds)
        : Promise.resolve({ data: [] }),
      trialUserIds.length
        ? admin.from("level_tests").select("user_id, level, completed_at").in("user_id", trialUserIds).order("completed_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      leadEmails.length
        ? admin.from("level_tests").select("email, level, answers, completed_at").in("email", leadEmails).order("completed_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    const profById = new Map<string, { name: string; email: string | null }>()
    for (const p of (profsByIdRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      profById.set(p.id, { name: p.full_name || "Ученик", email: p.email })
    }
    const levelByUserId = new Map<string, string>()
    for (const p of (progByIdRes.data ?? []) as Array<{ user_id: string; english_level: string | null }>) {
      if (p.english_level) levelByUserId.set(p.user_id, String(p.english_level).toUpperCase())
    }
    const testLevelByUserId = new Map<string, string>()
    for (const t of (testsByUserRes.data ?? []) as Array<{ user_id: string; level: string }>) {
      if (!testLevelByUserId.has(t.user_id)) testLevelByUserId.set(t.user_id, fromRoastLevel(t.level))
    }
    type LeadLogItem = { text: string; options: string[]; chosen: number; correct: number; lvl?: 1 | 2 | 3 | 4 }
    const testLevelByEmail = new Map<string, string>()
    const testLogByEmail = new Map<string, LeadLogItem[]>()
    for (const t of (testsByEmailRes.data ?? []) as Array<{ email: string; level: string; answers: unknown }>) {
      if (!testLevelByEmail.has(t.email)) testLevelByEmail.set(t.email, fromRoastLevel(t.level))
      if (!testLogByEmail.has(t.email)) {
        const raw = t.answers as { log?: unknown } | null
        const arr = Array.isArray(raw?.log) ? raw!.log : []
        const log = arr.filter((x): x is LeadLogItem => {
          if (!x || typeof x !== "object") return false
          const o = x as Record<string, unknown>
          return typeof o.text === "string"
            && Array.isArray(o.options)
            && typeof o.chosen === "number"
            && typeof o.correct === "number"
        })
        if (log.length) testLogByEmail.set(t.email, log)
      }
    }

    // Бизнес-правило: заявка приходит админу ТОЛЬКО если ученик прошёл тест
    // (проверяется в fetchTrialApplicationsForAdmin через level_tests).
    // Заявки без теста фильтруются на источнике.
    const { fetchTrialApplicationsForAdmin } = await import("./admin-trial-fetch")
    const trialWithTests = await fetchTrialApplicationsForAdmin()
    const trialApps = trialWithTests.map((t) => ({
      id: `trial:${t.id}`,
      name: t.name,
      level: t.level,
      test: t.test,
      createdAt: t.createdAt,
      testAnswers: t.testAnswers,
    }))
    // landing_leads — показываем все заявки; тег «тест пройден» ставим,
    // если по email найдена строка в level_tests, иначе test:false.
    const leadApps = leadRows.map((r) => ({
      id: `lead:${r.id}`,
      name: r.name || r.email || "Лид",
      level: (r.email && testLevelByEmail.get(r.email)) || "A1",
      test: !!(r.email && testLevelByEmail.has(r.email)),
      createdAt: r.created_at,
      testAnswers: (r.email && testLogByEmail.get(r.email)) || undefined,
    }))
    applications = [...trialApps, ...leadApps].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )

    // Ближайшие уроки (все педагоги, статус scheduled/confirmed).
    const now = new Date().toISOString()
    const { data: lRows } = await admin
      .from("lessons")
      .select("id, scheduled_at, title, student_id, teacher_id")
      .gte("scheduled_at", now)
      .in("status", ["scheduled", "confirmed", "booked"])
      .order("scheduled_at", { ascending: true })
      .limit(20)
    // Обогащаем именами учителя+ученика — так строка в дашборде читается
    // без лишних кликов ("08:30 07.09 — Кристина / Дмитрий Кузин").
    const studentIds = Array.from(new Set(((lRows ?? []) as any[]).map((r) => r.student_id).filter(Boolean)))
    const teacherProfileIds = Array.from(new Set(((lRows ?? []) as any[]).map((r) => r.teacher_id).filter(Boolean)))
    const [profileMap, teacherUserMap] = await Promise.all([
      studentIds.length
        ? admin.from("profiles").select("id, full_name").in("id", studentIds)
        : Promise.resolve({ data: [] }),
      teacherProfileIds.length
        ? admin.from("teacher_profiles").select("id, user_id").in("id", teacherProfileIds)
        : Promise.resolve({ data: [] }),
    ])
    const studentNameById = new Map(((profileMap.data ?? []) as any[]).map((p) => [p.id, p.full_name]))
    const teacherUserIdByPk = new Map(((teacherUserMap.data ?? []) as any[]).map((t) => [t.id, t.user_id]))
    // Второй запрос — имена учителей через user_id.
    const teacherUserIds = Array.from(new Set([...teacherUserIdByPk.values()]))
    const { data: tProfiles } = teacherUserIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", teacherUserIds)
      : { data: [] }
    const teacherNameByUserId = new Map(((tProfiles ?? []) as any[]).map((p) => [p.id, p.full_name]))
    const lessonEvents = ((lRows ?? []) as any[]).map((r) => {
      const teacherUserId = teacherUserIdByPk.get(r.teacher_id) ?? null
      return {
        id: r.id,
        scheduledAt: r.scheduled_at,
        title: r.title || "Урок",
        studentName: studentNameById.get(r.student_id) ?? null,
        teacherName: teacherUserId ? teacherNameByUserId.get(teacherUserId) ?? null : null,
        teacherUserId,
        studentId: r.student_id ?? null,
      }
    })

    // Лекции — те же admin видит все будущие. Показываем в календаре тоже
    // (пользователь просил чтобы события из «Добавить лекцию» появлялись
    // не только в блоке лектория, но и в расписании).
    const { data: lecRows } = await admin
      .from("lectures")
      .select("id, title, host_name, scheduled_at, is_published")
      .gte("scheduled_at", now)
      .eq("is_published", true)
      .order("scheduled_at", { ascending: true })
      .limit(20)
    const lectureEvents = ((lecRows ?? []) as any[]).map((r) => ({
      id: `lec:${r.id}`,
      scheduledAt: r.scheduled_at,
      title: r.title || "Лекция",
      studentName: null,
      teacherName: r.host_name || "Лекция",
      teacherUserId: null,
      studentId: null,
    }))

    // Мержим уроки+лекции, сортируем по scheduled_at.
    upcomingLessons = [...lessonEvents, ...lectureEvents]
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 20)
  } catch (e) {
    console.error("[admin] dashboard prefetch failed", e)
  }

  let initialChats: Awaited<ReturnType<typeof fetchChatList>> = []
  try {
    initialChats = await fetchChatList()
  } catch (e) {
    console.error("[admin] chat list fetch failed", e)
  }

  return (
    <AdminRawDashboard
      adminUserId={user.id}
      teachers={teachers}
      students={students}
      applications={applications}
      upcomingLessons={upcomingLessons}
      initialChats={initialChats}
    />
  )
}
