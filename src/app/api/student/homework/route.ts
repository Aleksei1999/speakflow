// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------
// GET /api/student/homework
//
// Lists the current student's homework with UI-friendly statuses
// and counts for the filter tabs shown in /student/homework.
//
// Mapping DB status → prototype UI state:
//   pending/in_progress, due_date > now + 36h     → 'todo'
//   pending/in_progress, due_date <= now + 36h    → 'soon'
//   pending/in_progress, due_date < now
//   OR status='overdue'                           → 'overdue'
//   status='submitted'                            → 'submitted'
//   status='reviewed'                             → 'reviewed'
//
// Sections in UI:
//   TODO      = todo + soon + overdue
//   SUBMITTED = submitted
//   GRADED    = reviewed
//
// Filter tabs:
//   all       | todo (=todo+soon+overdue) | submitted | reviewed
// ---------------------------------------------------------------

const FILTER_ENUM = ["all", "todo", "submitted", "reviewed"] as const
const SORT_ENUM = ["due_soon", "recent"] as const

const querySchema = z.object({
  filter: z.enum(FILTER_ENUM).default("all"),
  sort: z.enum(SORT_ENUM).default("due_soon"),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

const SOON_WINDOW_MS = 36 * 60 * 60 * 1000 // 1.5 дня

function deriveUiStatus(
  row: any
): "todo" | "soon" | "overdue" | "submitted" | "reviewed" {
  if (row.status === "submitted") return "submitted"
  if (row.status === "reviewed") return "reviewed"
  if (row.status === "overdue") return "overdue"
  const due = row.due_date ? new Date(row.due_date).getTime() : NaN
  const now = Date.now()
  if (!Number.isNaN(due) && due < now) return "overdue"
  if (!Number.isNaN(due) && due - now <= SOON_WINDOW_MS) return "soon"
  return "todo"
}

function matchesFilter(ui: string, filter: string) {
  if (filter === "all") return true
  if (filter === "todo") return ui === "todo" || ui === "soon" || ui === "overdue"
  return ui === filter
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle()
    if (pErr) {
      console.error("Ошибка профиля:", pErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    if (!profile || profile.role !== "student") {
      return NextResponse.json(
        { error: "Доступ разрешён только ученикам" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      filter: searchParams.get("filter") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные параметры" },
        { status: 400 }
      )
    }
    const { filter, sort, limit } = parsed.data

    const { data: rows, error } = await supabase
      .from("homework")
      .select(
        "id, student_id, teacher_id, lesson_id, title, description, due_date, status, submission_text, teacher_feedback, grade, score_10, submitted_at, reviewed_at, attachments, created_at, updated_at"
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000)
    if (error) {
      console.error("Ошибка чтения homework:", error)
      return NextResponse.json(
        { error: "Не удалось загрузить задания" },
        { status: 500 }
      )
    }

    const allRows = rows || []

    // Counts across full library
    const counts = {
      all: allRows.length,
      todo: 0, // объединяет todo + soon + overdue
      submitted: 0,
      reviewed: 0,
    }
    let soonestDue: { id: string; due_date: string; title: string } | null = null
    for (const r of allRows) {
      const ui = deriveUiStatus(r)
      if (ui === "submitted") counts.submitted += 1
      else if (ui === "reviewed") counts.reviewed += 1
      else counts.todo += 1 // todo/soon/overdue

      if (
        (ui === "todo" || ui === "soon" || ui === "overdue") &&
        r.due_date
      ) {
        if (!soonestDue || new Date(r.due_date) < new Date(soonestDue.due_date)) {
          soonestDue = { id: r.id, due_date: r.due_date, title: r.title }
        }
      }
    }

    // Apply tab filter
    let filtered = allRows.filter((r) => matchesFilter(deriveUiStatus(r), filter))

    // Sort
    switch (sort) {
      case "recent":
        filtered.sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
        )
        break
      case "due_soon":
      default:
        filtered.sort((a, b) => {
          // В разделе UI: сначала todo/soon/overdue (по dueDate asc), потом submitted, потом reviewed
          const aUi = deriveUiStatus(a)
          const bUi = deriveUiStatus(b)
          const weight: Record<string, number> = {
            overdue: 0,
            soon: 1,
            todo: 2,
            submitted: 3,
            reviewed: 4,
          }
          const w = (weight[aUi] ?? 9) - (weight[bUi] ?? 9)
          if (w !== 0) return w
          const aT = a.due_date || a.created_at
          const bT = b.due_date || b.created_at
          return new Date(aT).getTime() - new Date(bT).getTime()
        })
        break
    }

    const limited = filtered.slice(0, limit)

    // Enrich teacher + lesson
    const teacherIds = Array.from(
      new Set(limited.map((r) => r.teacher_id).filter(Boolean))
    )
    const lessonIds = Array.from(
      new Set(limited.map((r) => r.lesson_id).filter(Boolean))
    )

    const [{ data: teachers }, { data: lessons }] = await Promise.all([
      teacherIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", teacherIds)
        : Promise.resolve({ data: [] as any[] }),
      lessonIds.length > 0
        ? supabase
            .from("lessons")
            .select("id, scheduled_at")
            .in("id", lessonIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const teacherMap: Record<string, any> = {}
    for (const t of teachers || []) teacherMap[t.id] = t
    const lessonMap: Record<string, any> = {}
    for (const l of lessons || []) lessonMap[l.id] = l

    const enriched = limited.map((r) => {
      const t = teacherMap[r.teacher_id] || {}
      const l = lessonMap[r.lesson_id] || null
      return {
        id: r.id,
        teacher_id: r.teacher_id,
        teacher_name: t.full_name || "Преподаватель",
        teacher_avatar: t.avatar_url || null,
        lesson_id: r.lesson_id,
        lesson_at: l?.scheduled_at || null,
        title: r.title,
        description: r.description,
        due_date: r.due_date,
        status: r.status,
        ui_status: deriveUiStatus(r),
        submission_text: r.submission_text,
        teacher_feedback: r.teacher_feedback,
        grade: r.grade,
        score_10: r.score_10 !== null ? Number(r.score_10) : null,
        submitted_at: r.submitted_at,
        reviewed_at: r.reviewed_at,
        attachments: Array.isArray(r.attachments) ? r.attachments : [],
        created_at: r.created_at,
        updated_at: r.updated_at,
      }
    })

    // XP за текущий месяц — для карточки статистики
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const { data: xpRows } = await supabase
      .from("xp_events")
      .select("amount")
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString())
    let xpThisMonth = 0
    for (const x of xpRows || []) xpThisMonth += Number(x.amount) || 0

    // Подтянуть имя преподавателя для ближайшего дедлайна (urgent hero)
    let urgent: any = null
    if (soonestDue) {
      const full = allRows.find((r) => r.id === soonestDue!.id)
      if (full) {
        const t =
          teacherMap[full.teacher_id] ||
          (await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", full.teacher_id)
            .maybeSingle()
            .then((r) => r.data)) ||
          {}
        urgent = {
          id: full.id,
          title: full.title,
          description: full.description,
          due_date: full.due_date,
          teacher_id: full.teacher_id,
          teacher_name: t.full_name || "Преподаватель",
          teacher_avatar: t.avatar_url || null,
          ui_status: deriveUiStatus(full),
        }
      }
    }

    return NextResponse.json({
      homework: enriched,
      counts,
      stats: {
        xp_this_month: xpThisMonth,
        reviewed_lifetime: counts.reviewed,
        waiting: counts.todo,
        in_review: counts.submitted,
      },
      urgent,
    })
  } catch (err) {
    console.error("Непредвиденная ошибка в GET /api/student/homework:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
