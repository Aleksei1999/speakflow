// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

// ---------------------------------------------------------------
// POST /api/admin/clubs/[id]/assign
// Body: { student_ids: string[] }
// Admin: assigns one or more students to a club (status='registered').
// - Skips students already registered (any seat-holding status).
// - Enforces capacity at the row level (DB trigger) AND up-front here.
// Returns: { assigned: string[], skipped_already: string[], skipped_full: string[] }
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  student_ids: z
    .array(z.string().uuid("Некорректный id ученика"))
    .min(1, "Нужно передать хотя бы одного ученика")
    .max(50, "Слишком много за один раз"),
})

export async function POST(
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
    const parsed = bodySchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }
    const uniqueIds = Array.from(new Set(parsed.data.student_ids))

    const admin = createAdminClient()

    // Load club to check capacity + existence.
    const { data: club, error: clubErr } = await admin
      .from("clubs")
      .select("id, capacity, max_seats, seats_taken, cancelled_at")
      .eq("id", id)
      .maybeSingle()
    if (clubErr) {
      console.error("assign: load club error:", clubErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    if (!club) {
      return NextResponse.json({ error: "Клаб не найден" }, { status: 404 })
    }
    if (club.cancelled_at) {
      return NextResponse.json({ error: "Клаб отменён" }, { status: 400 })
    }

    const capacity = club.capacity ?? club.max_seats ?? 15

    // Existing registrations that already hold a seat.
    const { data: existingRows, error: exErr } = await admin
      .from("club_registrations")
      .select("user_id, status")
      .eq("club_id", id)
      .in("status", ["registered", "pending_payment", "attended", "waitlist"])
    if (exErr) {
      console.error("assign: load existing error:", exErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    const alreadyIn = new Set((existingRows ?? []).map((r) => r.user_id))
    const takenSeats = (existingRows ?? []).filter((r) =>
      ["registered", "pending_payment", "attended"].includes(r.status)
    ).length

    const skippedAlready: string[] = []
    const skippedFull: string[] = []
    const assigned: string[] = []

    let seatsLeft = Math.max(capacity - takenSeats, 0)

    for (const studentId of uniqueIds) {
      if (alreadyIn.has(studentId)) {
        skippedAlready.push(studentId)
        continue
      }
      if (seatsLeft <= 0) {
        skippedFull.push(studentId)
        continue
      }

      const { error: insErr } = await admin
        .from("club_registrations")
        .insert({
          club_id: id,
          user_id: studentId,
          status: "registered",
          registered_at: new Date().toISOString(),
          notes: "assigned_by_admin",
        })

      if (insErr) {
        // Trigger raises check_violation when DB-side count sees full.
        if (
          insErr.code === "23514" ||
          /заполнен/i.test(insErr.message ?? "")
        ) {
          skippedFull.push(studentId)
          seatsLeft = 0
          continue
        }
        console.error("assign: insert error:", insErr)
        return NextResponse.json(
          { error: "Не удалось назначить ученика" },
          { status: 500 }
        )
      }
      assigned.push(studentId)
      seatsLeft--
    }

    return NextResponse.json({
      assigned,
      skipped_already: skippedAlready,
      skipped_full: skippedFull,
    })
  } catch (err) {
    console.error("Ошибка в POST /api/admin/clubs/[id]/assign:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
