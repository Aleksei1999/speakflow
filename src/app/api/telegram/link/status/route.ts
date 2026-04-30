// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ connected: false })
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_chat_id, telegram_username")
      .eq("id", user.id)
      .maybeSingle()
    return NextResponse.json({
      connected: !!profile?.telegram_chat_id,
      username: profile?.telegram_username ?? null,
    })
  } catch (err) {
    console.error("GET /api/telegram/link/status error:", err)
    return NextResponse.json({ connected: false })
  }
}
