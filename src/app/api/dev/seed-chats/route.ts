import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// POST /api/dev/seed-chats — сеет тестовые данные под роль текущего юзера:
//   • teacher/admin → 5 тестовых учеников + чат-сообщения от них + 5 pending
//                     заявок на пробный урок
//   • student       → 5 тестовых учителей + чат-сообщения от них
// Идемпотентно.

const TEACHER_SEEDS = [
  { email: "teacher1.seed@example.com", full: "Кристина Кирова" },
  { email: "teacher2.seed@example.com", full: "Дмитрий Смирнов" },
  { email: "teacher3.seed@example.com", full: "Анна Кузнецова" },
  { email: "teacher4.seed@example.com", full: "Павел Соколов" },
  { email: "teacher5.seed@example.com", full: "Ольга Морозова" },
]

const STUDENT_SEEDS = [
  { email: "student1.seed@example.com", full: "Александр Петров", level: "A1" },
  { email: "student2.seed@example.com", full: "Мария Иванова", level: "A2" },
  { email: "student3.seed@example.com", full: "Дмитрий Смирнов", level: "B1" },
  { email: "student4.seed@example.com", full: "Анна Кузнецова", level: "A2" },
  { email: "student5.seed@example.com", full: "Павел Соколов", level: "A1" },
]

const SAMPLE_MSGS_FROM_TEACHER = [
  "Привет! Как проходит подготовка к уроку?",
  "Не забудьте посмотреть материалы к следующему занятию.",
  "Готовы обсудить план на неделю?",
  "Мы можем перенести урок на среду.",
  "Спасибо за отличный урок сегодня!",
]

const SAMPLE_MSGS_FROM_STUDENT = [
  "Здравствуйте! Хотел бы записаться на пробный урок.",
  "Спасибо за материалы, всё понятно!",
  "Можем перенести урок на другой день?",
  "Готов к сегодняшнему занятию.",
  "Подскажите, какой учебник купить?",
]

async function findOrCreateUser(admin: any, email: string, full: string, role: "teacher" | "student") {
  const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existing = existingList?.users?.find((u: any) => u.email === email)
  if (existing) return { userId: existing.id as string, created: false }

  const { data: newUser, error } = await admin.auth.admin.createUser({
    email,
    password: "TestPass123!",
    email_confirm: true,
    user_metadata: { full_name: full },
  })
  if (error || !newUser?.user) return { userId: null, created: false }
  const userId = newUser.user.id

  await admin.from("profiles").upsert(
    { id: userId, email, full_name: full, role },
    { onConflict: "id" },
  )

  if (role === "teacher") {
    await admin.from("teacher_profiles").upsert(
      {
        user_id: userId,
        hourly_rate: 150000,
        is_listed: true,
        is_verified: true,
        languages: ["English", "Русский"],
        specializations: ["General"],
        experience_years: 5,
      },
      { onConflict: "user_id" },
    )
  }

  return { userId, created: true }
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createAdminClient() as any

  const { data: myProf } = await admin.from("profiles").select("role").eq("id", user.id).single()
  const myRole = (myProf?.role ?? "student") as "teacher" | "student" | "admin"

  const summary: {
    role: string
    peers: Array<{ email: string; userId: string; created: boolean }>
    trialRequests: number
  } = { role: myRole, peers: [], trialRequests: 0 }

  // ---------- 1. Create peers + chat msgs ----------
  if (myRole === "teacher" || myRole === "admin") {
    // Тестовые ученики, каждый пишет учителю по 1 сообщению.
    for (let i = 0; i < STUDENT_SEEDS.length; i++) {
      const s = STUDENT_SEEDS[i]
      const { userId, created } = await findOrCreateUser(admin, s.email, s.full, "student")
      if (!userId) continue
      summary.peers.push({ email: s.email, userId, created })

      // user_progress для english_level
      await admin.from("user_progress").upsert(
        { user_id: userId, english_level: s.level },
        { onConflict: "user_id" },
      )

      // Слоты чата: teacher_id = учитель (current), student_id = ученик (seed)
      const teacherSlot = user.id
      const studentSlot = userId
      const { count } = await admin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", teacherSlot)
        .eq("student_id", studentSlot)
      if ((count ?? 0) === 0) {
        await admin.from("chat_messages").insert({
          teacher_id: teacherSlot,
          student_id: studentSlot,
          sender_id: userId,
          sender_role: "student",
          text: SAMPLE_MSGS_FROM_STUDENT[i % SAMPLE_MSGS_FROM_STUDENT.length],
        })
      }

      // Trial request от этого ученика (pending, без assigned_teacher_id).
      const { data: existingReq } = await admin
        .from("trial_lesson_requests")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["pending", "new", "assigned", "scheduled"])
        .maybeSingle()
      if (!existingReq) {
        await admin.from("trial_lesson_requests").insert({
          user_id: userId,
          status: "pending",
        })
        summary.trialRequests += 1
      }
    }
  } else {
    // Student — сеем 5 учителей.
    for (let i = 0; i < TEACHER_SEEDS.length; i++) {
      const t = TEACHER_SEEDS[i]
      const { userId, created } = await findOrCreateUser(admin, t.email, t.full, "teacher")
      if (!userId) continue
      summary.peers.push({ email: t.email, userId, created })

      const teacherSlot = userId
      const studentSlot = user.id
      const { count } = await admin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", teacherSlot)
        .eq("student_id", studentSlot)
      if ((count ?? 0) === 0) {
        await admin.from("chat_messages").insert({
          teacher_id: teacherSlot,
          student_id: studentSlot,
          sender_id: userId,
          sender_role: "teacher",
          text: SAMPLE_MSGS_FROM_TEACHER[i % SAMPLE_MSGS_FROM_TEACHER.length],
        })
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
