// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/teacher/clubs — clubs where the caller is a host.
// Returns the same normalized shape as /api/admin/clubs entries.

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: hostRows, error: hostErr } = await admin
      .from("club_hosts")
      .select("club_id, role, sort_order, seen_at")
      .eq("host_id", user.id)
    if (hostErr) {
      console.error("teacher/clubs GET host_rows error:", hostErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }

    const ids = (hostRows ?? []).map((r) => r.club_id)
    if (ids.length === 0) {
      return NextResponse.json({ clubs: [], unread_count: 0 })
    }

    const { data: clubs, error: clubsErr } = await admin
      .from("clubs")
      .select(
        `
          id, topic, description, category, format, location, timezone,
          starts_at, duration_min, max_seats, seats_taken, capacity,
          price_kopecks, xp_reward, badge, cover_emoji,
          is_published, cancelled_at, level_min, level_max,
          created_at, updated_at,
          club_hosts (
            role, sort_order, seen_at,
            host:profiles!club_hosts_host_id_fkey ( id, full_name, avatar_url )
          )
        `
      )
      .in("id", ids)
      .order("starts_at", { ascending: true })

    if (clubsErr) {
      console.error("teacher/clubs GET clubs error:", clubsErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }

    // Participants per club (registered/attended/pending_payment/waitlist).
    const { data: regs } = await admin
      .from("club_registrations")
      .select(
        "club_id, status, registered_at, user:profiles!club_registrations_user_id_fkey(id, full_name, avatar_url, email)"
      )
      .in("club_id", ids)
      .in("status", ["registered", "pending_payment", "attended", "waitlist"])
      .order("registered_at", { ascending: true })

    const partsByClub = new Map<string, any[]>()
    for (const r of regs ?? []) {
      const arr = partsByClub.get(r.club_id) ?? []
      arr.push({
        id: r.user?.id ?? null,
        full_name: r.user?.full_name ?? null,
        avatar_url: r.user?.avatar_url ?? null,
        email: r.user?.email ?? null,
        status: r.status,
        registered_at: r.registered_at,
      })
      partsByClub.set(r.club_id, arr)
    }

    const seenById = new Map<string, string | null>()
    for (const r of hostRows ?? []) {
      if (r.club_id) seenById.set(r.club_id, r.seen_at ?? null)
    }

    const enriched = (clubs ?? []).map((c: any) => {
      const cancelled = !!c.cancelled_at
      const status = cancelled
        ? "cancelled"
        : c.is_published
        ? "published"
        : "draft"
      const capacity = c.capacity ?? c.max_seats ?? 0
      const seatsTaken = c.seats_taken ?? 0
      return {
        id: c.id,
        title: c.topic ?? "",
        description: c.description ?? null,
        scheduled_at: c.starts_at ?? null,
        duration_minutes: c.duration_min ?? 60,
        level: c.level_min ?? null,
        category: c.category ?? null,
        format: c.format ?? null,
        location: c.location ?? null,
        cover_emoji: c.cover_emoji ?? null,
        capacity,
        registered_count: seatsTaken,
        seats_remaining: Math.max(capacity - seatsTaken, 0),
        is_full: seatsTaken >= capacity,
        status,
        seen_at: seenById.get(c.id) ?? null,
        is_unseen: !seenById.get(c.id),
        participants: partsByClub.get(c.id) ?? [],
      }
    })

    const unread_count = enriched.filter((c) => c.is_unseen).length

    return NextResponse.json({ clubs: enriched, unread_count })
  } catch (err) {
    console.error("Ошибка в GET /api/teacher/clubs:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
