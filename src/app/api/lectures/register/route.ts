import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hasGoogleCalendar } from '@/lib/google-calendar/client'
import { pushLectureToGoogle } from '@/lib/google-calendar/sync'

export const dynamic = "force-dynamic"

// POST /api/lectures/register  body: { lectureId }
// Регистрирует авторизованного ученика на лекцию. Идемпотентно по UNIQUE.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: { lectureId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }
  if (!body.lectureId || typeof body.lectureId !== "string") {
    return NextResponse.json({ error: "lectureId required" }, { status: 400 })
  }

  const { error } = await (supabase as any)
    .from("lecture_registrations")
    .insert({ lecture_id: body.lectureId, student_id: user.id })

  if (error) {
    // 23505 unique_violation — уже зарегистрирован. Считаем это ok.
    if ((error as any).code === "23505") {
      return NextResponse.json({ ok: true, alreadyRegistered: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Лекция в личный Google-календарь ученика, если он подключён (fail-soft)
  try {
    const { data: lec } = await (supabase as any)
      .from("lectures")
      .select("id, title, host_name, scheduled_at, duration_minutes, tag")
      .eq("id", body.lectureId)
      .maybeSingle()
    if (lec && (await hasGoogleCalendar(user.id)).connected) await pushLectureToGoogle(user.id, lec)
  } catch (e) {
    console.error("[lectures/register] Google push failed", e)
  }

  return NextResponse.json({ ok: true })
}
