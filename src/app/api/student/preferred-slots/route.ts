// @ts-nocheck
// GET /api/student/preferred-slots
// Возвращает закреплённые ученика слоты — модалка бронирования
// автоматически предлагает «обычное время» при выборе даты.

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("student_preferred_slots")
    .select("teacher_id, weekday, hour, minute, duration_minutes")
    .eq("student_id", user.id)

  if (error) {
    console.error("[preferred-slots] select error", error)
    return NextResponse.json({ error: "Ошибка БД" }, { status: 500 })
  }

  const slots = (data ?? []).map((p: any) => ({
    teacherProfileId: p.teacher_id,
    weekday: p.weekday,
    hour: p.hour,
    minute: p.minute,
    duration: p.duration_minutes,
  }))

  return NextResponse.json({ slots })
}
