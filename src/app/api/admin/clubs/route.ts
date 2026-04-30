// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

// ---------------------------------------------------------------
// GET  /api/admin/clubs?limit=50&status=upcoming|past|draft
// POST /api/admin/clubs  — create club (admin)
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

function normalizeClub(c: any) {
  if (!c) return c
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
  return {
    ...c,
    title: c.topic ?? c.title ?? "",
    scheduled_at: c.starts_at ?? c.scheduled_at ?? null,
    duration_minutes: c.duration_min ?? c.duration_minutes ?? 60,
    level: c.level_min ?? c.level ?? null,
    status,
    capacity,
    registered_count: seatsTaken,
    seats_remaining: Math.max(capacity - seatsTaken, 0),
    is_full: seatsTaken >= capacity,
    host_teacher_id: host?.id ?? null,
    host_teacher_name: host?.full_name ?? null,
  }
}

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

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(["upcoming", "past", "draft"]).optional(),
})

const createSchema = z.object({
  title: z.string().trim().min(1, "Название обязательно").max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  scheduled_at: z.string().datetime({ message: "Некорректная дата" }),
  duration_minutes: z.coerce.number().int().min(5).max(480).default(60),
  capacity: z.coerce.number().int().min(1).max(15).optional().default(15),
  host_teacher_id: z.string().uuid().optional().nullable(),
  level: z.enum(ROAST_LEVELS).optional().nullable(),
  category: z.enum(CATEGORIES).optional().default("speaking"),
  format: z.enum(["online", "offline"]).optional().default("online"),
  location: z.string().trim().max(200).optional().nullable(),
  price_kopecks: z.coerce.number().int().min(0).optional().default(0),
  cover_emoji: z.string().trim().max(10).optional().nullable(),
  is_published: z.boolean().optional().default(true),
})

// ---------------------------------------------------------------
// GET
// ---------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const { searchParams } = new URL(request.url)
    const parsed = listQuerySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные параметры" },
        { status: 400 }
      )
    }
    const { limit, status } = parsed.data

    const admin = createAdminClient()

    let q = admin
      .from("clubs")
      .select(
        `
          id, topic, description, category, format, location, timezone,
          starts_at, duration_min, max_seats, seats_taken, capacity,
          price_kopecks, xp_reward, badge, cover_emoji,
          is_published, cancelled_at, assigned_by, created_by_role,
          level_min, level_max, created_at, updated_at,
          club_hosts (
            role, sort_order,
            host:profiles!club_hosts_host_id_fkey ( id, full_name, avatar_url )
          )
        `
      )
      .limit(limit)

    const nowIso = new Date().toISOString()
    if (status === "upcoming") {
      q = q.gt("starts_at", nowIso).is("cancelled_at", null).order("starts_at", { ascending: true })
    } else if (status === "past") {
      q = q.lt("starts_at", nowIso).order("starts_at", { ascending: false })
    } else if (status === "draft") {
      q = q.eq("is_published", false).order("created_at", { ascending: false })
    } else {
      q = q.order("starts_at", { ascending: false })
    }

    const { data, error } = await q
    if (error) {
      console.error("admin/clubs GET error:", error)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }

    const clubIds = (data ?? []).map((c: any) => c.id)
    const participantsByClub = new Map<string, any[]>()
    if (clubIds.length) {
      const { data: regs, error: regErr } = await admin
        .from("club_registrations")
        .select(
          "club_id, status, registered_at, user:profiles!club_registrations_user_id_fkey(id, full_name, avatar_url, email)"
        )
        .in("club_id", clubIds)
        .in("status", ["registered", "pending_payment", "attended", "waitlist"])
        .order("registered_at", { ascending: true })
      if (regErr) {
        console.error("admin/clubs GET participants error:", regErr)
      }
      for (const r of regs ?? []) {
        const arr = participantsByClub.get(r.club_id) ?? []
        arr.push({
          id: r.user?.id ?? null,
          full_name: r.user?.full_name ?? null,
          avatar_url: r.user?.avatar_url ?? null,
          email: r.user?.email ?? null,
          status: r.status,
          registered_at: r.registered_at,
        })
        participantsByClub.set(r.club_id, arr)
      }
    }

    const enriched = (data ?? []).map((c: any) => ({
      ...normalizeClub(c),
      participants: participantsByClub.get(c.id) ?? [],
    }))

    return NextResponse.json({ clubs: enriched, count: enriched.length })
  } catch (err) {
    console.error("Ошибка в GET /api/admin/clubs:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// POST
// ---------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
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

    const parsed = createSchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }
    const d = parsed.data

    const admin = createAdminClient()
    const capacity = Math.max(1, Math.min(d.capacity ?? 15, 15))

    const insertPayload: Record<string, any> = {
      topic: d.title,
      description: d.description ?? null,
      category: d.category,
      format: d.format,
      location: d.location ?? null,
      starts_at: d.scheduled_at,
      duration_min: d.duration_minutes,
      max_seats: capacity,
      capacity,
      price_kopecks: d.price_kopecks ?? 0,
      cover_emoji: d.cover_emoji ?? null,
      is_published: d.is_published ?? true,
      level_min: d.level ?? null,
      level_max: d.level ?? null,
      assigned_by: gate.user.id,
      created_by_role: "admin",
      created_by: gate.user.id,
    }

    const { data: club, error } = await admin
      .from("clubs")
      .insert(insertPayload)
      .select(
        `
          *,
          club_hosts (
            role, sort_order,
            host:profiles!club_hosts_host_id_fkey ( id, full_name, avatar_url )
          )
        `
      )
      .single()

    if (error) {
      console.error("admin/clubs POST error:", error)
      return NextResponse.json(
        { error: "Не удалось создать клаб" },
        { status: 500 }
      )
    }

    // Attach host (teacher) if provided.
    let hostRow: any = null
    if (d.host_teacher_id) {
      const { error: hostErr } = await admin
        .from("club_hosts")
        .insert({ club_id: club.id, host_id: d.host_teacher_id, role: "host" })
      if (hostErr) {
        console.error("admin/clubs POST host insert error:", hostErr)
      } else {
        const { data: host } = await admin
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", d.host_teacher_id)
          .maybeSingle()
        hostRow = host
          ? { role: "host", sort_order: 0, host }
          : null
      }
    }

    const enriched = normalizeClub({
      ...club,
      club_hosts: hostRow ? [hostRow] : club.club_hosts ?? [],
    })

    return NextResponse.json({ club: enriched }, { status: 201 })
  } catch (err) {
    console.error("Ошибка в POST /api/admin/clubs:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
