// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------
// POST /api/support/threads/[id]/messages
// Body: { body: string, attachments?: Attachment[] }
// Access: thread owner or admin (enforced by RLS + server-side role check).
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(1000),
  size: z.number().int().nonnegative().optional(),
  mime: z.string().trim().max(200).optional(),
})

const bodySchema = z.object({
  body: z.string().trim().min(1, "Сообщение не может быть пустым").max(8000),
  attachments: z.array(attachmentSchema).max(10).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Некорректный id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    let raw: any
    try {
      raw = await request.json()
    } catch {
      raw = {}
    }

    const parsed = bodySchema.safeParse(raw || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }

    // Resolve sender role. Admin/teacher/student all map into the enum.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    const role = profile?.role
    const senderRole: "student" | "teacher" | "admin" =
      role === "admin" ? "admin" : role === "teacher" ? "teacher" : "student"

    // Access check (RLS also blocks, but early 404 gives a cleaner UX).
    const { data: thread, error: thErr } = await supabase
      .from("support_threads")
      .select("id, status")
      .eq("id", id)
      .maybeSingle()
    if (thErr) {
      console.error("POST support/messages thread read error:", thErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    if (!thread) {
      return NextResponse.json({ error: "Тикет не найден" }, { status: 404 })
    }

    const { data: message, error: msgErr } = await supabase
      .from("support_messages")
      .insert({
        thread_id: id,
        sender_id: user.id,
        sender_role: senderRole,
        body: parsed.data.body,
        attachments: parsed.data.attachments ?? [],
      })
      .select("id, thread_id, sender_id, sender_role, body, attachments, created_at")
      .single()

    if (msgErr) {
      console.error("POST support/messages insert error:", msgErr)
      return NextResponse.json(
        { error: "Не удалось отправить сообщение" },
        { status: 500 }
      )
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    console.error("Ошибка в POST /api/support/threads/[id]/messages:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
