// POST /api/notifications/mark-seen
// Body: { category: 'schedule' | 'homework' | ... } OR {} to clear ALL.
// Returns: { updated: number }
//
// Marks the current user's notification_badges as seen for one category
// (or all when category is omitted). After the RPC succeeds we
// revalidateTag('unread:${user.id}') so the very next GET to
// /api/notifications/unread-counts skips the cache.

import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const KNOWN_CATEGORIES = new Set([
  "schedule",
  "homework",
  "materials",
  "achievements",
  "support",
  "clubs",
  "students",
  "users",
  "trial_requests",
])

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ updated: 0 }, { status: 401 })
    }

    let body: { category?: unknown } = {}
    try {
      body = (await request.json()) as { category?: unknown }
    } catch {
      // Empty body is fine — interpreted as "clear all categories".
    }

    let category: string | null = null
    if (typeof body.category === "string" && body.category.length > 0) {
      if (!KNOWN_CATEGORIES.has(body.category)) {
        // Unknown category is a client bug — surface 400 so we catch it.
        return NextResponse.json(
          { error: "unknown_category" },
          { status: 400 },
        )
      }
      category = body.category
    }

    // RPC types not yet regenerated (мигр 083); cast for new function.
    const supabaseAny = supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    }
    const { data, error } = await supabaseAny.rpc("notifications_mark_seen", {
      p_user_id: user.id,
      p_category: category,
    })
    if (error) {
      console.error("notifications_mark_seen rpc error:", error.message)
      return NextResponse.json({ updated: 0 }, { status: 500 })
    }

    // Bust the unread-counts cache for this user across all RSC requests.
    // Next.js 16: revalidateTag requires the (tag, profile) signature.
    revalidateTag(`unread:${user.id}`, "default")

    return NextResponse.json({ updated: (data as number) ?? 0 })
  } catch (err) {
    console.error("POST /api/notifications/mark-seen error:", err)
    return NextResponse.json({ updated: 0 }, { status: 500 })
  }
}
