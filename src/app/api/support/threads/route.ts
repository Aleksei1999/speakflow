import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyTurnstile } from "@/lib/api/turnstile"
import { enforceRateLimitStrict, getClientIp } from "@/lib/api/rate-limit"
import { protectPublic } from "@/lib/api/arcjet"
import { logAuditEvent } from "@/lib/audit/log"

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
  turnstileToken: z.string().nullable().optional(),
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
          last_message_at, last_user_message_at, admin_last_seen_at,
          created_at, updated_at,
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

    const threadIds = ((data ?? []) as any[]).map((t: any) => t.id)
    const previewByThread = new Map<string, { body: string; sender_role: string }>()
    if (threadIds.length) {
      // FIXME(types): 'support_messages' table missing in Database type
      type SupportMsg = { thread_id: string; body: string; sender_role: string; created_at: string }
      // Latest message per thread for preview.
      const { data: msgs } = (await (client as any)
        .from("support_messages")
        .select("thread_id, body, sender_role, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })) as { data: SupportMsg[] | null }
      for (const m of msgs ?? []) {
        if (!previewByThread.has(m.thread_id)) {
          previewByThread.set(m.thread_id, {
            body: m.body,
            sender_role: m.sender_role,
          })
        }
      }
    }

    const mapPriority = (p: string) =>
      p === "med" ? "medium" : p
    const normalizedThreads = (data ?? []).map((t: any) => {
      const profile = t.profiles ?? null
      const lastUserAt = t.last_user_message_at
        ? new Date(t.last_user_message_at).getTime()
        : null
      const adminSeenAt = t.admin_last_seen_at
        ? new Date(t.admin_last_seen_at).getTime()
        : null
      const unreadForAdmin =
        lastUserAt !== null &&
        (adminSeenAt === null || adminSeenAt < lastUserAt)
      const preview = previewByThread.get(t.id)
      return {
        id: t.id,
        subject: t.subject ?? "",
        student_id: profile?.id ?? null,
        student_name: profile?.full_name || profile?.email || "—",
        student_email: profile?.email ?? null,
        student_avatar_url: profile?.avatar_url ?? null,
        student_level: null,
        priority: mapPriority(t.priority),
        status: t.status,
        last_message_at: t.last_message_at,
        last_user_message_at: t.last_user_message_at ?? null,
        admin_last_seen_at: t.admin_last_seen_at ?? null,
        created_at: t.created_at,
        unread_count: isAdmin && unreadForAdmin ? 1 : 0,
        unread_for_admin: unreadForAdmin,
        last_message_preview: preview?.body
          ? preview.body.slice(0, 140)
          : null,
        last_message_sender_role: preview?.sender_role ?? null,
      }
    })

    return NextResponse.json({
      threads: normalizedThreads,
      is_admin: isAdmin,
    })
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
    // Arcjet FIRST — shield (XSS/SQLi в subject/body) + bot detection.
    // Endpoint требует auth, но cookie мог быть украден → отсеиваем
    // headless/scrapy раньше, чем коснёмся Supabase или Telegram fan-out.
    const ajDeny = await protectPublic(request)
    if (ajDeny) return ajDeny

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    // Rate-limit: 10 новых обращений в час на пользователя. fail-closed:
    // обращения дёргают админов Telegram-уведомлениями.
    const limited = await enforceRateLimitStrict(request, {
      name: "support:threads:create",
      keyParts: [user.id, getClientIp(request)],
      max: 10,
      windowSeconds: 60 * 60,
    })
    if (limited) return limited

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
    const { subject, body: messageBody, turnstileToken } = parsed.data

    const cap = await verifyTurnstile(turnstileToken, getClientIp(request))
    if (!cap.ok) {
      return NextResponse.json({ error: "Проверка не пройдена" }, { status: 400 })
    }

    const role = (await getCallerRole(supabase, user.id)) ?? "student"
    const senderRole: "student" | "teacher" | "admin" =
      role === "admin" ? "admin" : role === "teacher" ? "teacher" : "student"

    // FIXME(types): 'support_threads' table missing in Database type
    // 1) Create thread under caller's RLS (user_id = auth.uid()).
    const { data: thread, error: thErr } = (await (supabase as any)
      .from("support_threads")
      .insert({
        user_id: user.id,
        subject,
        status: "open",
        priority: "med",
      })
      .select("id, user_id, subject, status, priority, last_message_at, created_at, updated_at")
      .single()) as { data: { id: string } | null; error: any }

    if (thErr || !thread) {
      console.error("POST /api/support/threads thread error:", thErr)
      return NextResponse.json(
        { error: "Не удалось создать обращение" },
        { status: 500 }
      )
    }

    // FIXME(types): 'support_messages' table missing in Database type
    // 2) Append first message. Trigger will bump last_message_at + status.
    const { data: firstMsg, error: msgErr } = await (supabase as any)
      .from("support_messages")
      .insert({
        thread_id: thread!.id,
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
        await (adminClient as any).from("support_threads").delete().eq("id", thread!.id)
      } catch {}
      return NextResponse.json(
        { error: "Не удалось сохранить сообщение" },
        { status: 500 }
      )
    }

    // Audit: создан обращение поддержки. Тема — первые 80 chars (subject уже
    // обрезан до 200 zod-схемой, но в audit-log это всё равно PII-чувствительно
    // — кладём только превью для контекста).
    await logAuditEvent(request, {
      category: "data",
      action: "support_thread_created",
      target_type: "support_threads",
      target_id: thread!.id,
      payload: {
        subject_first_chars: subject.slice(0, 80),
        sender_role: senderRole,
        has_attachments: false,
      },
    })

    return NextResponse.json(
      { thread, message: firstMsg },
      { status: 201 }
    )
  } catch (err) {
    console.error("Ошибка в POST /api/support/threads:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
