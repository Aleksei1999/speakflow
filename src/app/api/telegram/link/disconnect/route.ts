// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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
    const admin = createAdminClient()
    const { error } = await admin
      .from("profiles")
      .update({ telegram_chat_id: null, telegram_username: null })
      .eq("id", user.id)
    if (error) {
      console.error("[telegram/link/disconnect] update error:", error)
      return NextResponse.json({ error: "Не удалось отключить" }, { status: 500 })
    }
    // Invalidate any pending codes too.
    await admin
      .from("telegram_linking_codes")
      .delete()
      .eq("user_id", user.id)
      .eq("used", false)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("POST /api/telegram/link/disconnect error:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
