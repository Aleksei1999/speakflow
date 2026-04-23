// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// ---------------------------------------------------------------
// GET  /api/support/threads
// POST /api/support/threads   body: { subject, body }
//
// - Student/Teacher users: see only their own threads (enforced by RLS).
// - Admin: sees all threads, up to limit=50.
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
})

const createSchema = z.object({
  subject: z.string().trim().min(1, "Введите тему").max(200, "Максимум 200 символов"),
  body: z.string().trim().min(1, "Сообщение не может быть пустым").max(8000),
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
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = listQuerySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные параметры" },
        { status: 400 }
      )
    }
    const { limit, status } = parsed.data

    const role = await getCallerRole(supabase, user.id)
    const isAdmin = role === "admin"

    // Admins get all threads (via admin client for uniform ordering); others rely on RLS.
    const client = isAdmin ? createAdminClient() : supabase

    let q = client
      .from("support_threads")
      .select(
        `
          id, user_id, subject, status, priority,
          last_message_at, created_at, updated_at,
          profiles:user_id ( id, full_name, avatar_url, email, role )
        `
      )
      .order("last_message_at", { ascending: false })
      .limit(limit)

    if (!isAdmin) {
      q = q.eq("user_id", user.id)
    }
    if (status) {
      q = q.eq("status", status)
    }

    const { data, error } = await q
    if (error) {
      console.error("GET /api/support/threads error:", error)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }

    return NextResponse.json({ threads: data ?? [], is_admin: isAdmin })
  } catch (err) {
    console.error("Ошибка в GET /api/support/threads:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// POST
// ---------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const parsed = createSchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }
    const { subject, body: messageBody } = parsed.data

    const role = (await getCallerRole(supabase, user.id)) ?? "student"
    const senderRole: "student" | "teacher" | "admin" =
      role === "admin" ? "admin" : role === "teacher" ? "teacher" : "student"

    // 1) Create thread under caller's RLS (user_id = auth.uid()).
    const { data: thread, error: thErr } = await supabase
      .from("support_threads")
      .insert({
        user_id: user.id,
        subject,
        status: "open",
        priority: "med",
      })
      .select("id, user_id, subject, status, priority, last_message_at, created_at, updated_at")
      .single()

    if (thErr || !thread) {
      console.error("POST /api/support/threads thread error:", thErr)
      return NextResponse.json(
        { error: "Не удалось создать тикет" },
        { status: 500 }
      )
    }

    // 2) Append first message. Trigger will bump last_message_at + status.
    const { data: firstMsg, error: msgErr } = await supabase
      .from("support_messages")
      .insert({
        thread_id: thread.id,
        sender_id: user.id,
        sender_role: senderRole,
        body: messageBody,
      })
      .select("id, thread_id, sender_id, sender_role, body, attachments, created_at")
      .single()

    if (msgErr) {
      console.error("POST /api/support/threads first message error:", msgErr)
      // Roll back thread via admin client (RLS won't let user delete).
      try {
        const adminClient = createAdminClient()
        await adminClient.from("support_threads").delete().eq("id", thread.id)
      } catch {}
      return NextResponse.json(
        { error: "Не удалось сохранить сообщение" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { thread, message: firstMsg },
      { status: 201 }
    )
  } catch (err) {
    console.error("Ошибка в POST /api/support/threads:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
