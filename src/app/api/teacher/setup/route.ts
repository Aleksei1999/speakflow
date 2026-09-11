import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { emailSchema } from "@/lib/validators/contact"
import { PASSWORD_MIN } from "@/lib/validations"

// POST /api/teacher/setup — преподаватель, созданный админом, задаёт свою
// почту и пароль вместо временных. Доступно только пока credentials_pending.

const BodySchema = z.object({
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN, `Пароль не короче ${PASSWORD_MIN} символов`).max(72),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 })

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Некорректные данные" }, { status: 400 })
  const { email, password } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: profile } = await admin.from("profiles").select("role, credentials_pending").eq("id", user.id).maybeSingle()
  if (!profile || profile.role !== "teacher" || !profile.credentials_pending) {
    return NextResponse.json({ error: "Данные для входа уже заданы" }, { status: 409 })
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, { email, password, email_confirm: true })
  if (authErr) {
    const taken = /already|exists|registered/i.test(authErr.message ?? "")
    return NextResponse.json({ error: taken ? "Такая почта уже используется" : "Не удалось сохранить данные" }, { status: taken ? 409 : 500 })
  }
  const { error: profErr } = await admin.from("profiles").update({ email, email_verified: true, credentials_pending: false }).eq("id", user.id)
  if (profErr) {
    console.error("[teacher/setup] profile", profErr)
    return NextResponse.json({ error: "Не удалось сохранить профиль" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
