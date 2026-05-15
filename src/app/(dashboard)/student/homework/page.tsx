// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { getCachedStudentHomework } from "@/lib/cache/dashboard"
import StudentHomeworkClient from "./StudentHomeworkClient"

// Auth check uses cookies() → page is per-request dynamic. The heavy data
// part lives behind unstable_cache(getCachedStudentHomework) keyed by
// userId with a 60s TTL + tag 'homework-${userId}', so navigation between
// dashboard tabs is essentially free until a mutation invalidates the tag.
export const revalidate = 60

type InitialSnapshot = {
  homework: any[]
  counts: { all: number; todo: number; submitted: number; reviewed: number }
  stats: {
    xp_this_month: number
    reviewed_lifetime: number
    waiting: number
    in_review: number
  }
  urgent: any | null
}

const EMPTY_SNAPSHOT: InitialSnapshot = {
  homework: [],
  counts: { all: 0, todo: 0, submitted: 0, reviewed: 0 },
  stats: { xp_this_month: 0, reviewed_lifetime: 0, waiting: 0, in_review: 0 },
  urgent: null,
}

const SOON_WINDOW_MS = 36 * 60 * 60 * 1000

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

// Build the same UI snapshot /api/student/homework returns, but from the
// cached Supabase fetch instead of an HTTP self-call. Filter=all, sort=due_soon
// (the only values the page ever requested).
function buildSnapshot(cached: {
  rows: any[]
  teachers: Record<string, any>
  lessons: Record<string, any>
  xp_this_month: number
}): InitialSnapshot {
  const allRows = cached.rows
  const counts = { all: allRows.length, todo: 0, submitted: 0, reviewed: 0 }
  let soonestDue: { id: string; due_date: string; title: string } | null = null
  for (const r of allRows) {
    const ui = deriveUiStatus(r)
    if (ui === "submitted") counts.submitted += 1
    else if (ui === "reviewed") counts.reviewed += 1
    else counts.todo += 1
    if (
      (ui === "todo" || ui === "soon" || ui === "overdue") &&
      r.due_date
    ) {
      if (!soonestDue || new Date(r.due_date) < new Date(soonestDue.due_date)) {
        soonestDue = { id: r.id, due_date: r.due_date, title: r.title }
      }
    }
  }

  // Sort: overdue → soon → todo → submitted → reviewed; within each, due_date asc.
  const weight: Record<string, number> = {
    overdue: 0,
    soon: 1,
    todo: 2,
    submitted: 3,
    reviewed: 4,
  }
  const sorted = [...allRows].sort((a, b) => {
    const aUi = deriveUiStatus(a)
    const bUi = deriveUiStatus(b)
    const w = (weight[aUi] ?? 9) - (weight[bUi] ?? 9)
    if (w !== 0) return w
    const aT = a.due_date || a.created_at
    const bT = b.due_date || b.created_at
    return new Date(aT).getTime() - new Date(bT).getTime()
  })

  const enriched = sorted.slice(0, 200).map((r) => {
    const t = cached.teachers[r.teacher_id] || {}
    const l = cached.lessons[r.lesson_id] || null
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

  let urgent: any = null
  if (soonestDue) {
    const full = allRows.find((r) => r.id === soonestDue!.id)
    if (full) {
      const t = cached.teachers[full.teacher_id] || {}
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

  return {
    homework: enriched,
    counts,
    stats: {
      xp_this_month: cached.xp_this_month,
      reviewed_lifetime: counts.reviewed,
      waiting: counts.todo,
      in_review: counts.submitted,
    },
    urgent,
  }
}

export default async function StudentHomeworkPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Reuse the cached role from layout (no second 'profiles' round-trip).
  const role = await getCachedRole(user.id)
  if (role !== "student") {
    if (role === "teacher") redirect("/teacher")
    if (role === "admin") redirect("/admin")
    redirect("/login")
  }

  let snap: InitialSnapshot
  try {
    const cached = await getCachedStudentHomework(user.id)
    snap = buildSnapshot(cached)
  } catch (err) {
    console.error("[student/homework] cached loader failed", err)
    snap = EMPTY_SNAPSHOT
  }

  return <StudentHomeworkClient initial={snap} />
}
