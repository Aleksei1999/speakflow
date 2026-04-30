// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ---------------------------------------------------------------
// GET   /api/support/threads/[id]
// PATCH /api/support/threads/[id]   body: { status?, priority? }  (admin only)
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const patchSchema = z
  .object({
    status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
    // UI may send "medium"; DB stores "med".
    priority: z.enum(["low", "med", "medium", "high"]).optional(),
  })
  .refine((d) => d.status !== undefined || d.priority !== undefined, {
    message: "Нужно передать хотя бы одно поле",
  })

async function getCallerRole(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  return data?.role ?? null
}

// ---------------------------------------------------------------
// GET
// ---------------------------------------------------------------
export async function GET(
  _request: NextRequest,
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

    // RLS enforces access: owner or admin.
    const { data: thread, error: thErr } = await supabase
      .from("support_threads")
      .select(
        `
          id, user_id, subject, status, priority,
          last_message_at, created_at, updated_at,
          profiles:user_id ( id, full_name, avatar_url, email, role )
        `
      )
      .eq("id", id)
      .maybeSingle()

    if (thErr) {
      console.error("GET /api/support/threads/[id] thread error:", thErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    if (!thread) {
      return NextResponse.json({ error: "Тикет не найден" }, { status: 404 })
    }

    const { data: messages, error: msgErr } = await supabase
      .from("support_messages")
      .select(
        `
          id, thread_id, sender_id, sender_role, body, attachments, created_at,
          sender:profiles!support_messages_sender_id_fkey ( id, full_name, avatar_url, role )
        `
      )
      .eq("thread_id", id)
      .order("created_at", { ascending: true })

    if (msgErr) {
      console.error("GET /api/support/threads/[id] messages error:", msgErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }

    const normalizedMessages = (messages ?? []).map((m: any) => ({
      id: m.id,
      thread_id: m.thread_id,
      author_id: m.sender_id,
      author_role: m.sender_role,
      author_name: m.sender?.full_name || "—",
      author_avatar_url: m.sender?.avatar_url || null,
      body: m.body,
      attachments: m.attachments ?? [],
      created_at: m.created_at,
    }))

    return NextResponse.json({
      thread,
      messages: normalizedMessages,
    })
  } catch (err) {
    console.error("Ошибка в GET /api/support/threads/[id]:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// PATCH (admin-only: change status / priority)
// ---------------------------------------------------------------
export async function PATCH(
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

    const role = await getCallerRole(supabase, user.id)
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Только админ может менять статус тикета" },
        { status: 403 }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const parsed = patchSchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }

    const update: Record<string, any> = {}
    if (parsed.data.status !== undefined) update.status = parsed.data.status
    if (parsed.data.priority !== undefined) {
      update.priority =
        parsed.data.priority === "medium" ? "med" : parsed.data.priority
    }

    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from("support_threads")
      .update(update)
      .eq("id", id)
      .select(
        "id, user_id, subject, status, priority, last_message_at, created_at, updated_at"
      )
      .maybeSingle()

    if (error) {
      console.error("PATCH /api/support/threads/[id] error:", error)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Тикет не найден" }, { status: 404 })
    }

    return NextResponse.json({ thread: data })
  } catch (err) {
    console.error("Ошибка в PATCH /api/support/threads/[id]:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
