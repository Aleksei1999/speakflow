// ============================================================
// GET /api/student/schedule
// ------------------------------------------------------------
// Aggregator для /student/schedule вкладки. Текущая page.tsx
// делает свои запросы напрямую к Supabase в браузере — этот
// endpoint существует ТОЛЬКО для TanStack Query prefetch'а
// (DashboardShell), чтобы при первом заходе на /student/schedule
// у клиента уже был tepid snapshot и spinner не показывался.
//
// Снапшот: lessons этого студента в окне [now-30d, now+90d],
// плюс минимальный teacher-map для отображения имени/аватара.
// Сортировка по scheduled_at desc.
//
// Auth: only authenticated user. Без role-check — student/teacher
//   оба могут зайти на /student/schedule (учитель в роли студента
//   тоже бывает); RPC внутри cached-loader сам отсекает чужие
//   уроки через `eq('student_id', userId)`.
// Rate-limit: 60 req / 60s, fail-open.
// ============================================================
import 'server-only'
import { NextRequest, NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enforceRateLimit, getClientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

// Тэг совместим с lesson-mutation'ами: каждый раз когда урок
// бронируется/отменяется, мутирующий endpoint уже инвалидирует
// `student-dashboard-${uid}`. Чтобы не плодить новые tag'и в
// invalidate-helper, используем тот же.
const scheduleTag = (uid: string) => `student-dashboard-${uid}`

export type StudentScheduleLesson = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  jitsi_room_name: string | null
  teacher_id: string | null
  teacher_user_id: string | null
  teacher_name: string | null
  teacher_avatar: string | null
}

export type StudentScheduleSnapshot = {
  lessons: StudentScheduleLesson[]
  generated_at: string
}

// Окно: history -30d, upcoming +90d. Достаточно для weekly grid
// + recent past чтобы клиент мог рендерить "completed" статус.
const HISTORY_DAYS = 30
const FUTURE_DAYS = 90

async function loadStudentScheduleImpl(
  userId: string
): Promise<StudentScheduleSnapshot> {
  const admin = createAdminClient()
  const now = Date.now()
  const from = new Date(now - HISTORY_DAYS * 86_400_000).toISOString()
  const to = new Date(now + FUTURE_DAYS * 86_400_000).toISOString()

  // 1) Уроки студента в окне.
  const { data: lessons, error } = await (admin as any)
    .from("lessons")
    .select(
      "id, scheduled_at, duration_minutes, status, jitsi_room_name, teacher_id"
    )
    .eq("student_id", userId)
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .order("scheduled_at", { ascending: false })
    .limit(500)

  if (error) {
    console.error("[student/schedule] lessons select failed", error)
    return { lessons: [], generated_at: new Date().toISOString() }
  }

  const list = (lessons ?? []) as any[]
  const teacherIds = Array.from(
    new Set(list.map((l) => l.teacher_id).filter(Boolean))
  )

  if (teacherIds.length === 0) {
    return {
      lessons: list.map((l) => ({
        id: l.id,
        scheduled_at: l.scheduled_at,
        duration_minutes: l.duration_minutes,
        status: l.status,
        jitsi_room_name: l.jitsi_room_name ?? null,
        teacher_id: l.teacher_id ?? null,
        teacher_user_id: null,
        teacher_name: null,
        teacher_avatar: null,
      })),
      generated_at: new Date().toISOString(),
    }
  }

  // 2) teacher_profiles → profiles одним embed (как делает page.tsx).
  const { data: teachersRaw } = await (admin as any)
    .from("teacher_profiles")
    .select(
      "id, user_id, user:profiles!teacher_profiles_user_id_fkey(full_name, avatar_url)"
    )
    .in("id", teacherIds)

  const tmap = new Map<
    string,
    { user_id: string; full_name: string | null; avatar_url: string | null }
  >()
  for (const t of (teachersRaw ?? []) as any[]) {
    const p = Array.isArray(t.user) ? t.user[0] : t.user
    tmap.set(t.id, {
      user_id: t.user_id,
      full_name: p?.full_name ?? null,
      avatar_url: p?.avatar_url ?? null,
    })
  }

  return {
    lessons: list.map((l) => {
      const t = l.teacher_id ? tmap.get(l.teacher_id) : null
      return {
        id: l.id,
        scheduled_at: l.scheduled_at,
        duration_minutes: l.duration_minutes,
        status: l.status,
        jitsi_room_name: l.jitsi_room_name ?? null,
        teacher_id: l.teacher_id ?? null,
        teacher_user_id: t?.user_id ?? null,
        teacher_name: t?.full_name ?? null,
        teacher_avatar: t?.avatar_url ?? null,
      }
    }),
    generated_at: new Date().toISOString(),
  }
}

function getCachedStudentSchedule(
  userId: string
): Promise<StudentScheduleSnapshot> {
  return unstable_cache(
    async (uid: string) => loadStudentScheduleImpl(uid),
    ["student-schedule", userId],
    { tags: [scheduleTag(userId)], revalidate: 60 }
  )(userId)
}

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
      name: "api:student-schedule",
      keyParts: [user.id, getClientIp(request)],
      max: 60,
      windowSeconds: 60,
    })
    if (limited) return limited

    const data = await getCachedStudentSchedule(user.id)
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    console.error("[api/student/schedule]", err)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }
}
