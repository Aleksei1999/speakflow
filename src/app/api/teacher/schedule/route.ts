// ============================================================
// GET /api/teacher/schedule
// ------------------------------------------------------------
// Aggregator для /teacher/schedule вкладки. Page.tsx делает свои
// запросы в браузере — этот endpoint для TanStack prefetch'а в
// DashboardShell. Снапшот: уроки этого преподавателя в окне
// [now-30d, now+90d] + минимальный student-map (имя/аватар).
//
// Auth: only authenticated user. Без role-check — фильтр по
//   teacher_profiles.user_id = userId сам отсекает чужие данные:
//   если у юзера нет teacher_profile, вернётся пустой массив.
// Rate-limit: 60 req / 60s, fail-open.
// ============================================================
import 'server-only'
import { NextRequest, NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enforceRateLimit, getClientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

// Используем существующий tag — на мутации урока invalidate-helper
// уже сбрасывает `teacher-dashboard-${uid}`. Не плодим новый tag,
// чтобы не дополнять invalidate.ts на каждый booking/cancel.
const scheduleTag = (uid: string) => `teacher-dashboard-${uid}`

export type TeacherScheduleLesson = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  jitsi_room_name: string | null
  student_id: string | null
  student_name: string | null
  student_avatar: string | null
}

export type TeacherScheduleSnapshot = {
  teacher_profile_id: string | null
  lessons: TeacherScheduleLesson[]
  generated_at: string
}

const HISTORY_DAYS = 30
const FUTURE_DAYS = 90

async function loadTeacherScheduleImpl(
  userId: string
): Promise<TeacherScheduleSnapshot> {
  const admin = createAdminClient()

  // 1) teacher_profile_id из user_id.
  const { data: tp, error: tpErr } = await (admin as any)
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()
  if (tpErr) {
    console.error("[teacher/schedule] teacher_profile select failed", tpErr)
    return {
      teacher_profile_id: null,
      lessons: [],
      generated_at: new Date().toISOString(),
    }
  }
  const tpId = tp?.id ?? null
  if (!tpId) {
    return {
      teacher_profile_id: null,
      lessons: [],
      generated_at: new Date().toISOString(),
    }
  }

  // 2) Уроки в окне.
  const now = Date.now()
  const from = new Date(now - HISTORY_DAYS * 86_400_000).toISOString()
  const to = new Date(now + FUTURE_DAYS * 86_400_000).toISOString()

  const { data: lessons, error: lErr } = await (admin as any)
    .from("lessons")
    .select(
      "id, scheduled_at, duration_minutes, status, jitsi_room_name, student_id"
    )
    .eq("teacher_id", tpId)
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .order("scheduled_at", { ascending: false })
    .limit(500)

  if (lErr) {
    console.error("[teacher/schedule] lessons select failed", lErr)
    return {
      teacher_profile_id: tpId,
      lessons: [],
      generated_at: new Date().toISOString(),
    }
  }

  const list = (lessons ?? []) as any[]
  const studentIds = Array.from(
    new Set(list.map((l) => l.student_id).filter(Boolean))
  )

  let smap = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >()
  if (studentIds.length > 0) {
    const { data: profs } = await (admin as any)
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", studentIds)
    for (const p of (profs ?? []) as any[]) {
      smap.set(p.id, {
        full_name: p.full_name ?? null,
        avatar_url: p.avatar_url ?? null,
      })
    }
  }

  return {
    teacher_profile_id: tpId,
    lessons: list.map((l) => {
      const s = l.student_id ? smap.get(l.student_id) : null
      return {
        id: l.id,
        scheduled_at: l.scheduled_at,
        duration_minutes: l.duration_minutes,
        status: l.status,
        jitsi_room_name: l.jitsi_room_name ?? null,
        student_id: l.student_id ?? null,
        student_name: s?.full_name ?? null,
        student_avatar: s?.avatar_url ?? null,
      }
    }),
    generated_at: new Date().toISOString(),
  }
}

function getCachedTeacherSchedule(
  userId: string
): Promise<TeacherScheduleSnapshot> {
  return unstable_cache(
    async (uid: string) => loadTeacherScheduleImpl(uid),
    ["teacher-schedule", userId],
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
      name: "api:teacher-schedule",
      keyParts: [user.id, getClientIp(request)],
      max: 60,
      windowSeconds: 60,
    })
    if (limited) return limited

    const data = await getCachedTeacherSchedule(user.id)
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    console.error("[api/teacher/schedule]", err)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }
}
