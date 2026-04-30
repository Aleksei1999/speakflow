// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/admin/support/unread-count → { count }

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ count: 0 })
    }

    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    if (profile?.role !== "admin") {
      return NextResponse.json({ count: 0 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("support_threads")
      .select("id, last_user_message_at, admin_last_seen_at, status")
      .not("last_user_message_at", "is", null)
      .not("status", "in", "(resolved,closed)")
    if (error) {
      console.error("unread-count error:", error)
      return NextResponse.json({ count: 0 })
    }

    let count = 0
    for (const t of data ?? []) {
      const lastUser = t.last_user_message_at
        ? new Date(t.last_user_message_at).getTime()
        : null
      const seen = t.admin_last_seen_at
        ? new Date(t.admin_last_seen_at).getTime()
        : null
      if (lastUser !== null && (seen === null || seen < lastUser)) {
        count++
      }
    }

    return NextResponse.json({ count })
  } catch (err) {
    console.error("GET unread-count error:", err)
    return NextResponse.json({ count: 0 })
  }
}
