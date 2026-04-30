// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { notifyClubHostAssigned } from "@/lib/clubs/notify-host"

// ---------------------------------------------------------------
// PATCH /api/admin/clubs/[id]
// Body: { title?, description?, scheduled_at?, duration_minutes?,
//         capacity?, level?, category?, format?, location?,
//         price_kopecks?, cover_emoji?, is_published?, cancelled? }
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const ROAST_LEVELS = [
  "Raw",
  "Rare",
  "Medium Rare",
  "Medium",
  "Medium Well",
  "Well Done",
] as const

const CATEGORIES = [
  "speaking",
  "business",
  "movies",
  "debate",
  "wine",
  "career",
  "community",
  "storytelling",
  "smalltalk",
  "other",
] as const

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).optional().nullable(),
    scheduled_at: z.string().datetime().optional(),
    duration_minutes: z.coerce.number().int().min(5).max(480).optional(),
    capacity: z.coerce.number().int().min(1).max(15).optional(),
    level: z.enum(ROAST_LEVELS).optional().nullable(),
    category: z.enum(CATEGORIES).optional(),
    format: z.enum(["online", "offline"]).optional(),
    location: z.string().trim().max(200).optional().nullable(),
    price_kopecks: z.coerce.number().int().min(0).optional(),
    cover_emoji: z.string().trim().max(10).optional().nullable(),
    is_published: z.boolean().optional(),
    cancelled: z.boolean().optional(),
    host_teacher_id: z.string().uuid().optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Нужно передать хотя бы одно поле",
  })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Некорректный id" }, { status: 400 })
    }

    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const parsed = patchSchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }
    const d = parsed.data

    // Lock editing once a club has started — only `cancelled` toggle is allowed.
    {
      const adminCheck = createAdminClient()
      const { data: existing } = await adminCheck
        .from("clubs")
        .select("starts_at")
        .eq("id", id)
        .maybeSingle()
      if (!existing) {
        return NextResponse.json({ error: "Клаб не найден" }, { status: 404 })
      }
      const startedMs = new Date(existing.starts_at).getTime()
      if (startedMs <= Date.now()) {
        const allowed = new Set(["cancelled"])
        const blocked = Object.keys(d).filter((k) => !allowed.has(k))
        if (blocked.length > 0) {
          return NextResponse.json(
            {
              error:
                "Клуб уже начался — можно только отменить, но не редактировать.",
            },
            { status: 409 }
          )
        }
      }
    }

    const update: Record<string, any> = {}
    if (d.title !== undefined) update.topic = d.title
    if (d.description !== undefined) update.description = d.description
    if (d.scheduled_at !== undefined) update.starts_at = d.scheduled_at
    if (d.duration_minutes !== undefined) update.duration_min = d.duration_minutes
    if (d.capacity !== undefined) {
      const c = Math.max(1, Math.min(d.capacity, 15))
      update.capacity = c
      update.max_seats = c
    }
    if (d.level !== undefined) {
      update.level_min = d.level
      update.level_max = d.level
    }
    if (d.category !== undefined) update.category = d.category
    if (d.format !== undefined) update.format = d.format
    if (d.location !== undefined) update.location = d.location
    if (d.price_kopecks !== undefined) update.price_kopecks = d.price_kopecks
    if (d.cover_emoji !== undefined) update.cover_emoji = d.cover_emoji
    if (d.is_published !== undefined) update.is_published = d.is_published
    if (d.cancelled !== undefined) {
      update.cancelled_at = d.cancelled ? new Date().toISOString() : null
    }

    const admin = createAdminClient()

    // Handle host change separately: club_hosts is a side-table.
    let hostChangedTo: string | null | undefined = undefined
    if (d.host_teacher_id !== undefined) {
      const { data: existingHosts } = await admin
        .from("club_hosts")
        .select("host_id")
        .eq("club_id", id)
        .order("sort_order", { ascending: true })
      const currentHostId = existingHosts?.[0]?.host_id ?? null

      if (d.host_teacher_id === null) {
        if (currentHostId) {
          await admin.from("club_hosts").delete().eq("club_id", id)
          hostChangedTo = null
        }
      } else {
        // Resolve teacher_profiles.id → profiles.id if needed.
        let resolvedHostId: string = d.host_teacher_id
        const { data: profileMatch } = await admin
          .from("profiles")
          .select("id")
          .eq("id", d.host_teacher_id)
          .maybeSingle()
        if (!profileMatch) {
          const { data: tpRow } = await admin
            .from("teacher_profiles")
            .select("user_id")
            .eq("id", d.host_teacher_id)
            .maybeSingle()
          if (tpRow?.user_id) resolvedHostId = tpRow.user_id
        }

        if (resolvedHostId !== currentHostId) {
          await admin.from("club_hosts").delete().eq("club_id", id)
          const { error: hErr } = await admin.from("club_hosts").insert({
            club_id: id,
            host_id: resolvedHostId,
            role: "host",
          })
          if (!hErr) {
            hostChangedTo = resolvedHostId
          } else {
            console.error("PATCH admin/clubs host insert error:", hErr)
          }
        }
      }
    }

    const { data, error } = await admin
      .from("clubs")
      .update(update)
      .eq("id", id)
      .select(
        `
          *,
          club_hosts (
            role, sort_order,
            host:profiles!club_hosts_host_id_fkey ( id, full_name, avatar_url )
          )
        `
      )
      .maybeSingle()

    if (error) {
      console.error("PATCH admin/clubs error:", error)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Клаб не найден" }, { status: 404 })
    }

    const c: any = data
    const cancelled = !!c.cancelled_at
    const status = cancelled
      ? "cancelled"
      : c.is_published
      ? "published"
      : "draft"
    const host = Array.isArray(c.club_hosts) && c.club_hosts.length
      ? c.club_hosts[0]?.host
      : null
    const capacity = c.capacity ?? c.max_seats ?? 0
    const seatsTaken = c.seats_taken ?? 0

    const enriched = {
      ...c,
      title: c.topic ?? "",
      scheduled_at: c.starts_at ?? null,
      duration_minutes: c.duration_min ?? 60,
      level: c.level_min ?? null,
      status,
      capacity,
      registered_count: seatsTaken,
      seats_remaining: Math.max(capacity - seatsTaken, 0),
      is_full: seatsTaken >= capacity,
      host_teacher_id: host?.id ?? null,
      host_teacher_name: host?.full_name ?? null,
    }

    // Notify newly-assigned teacher (and admins) AFTER the club row is up to date.
    if (hostChangedTo) {
      void notifyClubHostAssigned({
        clubId: id,
        hostUserId: hostChangedTo,
        assignedByUserId: gate.user.id,
      }).catch(() => {})
    }

    return NextResponse.json({ club: enriched })
  } catch (err) {
    console.error("Ошибка в PATCH /api/admin/clubs/[id]:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
