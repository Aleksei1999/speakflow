// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

// ---------------------------------------------------------------------------
// GET /api/admin/tasks
// «Задачи на сегодня» из реальных сигналов БД, без статических моков.
//
// Источники (в порядке сортировки урегентности):
// 1. teacher_applications.status='new' — новые заявки преподавателей.
// 2. support_threads с last_user_message_at > admin_last_seen_at — непрочитанные тикеты.
// 3. trial_lesson_requests без assigned_lesson_id и старше 30 минут — застрявшие пробники.
// 4. clubs published, starts_at в ближайшие 24ч и seats_taken < 2 — клубы под угрозой отмены.
// 5. lessons.status='pending_payment' старше суток — зависшие оплаты.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"

type Task = {
  id: string
  kind: string
  title: string
  meta: string[]
  urgent: boolean
  href: string | null
  ts: string | null
}

function fullName(p: { first_name?: string | null; last_name?: string | null; email?: string | null; contact?: string | null }): string {
  const fn = (p.first_name ?? "").trim()
  const ln = (p.last_name ?? "").trim()
  const combined = [fn, ln].filter(Boolean).join(" ")
  return combined || p.email || p.contact || "Без имени"
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const admin = createAdminClient()
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 3600_000).toISOString()
    const before30min = new Date(now.getTime() - 30 * 60_000).toISOString()
    const before24h = new Date(now.getTime() - 24 * 3600_000).toISOString()

    const [appsRes, threadsRes, trialsRes, clubsRes, pendingRes] = await Promise.all([
      // 1) New teacher applications
      admin
        .from("teacher_applications")
        .select("id, first_name, last_name, email, contact, status, created_at")
        .eq("status", "new")
        .order("created_at", { ascending: true })
        .limit(20),
      // 2) Support threads с непрочитанным
      admin
        .from("support_threads")
        .select("id, subject, last_user_message_at, admin_last_seen_at, priority, student_id")
        .in("status", ["open", "pending"])
        .order("last_user_message_at", { ascending: false })
        .limit(50),
      // 3) Зависшие пробники без preподавателя
      admin
        .from("trial_lesson_requests")
        .select("id, user_id, level, goal, preferred_slot, assigned_lesson_id, created_at")
        .is("assigned_lesson_id", null)
        .lt("created_at", before30min)
        .order("created_at", { ascending: true })
        .limit(20),
      // 4) Полупустые клубы в ближайшие сутки
      admin
        .from("clubs")
        .select("id, topic, starts_at, seats_taken, max_seats, capacity, is_published, cancelled_at")
        .eq("is_published", true)
        .is("cancelled_at", null)
        .gt("starts_at", now.toISOString())
        .lt("starts_at", in24h)
        .order("starts_at", { ascending: true })
        .limit(20),
      // 5) Зависшие оплаты
      admin
        .from("lessons")
        .select("id, scheduled_at, status, created_at, student_id")
        .eq("status", "pending_payment")
        .lt("created_at", before24h)
        .order("created_at", { ascending: true })
        .limit(20),
    ])

    const tasks: Task[] = []

    // Помощь по нику ученика для тикетов и оплат
    const studentIds = new Set<string>()
    for (const t of threadsRes.data ?? []) studentIds.add(t.student_id)
    for (const l of pendingRes.data ?? []) studentIds.add(l.student_id)
    for (const tr of trialsRes.data ?? []) studentIds.add(tr.user_id)
    let studentNameById: Record<string, string> = {}
    if (studentIds.size > 0) {
      const { data: studs } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(studentIds))
      for (const s of studs ?? []) {
        studentNameById[s.id] = (s.full_name ?? s.email ?? "—") as string
      }
    }

    // 1) Teacher applications
    for (const a of appsRes.data ?? []) {
      const name = fullName(a)
      tasks.push({
        id: `app:${a.id}`,
        kind: "teacher_application",
        title: `Рассмотреть заявку преподавателя · ${name}`,
        meta: ["заявка", a.email ?? a.contact ?? "—"],
        urgent: true,
        href: `/admin?app=${a.id}`,
        ts: a.created_at,
      })
    }

    // 2) Тикеты с непрочитанным от пользователя
    for (const t of threadsRes.data ?? []) {
      const lastUser = t.last_user_message_at ? new Date(t.last_user_message_at).getTime() : 0
      const lastSeen = t.admin_last_seen_at ? new Date(t.admin_last_seen_at).getTime() : 0
      if (lastUser <= lastSeen) continue
      const studentName = studentNameById[t.student_id] ?? "—"
      tasks.push({
        id: `thread:${t.id}`,
        kind: "support_thread",
        title: `Ответить в поддержке · ${t.subject || "(без темы)"}`,
        meta: ["тикет", studentName, t.priority === "high" ? "high" : "med"],
        urgent: t.priority === "high",
        href: `/admin/support?thread=${t.id}`,
        ts: t.last_user_message_at,
      })
    }

    // 3) Зависшие пробные
    for (const tr of trialsRes.data ?? []) {
      const studentName = studentNameById[tr.user_id] ?? "—"
      tasks.push({
        id: `trial:${tr.id}`,
        kind: "trial_request",
        title: `Подобрать преподавателя для пробного · ${studentName}`,
        meta: ["лид", tr.level ?? "—", tr.goal ?? "общее"],
        urgent: true,
        href: `/admin?trial=${tr.id}`,
        ts: tr.created_at,
      })
    }

    // 4) Полупустые клубы в ближайшие сутки
    for (const c of clubsRes.data ?? []) {
      const seats = c.seats_taken ?? 0
      const cap = c.capacity ?? c.max_seats ?? 0
      if (cap > 0 && seats >= 2) continue
      tasks.push({
        id: `club:${c.id}`,
        kind: "club_low_seats",
        title: `Доукомплектовать клуб · ${c.topic}`,
        meta: ["клуб", `${seats}/${cap || c.max_seats || "?"}`, "<24ч до старта"],
        urgent: false,
        href: `/admin/clubs?id=${c.id}`,
        ts: c.starts_at,
      })
    }

    // 5) Зависшие оплаты
    for (const l of pendingRes.data ?? []) {
      const studentName = studentNameById[l.student_id] ?? "—"
      tasks.push({
        id: `lesson:${l.id}`,
        kind: "pending_payment",
        title: `Проверить зависшую оплату · ${studentName}`,
        meta: ["оплата", "pending > 24ч"],
        urgent: false,
        href: `/admin/students?lesson=${l.id}`,
        ts: l.created_at,
      })
    }

    // Сортировка: сначала urgent, потом по времени (старшие задачи выше — раньше пришли)
    tasks.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
      const ta = a.ts ? new Date(a.ts).getTime() : 0
      const tb = b.ts ? new Date(b.ts).getTime() : 0
      return ta - tb
    })

    return NextResponse.json({ tasks })
  } catch (e) {
    console.error("[GET /api/admin/tasks] crashed:", e)
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
  }
}
