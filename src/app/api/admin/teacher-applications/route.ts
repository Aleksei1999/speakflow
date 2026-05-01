// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/teacher-applications?status=&limit=
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const limit = Math.max(
      1,
      Math.min(500, Number(searchParams.get("limit") || 200))
    )

    const admin = createAdminClient()
    let q = admin
      .from("teacher_applications")
      .select(
        "id, first_name, last_name, email, contact, notes, status, reviewed_by, reviewed_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit)
    if (status && status !== "all") {
      q = q.eq("status", status)
    }

    const { data, error } = await q
    if (error) {
      console.error("admin/teacher-applications GET error:", error)
      return NextResponse.json({ error: "Ошибка БД" }, { status: 500 })
    }

    return NextResponse.json({ applications: data ?? [] })
  } catch (err) {
    console.error("GET /api/admin/teacher-applications:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
