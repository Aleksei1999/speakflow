// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/admin/support/threads/[id]/read — mark thread read by admin

export const dynamic = "force-dynamic"

export async function POST(
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

    const { data, error } = await (supabase as any).rpc(
      "support_mark_thread_read",
      { p_thread_id: id }
    )
    if (error) {
      console.error("support_mark_thread_read error:", error)
      const status = error.code === "42501" ? 403 : 500
      return NextResponse.json(
        { error: status === 403 ? "Только админ" : "Ошибка базы данных" },
        { status }
      )
    }

    return NextResponse.json({ ok: true, thread: data })
  } catch (err) {
    console.error("POST /api/admin/support/threads/[id]/read error:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
