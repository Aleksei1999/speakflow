// ============================================================
// GET /api/student/dashboard
// ------------------------------------------------------------
// Тонкая HTTP-обёртка над `getCachedStudentDashboard(userId)`.
// Используется client-hook'ом useStudentDashboard для пополнения
// TanStack Query кэша при cross-tab переключении в dashboard.
//
// Auth: only authenticated user.
// Rate-limit: 30 req / 60s по user.id (fail-open — это read-only
// endpoint, дёшево, нет смысла блокировать на инфра-сбое).
// ============================================================
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedStudentDashboard } from "@/lib/dashboard/student"
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
      name: "student:dashboard",
      keyParts: [user.id, getClientIp(request)],
      max: 30,
      windowSeconds: 60,
    })
    if (limited) return limited

    const data = await getCachedStudentDashboard(user.id)
    return NextResponse.json(data, {
      headers: {
        // Браузер всегда обращается к API за свежими данными, но
        // server-side `unstable_cache` (TTL 30s) внутри
        // getCachedStudentDashboard всё равно отвечает мгновенно.
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    console.error("[api/student/dashboard]", err)
    return NextResponse.json(
      { error: "Не удалось загрузить дашборд" },
      { status: 500 }
    )
  }
}
