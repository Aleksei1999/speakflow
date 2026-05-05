// @ts-nocheck
// POST /api/admin/teacher-applications/[id]/approve
// Создаёт пользователя-преподавателя из заявки, генерирует пароль,
// высылает учётные данные на почту через Resend.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { sendEmail } from "@/lib/resend/client"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  // Email можно переопределить (вдруг в заявке опечатка). По умолчанию
  // используется тот, что указал учитель.
  email: z.string().trim().email().max(255).optional(),
})

function generatePassword(len = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let p = ""
  const arr = new Uint32Array(len)
  // crypto.getRandomValues есть в Edge/Node 19+
  if (typeof crypto !== "undefined" && (crypto as any).getRandomValues) {
    ;(crypto as any).getRandomValues(arr)
    for (let i = 0; i < len; i++) p += chars[arr[i] % chars.length]
  } else {
    for (let i = 0; i < len; i++) p += chars[Math.floor(Math.random() * chars.length)]
  }
  return p
}

function welcomeHtml(args: {
  fullName: string
  email: string
  password: string
  loginUrl: string
}): string {
  const { fullName, email, password, loginUrl } = args
  return `<!doctype html><html lang="ru"><body style="margin:0;background:#FAF7F2;font-family:Arial,Helvetica,sans-serif;color:#0A0A0A;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid rgba(0,0,0,.08)">
    <h1 style="font-size:22px;letter-spacing:-.5px;margin:0 0 12px">Добро пожаловать в Raw English, ${fullName}!</h1>
    <p style="font-size:14px;color:#444;line-height:1.5;margin:0 0 18px">Твоя заявка одобрена. Мы создали аккаунт преподавателя — данные для входа ниже.</p>
    <div style="background:#FAF7F2;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:16px;margin-bottom:18px">
      <div style="font-size:11px;color:#6B6B6B;text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:6px">Логин (email)</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:14px">${email}</div>
      <div style="font-size:11px;color:#6B6B6B;text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:6px">Временный пароль</div>
      <div style="font-size:16px;font-weight:800;font-family:Menlo,monospace;letter-spacing:.5px;background:#fff;padding:10px 14px;border-radius:8px;border:1px dashed rgba(230,57,70,.3);display:inline-block">${password}</div>
    </div>
    <a href="${loginUrl}" style="display:inline-block;background:#E63946;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:14px;box-shadow:0 3px 0 rgba(180,30,45,.3)">Войти на платформу</a>
    <p style="font-size:12px;color:#6B6B6B;line-height:1.5;margin:24px 0 0">После первого входа рекомендуем сменить пароль в настройках профиля. Если письмо пришло вам по ошибке — проигнорируйте его.</p>
  </div>
</body></html>`
}

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

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // 1. Резолвим заявку.
    const { data: app, error: appErr } = await admin
      .from("teacher_applications")
      .select("id, first_name, last_name, email, contact, status, notes")
      .eq("id", id)
      .maybeSingle()
    if (appErr) {
      console.error("[approve] application select failed", appErr)
      return NextResponse.json({ error: "Ошибка БД" }, { status: 500 })
    }
    if (!app) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })
    }
    if (app.status === "approved") {
      return NextResponse.json(
        { error: "Заявка уже одобрена" },
        { status: 409 }
      )
    }

    const targetEmail = (parsed.data.email || app.email || "").trim().toLowerCase()
    if (!targetEmail) {
      return NextResponse.json(
        { error: "Email обязателен — в заявке пусто, укажи новый." },
        { status: 400 }
      )
    }

    const fullName = [app.first_name, app.last_name].filter(Boolean).join(" ").trim() || targetEmail
    const password = generatePassword(12)

    // 2. Создаём auth-юзера. handle_new_user (мигр 032/048) сам сделает
    //    profiles+user_progress; передаём role=teacher через user_metadata.
    let userId: string | null = null
    let userExisted = false
    const createRes = await admin.auth.admin.createUser({
      email: targetEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: app.first_name,
        last_name: app.last_name,
        role: "teacher",
        phone: app.contact ?? null,
      },
    })
    if (createRes.error) {
      // 422 «User already registered» — ищем существующего и поднимаем роль.
      const msg = String(createRes.error.message || "").toLowerCase()
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        userExisted = true
        // Найдём profile по email.
        const { data: existingProfile } = await admin
          .from("profiles")
          .select("id")
          .eq("email", targetEmail)
          .maybeSingle()
        if (existingProfile?.id) {
          userId = existingProfile.id
          // Обновим пароль на новый сгенерированный.
          await admin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
            user_metadata: { role: "teacher" },
          })
        } else {
          console.error("[approve] user_already_registered but profile not found", { email: targetEmail })
          return NextResponse.json(
            { error: "Email уже занят, но профиль не найден. Свяжитесь с разработчиком." },
            { status: 409 }
          )
        }
      } else {
        console.error("[approve] createUser failed", createRes.error)
        return NextResponse.json(
          { error: createRes.error.message || "Не удалось создать пользователя" },
          { status: 500 }
        )
      }
    } else {
      userId = createRes.data.user?.id ?? null
    }

    if (!userId) {
      return NextResponse.json({ error: "Не удалось получить id пользователя" }, { status: 500 })
    }

    // 3. Поднимаем роль до teacher (handle_new_user мог по дефолту student).
    await admin
      .from("profiles")
      .update({ role: "teacher", full_name: fullName, email: targetEmail })
      .eq("id", userId)

    // 4. Создаём teacher_profiles, если нет.
    const { data: existingTp } = await admin
      .from("teacher_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
    if (!existingTp) {
      await admin.from("teacher_profiles").insert({
        user_id: userId,
        bio: null,
        specializations: [],
        experience_years: 0,
        hourly_rate: 100000, // 1000 RUB по умолчанию (kopeks)
        languages: ["ru", "en"],
        rating: 0,
        total_reviews: 0,
        total_lessons: 0,
        is_verified: true,
        is_listed: true,
      })
    }

    // 5. Помечаем заявку approved.
    await admin
      .from("teacher_applications")
      .update({
        status: "approved",
        reviewed_by: gate.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)

    // 6. Шлём письмо с креденшелами.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://raw-english.com"
    const loginUrl = `${siteUrl}/login`
    const emailRes = await sendEmail({
      to: targetEmail,
      subject: "Добро пожаловать в Raw English — данные для входа",
      html: welcomeHtml({ fullName, email: targetEmail, password, loginUrl }),
    })

    return NextResponse.json({
      ok: true,
      userId,
      email: targetEmail,
      userExisted,
      emailSent: emailRes.success,
      emailError: emailRes.success ? null : emailRes.error,
    })
  } catch (err) {
    console.error("POST /api/admin/teacher-applications/[id]/approve:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
