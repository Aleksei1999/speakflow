// ============================================================
// GET /api/teacher/dashboard
// ------------------------------------------------------------
// Тонкая HTTP-обёртка над `getCachedTeacherDashboard(userId)`.
// Используется client-hook'ом useTeacherDashboard для пополнения
// TanStack Query кэша при cross-tab переключении в dashboard.
//
// Auth: only authenticated user with role='teacher' (или admin —
//   admin тоже может посмотреть свой teacher dashboard в принципе,
//   но reality: для admin'а оторван teacher_profile, RPC вернёт null).
// Rate-limit: 60 req / 60s по user.id (fail-open — read-only).
//
// Не делаем второй DB-roundtrip за role — RPC сам валидирует
// auth.uid() (SECURITY DEFINER), а нерелевантный teacher_profile
// просто вернёт null payload. Это безопасно: даже если студент
// случайно попадёт сюда — увидит пустой объект, не чужие данные.
// ============================================================
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedTeacherDashboard } from "@/lib/dashboard/teacher"
import { enforceRateLimit, getClientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      )
    }

    const limited = await enforceRateLimit(request, {
      name: "api:teacher-dashboard",
      keyParts: [user.id, getClientIp(request)],
      max: 60,
      windowSeconds: 60,
    })
    if (limited) return limited

    const data = await getCachedTeacherDashboard(user.id)
    return NextResponse.json(data, {
      headers: {
        // Браузер всегда обращается к API за свежими данными, но
        // server-side `unstable_cache` (TTL 30s) внутри
        // getCachedTeacherDashboard всё равно отвечает мгновенно.
        // TanStack Query сам кэширует на клиенте — HTTP-кэш конфликтует.
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    console.error("[api/teacher/dashboard]", err)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }
}
