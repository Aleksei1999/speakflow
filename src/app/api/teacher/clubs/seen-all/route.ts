// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/teacher/clubs/seen-all — set seen_at=now() for all of caller's
// host assignments that are still unseen.

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const { data, error } = await (supabase as any).rpc("club_hosts_mark_seen")
    if (error) {
      console.error("teacher/clubs/seen-all rpc error:", error)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    return NextResponse.json({ updated: data ?? 0 })
  } catch (err) {
    console.error("teacher/clubs/seen-all error:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
