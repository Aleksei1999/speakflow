// GET /api/notifications/unread-counts
// Returns: { counts: { schedule: 3, homework: 1, ... } } for the current user.
//
// Powered by the public.notifications_unread_counts(uuid) RPC (migration 083),
// which aggregates public.notification_badges rows where seen_at IS NULL,
// grouped by category. Per-user cached for 30s via unstable_cache with
// tag `unread:${user.id}` so we don't hammer Postgres on every sidebar
// re-render across tabs; revalidateTag is called from the mark-seen
// endpoint to clear stale counts immediately after the user reads them.

import { NextResponse } from "next/server"
import { unstable_cache, revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const TTL_SECONDS = 30

function unreadKey(userId: string) {
  return `unread:${userId}` as const
}

/** Exported so /api/notifications/mark-seen can invalidate the same tag. */
export function invalidateUnreadTag(userId: string) {
  revalidateTag(unreadKey(userId), "default")
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ counts: {} })
    }

    const userId = user.id
    const tag = unreadKey(userId)

    // unstable_cache key MUST include userId or every visitor sees the same numbers.
    const getCounts = unstable_cache(
      async () => {
        const sb = await createClient()
        // RPC types aren't regenerated yet — cast to any for new function
        // until `npx supabase gen types` runs. RPC name + arg shape match
        // migration 083 verbatim, so runtime is correct.
        const sbAny = sb as unknown as {
          rpc: (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: { message: string } | null }>
        }
        const { data, error } = await sbAny.rpc("notifications_unread_counts", {
          p_user_id: userId,
        })
        if (error) {
          // Don't fail-closed UX on a hot path — return zeros and let
          // observability catch the underlying error.
          console.error("notifications_unread_counts rpc error:", error.message)
          return {} as Record<string, number>
        }
        const obj = (data ?? {}) as Record<string, unknown>
        const out: Record<string, number> = {}
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === "number" && v > 0) out[k] = v
        }
        return out
      },
      ["notifications-unread-counts", userId],
      { revalidate: TTL_SECONDS, tags: [tag] },
    )

    const counts = await getCounts()
    return NextResponse.json({ counts })
  } catch (err) {
    console.error("GET /api/notifications/unread-counts error:", err)
    return NextResponse.json({ counts: {} })
  }
}
