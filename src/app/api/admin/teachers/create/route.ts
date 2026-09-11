import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { randomInt } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { logAuditEvent } from "@/lib/audit/log"
import { invalidateAdminTeachersList } from "@/lib/cache/invalidate"
import { transliterateRu } from "@/lib/transliterate"

// POST /api/admin/teachers/create — админ заводит преподавателя.
// Возвращает одноразовые логин и пароль; при первом входе преподаватель
// обязан задать свою почту и пароль (profiles.credentials_pending).

const BodySchema = z.object({
  fullName: z.string().trim().min(2, "Введите имя и фамилию").max(120),
  phone: z.string().trim().max(32).optional().nullable(),
})

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const rand = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Некорректные данные" }, { status: 400 })
  const { fullName, phone } = parsed.data

  const login = `teacher-${rand(6)}@login.raw-english.com`
  const password = `${rand(4)}-${rand(4)}-${rand(4)}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: login,
    password,
    email_confirm: true,
    user_metadata: { full_name: transliterateRu(fullName), full_name_ru: fullName, role: "teacher" },
  })
  if (createErr || !created?.user) {
    console.error("[admin/teachers/create] createUser", createErr)
    return NextResponse.json({ error: "Не удалось создать аккаунт" }, { status: 500 })
  }
  const userId: string = created.user.id

  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    email: login,
    role: "teacher",
    full_name: transliterateRu(fullName),
    full_name_ru: fullName,
    phone: phone || null,
    is_active: true,
    email_verified: true,
    credentials_pending: true,
  })
  if (profErr) {
    console.error("[admin/teachers/create] profile", profErr)
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return NextResponse.json({ error: "Не удалось создать профиль" }, { status: 500 })
  }
  const { error: tpErr } = await admin.from("teacher_profiles").upsert({ user_id: userId, hourly_rate: 0, is_listed: true, is_verified: true }, { onConflict: "user_id" })
  if (tpErr) {
    console.error("[admin/teachers/create] teacher_profiles", tpErr)
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    return NextResponse.json({ error: "Не удалось создать карточку преподавателя" }, { status: 500 })
  }

  invalidateAdminTeachersList()
  await logAuditEvent(request, { category: "data", action: "teacher_created_by_admin", target_type: "profiles", target_id: userId, payload: { full_name: fullName } })
  return NextResponse.json({ ok: true, userId, login, password })
}
