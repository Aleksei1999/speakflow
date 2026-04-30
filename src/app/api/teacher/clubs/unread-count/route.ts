// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/teacher/clubs/unread-count → { count }

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ count: 0 })

    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    if (profile?.role !== "teacher") return NextResponse.json({ count: 0 })

    const admin = createAdminClient()
    const { count, error } = await admin
      .from("club_hosts")
      .select("*", { count: "exact", head: true })
      .eq("host_id", user.id)
      .is("seen_at", null)
    if (error) {
      console.error("teacher/clubs unread-count error:", error)
      return NextResponse.json({ count: 0 })
    }
    return NextResponse.json({ count: count ?? 0 })
  } catch (err) {
    console.error("teacher/clubs unread-count error:", err)
    return NextResponse.json({ count: 0 })
  }
}
