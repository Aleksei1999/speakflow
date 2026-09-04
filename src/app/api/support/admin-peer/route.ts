// GET /api/support/admin-peer
// Возвращает первого админа (id, имя, аватар) — чтобы кнопка «Написать в
// поддержку» открыла обычный ChatModal с админом как peer. Сообщение
// попадает в chat_messages и админ видит его в списке чатов.

// @ts-nocheck
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const admin = createAdminClient() as any
    const { data: row } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!row?.id) {
      return NextResponse.json({ error: "Админ не найден" }, { status: 404 })
    }
    return NextResponse.json({
      admin: {
        id: row.id,
        name: row.full_name || "Поддержка",
        avatar: row.avatar_url ?? null,
      },
    })
  } catch (e) {
    console.error("[api/support/admin-peer]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
