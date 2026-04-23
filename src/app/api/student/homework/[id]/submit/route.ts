// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------
// POST /api/student/homework/[id]/submit
//
// Student submits (or re-submits until teacher review) a homework.
// Sets status='submitted', submitted_at=now(), writes submission_text
// and any attachments provided.
//
// Guards:
//   - user must be the homework's student_id (RLS double-checks)
//   - can't submit after teacher already reviewed (status='reviewed')
// ---------------------------------------------------------------

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(1000),
  size: z.number().int().nonnegative().optional(),
  mime: z.string().trim().max(200).optional(),
})

const bodySchema = z.object({
  submission_text: z.string().trim().max(8000).optional().nullable(),
  attachments: z.array(attachmentSchema).max(20).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    // Student role gate
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    if (!profile || profile.role !== "student") {
      return NextResponse.json(
        { error: "Доступ разрешён только ученикам" },
        { status: 403 }
      )
    }

    // Ownership + current status
    const { data: hw, error: fetchErr } = await supabase
      .from("homework")
      .select("id, student_id, status, attachments")
      .eq("id", id)
      .maybeSingle()
    if (fetchErr) {
      console.error("Ошибка чтения homework:", fetchErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    if (!hw) {
      return NextResponse.json({ error: "Задание не найдено" }, { status: 404 })
    }
    if (hw.student_id !== user.id) {
      return NextResponse.json({ error: "Нет доступа к этому заданию" }, { status: 403 })
    }
    if (hw.status === "reviewed") {
      return NextResponse.json(
        { error: "Задание уже проверено — повторная отправка невозможна" },
        { status: 400 }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const parsed = bodySchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }
    const { submission_text, attachments } = parsed.data

    if (
      (!submission_text || !submission_text.trim()) &&
      (!attachments || attachments.length === 0)
    ) {
      return NextResponse.json(
        { error: "Прикрепи файл или напиши ответ перед отправкой" },
        { status: 400 }
      )
    }

    const update: Record<string, any> = {
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }
    if (submission_text !== undefined) {
      update.submission_text = submission_text
    }
    if (attachments && attachments.length > 0) {
      // Merge — sanity cap at 20 total
      const existing = Array.isArray(hw.attachments) ? hw.attachments : []
      update.attachments = [...existing, ...attachments].slice(0, 20)
    }

    const { data: updated, error: updErr } = await supabase
      .from("homework")
      .update(update)
      .eq("id", id)
      .select(
        "id, status, submission_text, submitted_at, attachments, due_date, updated_at"
      )
      .single()
    if (updErr) {
      console.error("Ошибка отправки homework:", updErr)
      return NextResponse.json(
        { error: "Не удалось отправить задание" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      homework: {
        ...updated,
        attachments: Array.isArray(updated.attachments) ? updated.attachments : [],
      },
    })
  } catch (err) {
    console.error(
      "Непредвиденная ошибка в POST /api/student/homework/[id]/submit:",
      err
    )
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
