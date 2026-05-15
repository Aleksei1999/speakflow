import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { enforceRateLimit } from "@/lib/api/rate-limit"
import { logAuditEvent } from "@/lib/audit/log"
import { loadTeacherStudentProfile } from "@/lib/teacher/student-profile"

// ---------------------------------------------------------------
// GET /api/teacher/students/[id]
// Detailed profile of one student, scoped to the calling teacher
// (admin может смотреть любого студента).
//
// Auth gate:
//   1) auth.getUser() — обязательно
//   2) profiles.role: 'teacher' OR 'admin' (иначе 404, не 403 —
//      не палим существование ученика)
//
// Access policy:
//   - admin: всегда
//   - teacher: только если есть/были общие lessons (см.
//     loadTeacherStudentProfile)
//
// Rate-limit: 30 req / 60 s per (user_id, student_id) — далеко не
// hot path, скорее анти-pivot защита.
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const idSchema = z.string().uuid({ message: "Некорректный id студента" })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params
    const parsed = idSchema.safeParse(rawId)
    if (!parsed.success) {
      // 404 а не 400 — у внешнего наблюдателя не должно быть способа
      // отличить "плохой UUID" от "нет доступа".
      return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    }
    const studentId = parsed.data

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    // Rate-limit ДО ролёвой проверки — иначе можно дёргать endpoint
    // как oracle на existence студентов в брутфорсе.
    const limited = await enforceRateLimit(request, {
      name: "teacher:student-profile",
      keyParts: [user.id, studentId],
      max: 30,
      windowSeconds: 60,
    })
    if (limited) return limited

    // Role lookup: teacher | admin → разрешаем.
    const { data: viewerProfile, error: roleErr } = await (supabase as any)
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle()
    if (roleErr || !viewerProfile) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    }
    const role: string = viewerProfile.role
    if (role !== "teacher" && role !== "admin") {
      // Студент / гость / unknown — для нашего endpoint'а это 404.
      return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    }

    // Для teacher достаём его teacher_profiles.id (нужен для access gate).
    let teacherProfileId: string | null = null
    if (role === "teacher") {
      const { data: tp } = await (supabase as any)
        .from("teacher_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
      if (!tp) {
        // teacher без teacher_profiles — broken state, 404.
        return NextResponse.json({ error: "Не найдено" }, { status: 404 })
      }
      teacherProfileId = tp.id
    }

    const result = await loadTeacherStudentProfile(
      supabase as any,
      role === "admin" ? "admin" : "teacher",
      teacherProfileId,
      studentId
    )
    if (!result.ok) {
      // not_found | no_shared_lessons | deleted — все мапятся в 404.
      return NextResponse.json({ error: "Не найдено" }, { status: 404 })
    }

    // Аудит: логируем только teacher-просмотры (admin generic audit
    // через profile-trigger покрывает другие действия; просмотры карточек
    // ученика админом — спам).
    if (role === "teacher") {
      // Fire-and-forget; не блокируем response.
      void logAuditEvent(request, {
        category: "data",
        action: "teacher_viewed_student_profile",
        target_type: "profiles",
        target_id: studentId,
      })
    }

    return NextResponse.json(result.data)
  } catch (err) {
    console.error("Ошибка GET /api/teacher/students/[id]:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
