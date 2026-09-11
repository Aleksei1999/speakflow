// POST /api/admin/students/[id]/reset-password — админ сбрасывает пароль ученика.
// Генерируем случайный пароль (12 символов), ставим через service role
// (auth.admin.updateUserById), пишем в audit log и возвращаем пароль ОДИН раз
// в ответе — в БД в открытом виде он нигде не хранится.

import { randomInt } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { logAuditEvent } from "@/lib/audit/log"

export const dynamic = "force-dynamic"

const idSchema = z.string().uuid()

// Без похожих символов (0/O, 1/l/I), чтобы пароль можно было продиктовать.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
function generatePassword(length = 12): string {
  let out = ""
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id: rawId } = await params
    const parsed = idSchema.safeParse(rawId)
    if (!parsed.success) return NextResponse.json({ error: "Некорректный id" }, { status: 400 })
    const id = parsed.data

    const admin = createAdminClient()
    // Сбрасываем только ученикам: учителей/админов через эту ручку трогать нельзя.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, email")
      .eq("id", id)
      .maybeSingle<{ id: string; role: string | null; email: string | null }>()
    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Ученик не найден" }, { status: 404 })
    }

    const password = generatePassword(12)
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) {
      console.error("admin/students/[id]/reset-password:", error)
      return NextResponse.json({ error: "Не удалось сбросить пароль" }, { status: 500 })
    }

    await logAuditEvent(request, {
      category: "admin",
      action: "student_password_reset",
      target_type: "auth.users",
      target_id: id,
      payload: { admin_id: gate.user.id, student_email: profile.email },
    })

    return NextResponse.json({ ok: true, password })
  } catch (err) {
    console.error("Ошибка в /api/admin/students/[id]/reset-password:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
