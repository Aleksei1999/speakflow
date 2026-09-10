import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasGoogleCalendar } from "@/lib/google-calendar/client"
import { pushLectureToGoogle, deleteLectureFromGoogleForUser } from "@/lib/google-calendar/sync"

export const dynamic = "force-dynamic"

const bodySchema = z.object({ lectureId: z.string().uuid("Некорректный id лекции") })

type LectureRow = {
  id: string
  title: string
  host_name: string | null
  scheduled_at: string
  duration_minutes: number | null
  tag: string | null
  capacity: number | null
  is_published: boolean | null
}

async function parse(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { error: NextResponse.json({ error: "invalid body" }, { status: 400 }) }
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return { error: NextResponse.json({ error: parsed.error.issues[0]?.message ?? "lectureId required" }, { status: 400 }) }
  }
  return { lectureId: parsed.data.lectureId }
}

async function requireStudent() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (prof?.role !== "student") {
    return { error: NextResponse.json({ error: "Записаться на лекцию может только ученик" }, { status: 403 }) }
  }
  return { user, admin }
}

// POST /api/lectures/register  body: { lectureId }
// Записывает ученика на опубликованную будущую лекцию с учётом вместимости. Идемпотентно.
export async function POST(request: Request) {
  const gate = await requireStudent()
  if ("error" in gate) return gate.error
  const p = await parse(request)
  if ("error" in p) return p.error
  const { user, admin } = gate

  const { data: lec } = await admin
    .from("lectures")
    .select("id, title, host_name, scheduled_at, duration_minutes, tag, capacity, is_published")
    .eq("id", p.lectureId)
    .maybeSingle()
  const lecture = lec as LectureRow | null
  if (!lecture || lecture.is_published === false) {
    return NextResponse.json({ error: "Лекция не найдена" }, { status: 404 })
  }
  // Записаться можно до конца лекции (в том числе когда она уже идёт).
  if (Date.parse(lecture.scheduled_at) + (lecture.duration_minutes ?? 60) * 60_000 < Date.now()) {
    return NextResponse.json({ error: "Лекция уже прошла" }, { status: 409 })
  }

  const { data: existing } = await admin
    .from("lecture_registrations")
    .select("id")
    .eq("lecture_id", lecture.id)
    .eq("student_id", user.id)
    .maybeSingle()
  if (existing) return NextResponse.json({ ok: true, alreadyRegistered: true })

  if (typeof lecture.capacity === "number") {
    const { count } = await admin
      .from("lecture_registrations")
      .select("id", { count: "exact", head: true })
      .eq("lecture_id", lecture.id)
    if ((count ?? 0) >= lecture.capacity) {
      return NextResponse.json({ error: "Мест больше нет" }, { status: 409 })
    }
  }

  const { error } = await admin
    .from("lecture_registrations")
    .insert({ lecture_id: lecture.id, student_id: user.id })
  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true, alreadyRegistered: true })
    console.error("[lectures/register] insert", error)
    return NextResponse.json({ error: "Не удалось записаться" }, { status: 500 })
  }

  // Лекция в личный Google-календарь ученика, если он подключён (fail-soft)
  try {
    if ((await hasGoogleCalendar(user.id)).connected) await pushLectureToGoogle(user.id, lecture)
  } catch (e) {
    console.error("[lectures/register] Google push failed", e)
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/lectures/register  body: { lectureId } — отменить свою запись.
export async function DELETE(request: Request) {
  const gate = await requireStudent()
  if ("error" in gate) return gate.error
  const p = await parse(request)
  if ("error" in p) return p.error
  const { user, admin } = gate

  const { data: removed, error } = await admin
    .from("lecture_registrations")
    .delete()
    .eq("lecture_id", p.lectureId)
    .eq("student_id", user.id)
    .select("id")
  if (error) {
    console.error("[lectures/register] delete", error)
    return NextResponse.json({ error: "Не удалось отменить запись" }, { status: 500 })
  }
  if (!removed?.length) return NextResponse.json({ ok: true, wasRegistered: false })

  try {
    if ((await hasGoogleCalendar(user.id)).connected) await deleteLectureFromGoogleForUser(user.id, p.lectureId)
  } catch (e) {
    console.error("[lectures/register] Google delete failed", e)
  }
  return NextResponse.json({ ok: true, wasRegistered: true })
}
