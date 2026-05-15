// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedTeacherStudents } from "@/lib/cache/dashboard"
import TeacherStudentsClient from "./TeacherStudentsClient"

// Auth check uses cookies() → page is per-request dynamic. Aggregated
// students/lessons/progress are fetched through getCachedTeacherStudents
// (unstable_cache, TTL 60s, tag 'teacher-students-${userId}'), invalidated
// on booking/cancel/complete mutations.
export const revalidate = 60

const CSS = `
.tch-std{max-width:1200px;margin:0 auto}
.tch-std .dash-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.tch-std .dash-hdr h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1}
.tch-std .dash-hdr .sub{font-size:14px;color:var(--muted);margin-top:4px}

.tch-std .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s;cursor:pointer;border:none;text-decoration:none}
.tch-std .btn:active{transform:scale(.97)}
.tch-std .btn:disabled{opacity:.55;cursor:not-allowed}
.tch-std .btn-sm{padding:6px 14px;font-size:12px}
.tch-std .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.tch-std .btn-secondary:hover{border-color:var(--text)}
.tch-std .btn-primary{background:var(--accent-dark);color:#fff}
.tch-std .btn-primary:hover{background:var(--red)}

/* STATS */
.tch-std .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.tch-std .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;transition:all .15s ease}
.tch-std .stat-card:hover{border-color:var(--text)}
.tch-std .stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.tch-std .stat-card .value{font-size:32px;font-weight:800;margin-top:10px;letter-spacing:-1px;line-height:1}
.tch-std .stat-card .value small{font-size:14px;color:var(--muted);font-weight:500;margin-left:4px}
.tch-std .stat-card .change{font-size:12px;margin-top:10px;color:var(--muted);display:flex;align-items:center;gap:4px}
.tch-std .stat-card .change.positive{color:#22c55e;font-weight:600}
.tch-std .stat-card .change.warning{color:#F59E0B;font-weight:600}
.tch-std .stat-card.accent{background:var(--lime);border-color:var(--lime);color:#0A0A0A}
.tch-std .stat-card.accent .label{color:#0A0A0A;opacity:.7}

/* CARD */
.tch-std .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:background .2s ease,border-color .2s ease}
.tch-std .card-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px}
.tch-std .card-header h3{font-size:18px;font-weight:800;letter-spacing:-.3px}
.tch-std .card-header .sort-label{font-size:12px;color:var(--muted)}
.tch-std .card-body{padding:4px 0 0}

/* FILTERS BAR */
.tch-std .filters-bar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.tch-std .search-input{flex:1;min-width:220px;height:40px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0 14px 0 40px;color:var(--text);font-family:inherit;font-size:14px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg>");background-repeat:no-repeat;background-position:12px center;background-size:16px}
.tch-std .search-input:focus{outline:none;border-color:var(--text)}
.tch-std .filter-tabs{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:4px;flex-wrap:wrap}
.tch-std .filter-tabs button{padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;color:var(--muted);transition:all .15s;border:none;background:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.tch-std .filter-tabs button:hover{color:var(--text)}
.tch-std .filter-tabs button.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-std .filter-tabs button.active{background:var(--red)}
.tch-std .filter-tabs .pill-count{background:rgba(0,0,0,.08);color:inherit;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:800}
[data-theme="dark"] .tch-std .filter-tabs .pill-count{background:rgba(255,255,255,.08)}
.tch-std .filter-tabs button.active .pill-count{background:rgba(255,255,255,.25)}

/* STUDENTS TABLE */
.tch-std .students-table{width:100%;border-collapse:collapse}
.tch-std .students-table th{text-align:left;padding:12px 22px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;border-bottom:1px solid var(--border)}
.tch-std .students-table td{padding:14px 22px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
.tch-std .students-table tr:last-child td{border-bottom:none}
.tch-std .students-table tbody tr{transition:background .15s}
.tch-std .students-table tbody tr:hover{background:var(--surface-2)}
.tch-std .st-user{display:flex;align-items:center;gap:12px}
.tch-std .st-avatar{width:40px;height:40px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;object-fit:cover;overflow:hidden;color:var(--text)}
.tch-std .st-avatar.red{background:var(--red);color:#fff}
.tch-std .st-avatar.lime{background:var(--lime);color:#0A0A0A}
.tch-std .st-avatar.dark{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-std .st-avatar.dark{background:var(--red)}
/* Hybrid avatar: initials chip under, <img> stretched on top. onError hides
   the <img> and the initials show through — no broken-image icon. */
.tch-std .st-avatar-wrap{position:relative;width:40px;height:40px;flex-shrink:0}
.tch-std .st-avatar-wrap .st-avatar{position:absolute;inset:0;width:100%;height:100%}
.tch-std .st-avatar-wrap img.st-avatar{object-fit:cover;background:var(--bg)}
.tch-std .st-name{font-size:14px;font-weight:700}
.tch-std .st-email{font-size:11px;color:var(--muted);margin-top:1px}

.tch-std .level-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:var(--bg);color:var(--text);white-space:nowrap}
.tch-std .level-pill.rare{background:rgba(182,63,55,.1);color:var(--red)}
.tch-std .level-pill.mrare{background:rgba(221,234,136,.25);color:#5A7A00}
[data-theme="dark"] .tch-std .level-pill.mrare{background:rgba(221,234,136,.15);color:var(--lime)}
.tch-std .level-pill.medium{background:rgba(245,185,66,.15);color:#B8860B}
.tch-std .level-pill.mwell{background:rgba(34,197,94,.1);color:#22c55e}
.tch-std .level-pill.welldone{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-std .level-pill.welldone{background:var(--red)}

.tch-std .progress-mini{display:flex;align-items:center;gap:8px;min-width:120px}
.tch-std .progress-track{flex:1;height:5px;background:var(--bg);border-radius:100px;overflow:hidden;min-width:60px}
.tch-std .progress-fill{height:100%;background:var(--accent-dark);border-radius:100px}
[data-theme="dark"] .tch-std .progress-fill{background:var(--red)}
.tch-std .progress-fill.lime{background:var(--lime)}
.tch-std .progress-label{font-size:11px;font-weight:700;color:var(--muted);min-width:32px;text-align:right}

.tch-std .streak-cell{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:700}
.tch-std .streak-cell .fire{color:var(--red)}

.tch-std .next-lesson{display:flex;flex-direction:column;gap:2px}
.tch-std .next-lesson strong{font-size:12px;font-weight:700}
.tch-std .next-lesson span{font-size:11px;color:var(--muted)}
.tch-std .next-lesson.today strong{color:var(--red)}
.tch-std .next-lesson .muted-dash{font-size:12px;color:var(--muted);font-weight:600}

.tch-std .action-btns{display:flex;gap:6px;justify-content:flex-end}
.tch-std .action-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);transition:all .15s;text-decoration:none}
.tch-std .action-btn:hover{color:var(--text);border-color:var(--text)}
.tch-std .action-btn.primary{background:var(--accent-dark);border-color:var(--accent-dark);color:#fff}
.tch-std .action-btn.primary:hover{background:var(--red);border-color:var(--red)}
.tch-std .action-btn.disabled{opacity:.45;cursor:not-allowed}
.tch-std .action-btn.disabled:hover{color:var(--muted);border-color:var(--border)}
.tch-std .action-btn svg{width:14px;height:14px}

.tch-std .empty-state{padding:60px 22px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.tch-std .empty-state b{display:block;color:var(--text);font-size:16px;font-weight:800;margin-bottom:4px}

/* Responsive */
@media (max-width:1200px){.tch-std .students-table th:nth-child(5),.tch-std .students-table td:nth-child(5){display:none}}
@media (max-width:1100px){.tch-std .stats-grid{grid-template-columns:repeat(2,1fr)}.tch-std .students-table th:nth-child(3),.tch-std .students-table td:nth-child(3){display:none}}
@media (max-width:900px){.tch-std .students-table th:nth-child(4),.tch-std .students-table td:nth-child(4){display:none}}
@media (max-width:640px){.tch-std .dash-hdr h1{font-size:26px}.tch-std .stats-grid{grid-template-columns:1fr 1fr}.tch-std .students-table th:nth-child(2),.tch-std .students-table td:nth-child(2){display:none}}
`

type StudentItem = {
  id: string
  full_name: string
  avatar_url: string | null
  email: string | null
  english_level: string | null
  total_xp: number
  current_streak: number
  lessons_completed: number
  last_lesson_at: string | null
  next_lesson_id: string | null
  next_lesson_at: string | null
  next_lesson_topic: string
  course_progress_pct: number
  needs_attention: boolean
}

type InitialSnapshot = {
  students: StudentItem[]
  counts: Record<string, number>
  stats: {
    total: number
    active_today: number
    avg_progress: number
    needs_attention: number
  }
}

const EMPTY_SNAPSHOT: InitialSnapshot = {
  students: [],
  counts: { all: 0, A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
  stats: { total: 0, active_today: 0, avg_progress: 0, needs_attention: 0 },
}

// Mirrors the aggregation in /api/teacher/students but consumes the
// cached raw fetch instead of an HTTP self-call. Filter level=all matches
// the only request this page ever made.
const UPCOMING_STATUSES = new Set([
  "scheduled",
  "confirmed",
  "booked",
  "in_progress",
  "pending_payment",
])

const ACTIVE_STUDENT_STATUSES = new Set([
  "scheduled",
  "confirmed",
  "booked",
  "in_progress",
  "completed",
  "pending_payment",
])

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function buildSnapshot(cached: {
  teacher_profile_id: string | null
  lessons: any[]
  profiles: any[]
  progress: any[]
}): InitialSnapshot {
  if (!cached.teacher_profile_id) return EMPTY_SNAPSHOT
  const allLessons = cached.lessons
  const now = Date.now()
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000

  const studentIds = new Set<string>()
  const lastLessonByStudent: Record<string, string> = {}
  const completedCountByStudent: Record<string, number> = {}
  const lastAnyLessonTsByStudent: Record<string, number> = {}
  const nextLessonByStudent: Record<
    string,
    { scheduled_at: string; id: string; notes: string | null }
  > = {}

  for (const row of allLessons) {
    const sid = row.student_id
    if (!sid) continue
    if (!ACTIVE_STUDENT_STATUSES.has(row.status)) continue
    studentIds.add(sid)
    if (!lastLessonByStudent[sid]) {
      lastLessonByStudent[sid] = row.scheduled_at
    }
    const ts = new Date(row.scheduled_at).getTime()
    if (!Number.isNaN(ts)) {
      if (
        !lastAnyLessonTsByStudent[sid] ||
        ts > lastAnyLessonTsByStudent[sid]
      ) {
        lastAnyLessonTsByStudent[sid] = ts
      }
    }
    if (row.status === "completed") {
      completedCountByStudent[sid] = (completedCountByStudent[sid] || 0) + 1
    }
    if (UPCOMING_STATUSES.has(row.status) && !Number.isNaN(ts) && ts > now) {
      const cur = nextLessonByStudent[sid]
      if (!cur || ts < new Date(cur.scheduled_at).getTime()) {
        nextLessonByStudent[sid] = {
          scheduled_at: row.scheduled_at,
          id: row.id,
          notes: row.teacher_notes ?? null,
        }
      }
    }
  }

  const progMap: Record<string, any> = {}
  for (const p of cached.progress) progMap[p.user_id] = p

  const all = cached.profiles
    .filter((p: any) => studentIds.has(p.id))
    .map((p: any) => {
      const pr = progMap[p.id] || {}
      const completed = pr.lessons_completed ?? completedCountByStudent[p.id] ?? 0
      const current_streak = pr.current_streak ?? 0
      const nextLesson = nextLessonByStudent[p.id] || null
      const lastLessonTs = lastAnyLessonTsByStudent[p.id] || 0
      const noLessonsRecent = lastLessonTs === 0 || lastLessonTs < fourteenDaysAgo
      const needs_attention = current_streak === 0 || noLessonsRecent

      const course_progress_pct = Math.min(
        100,
        Math.round((completed || 0) / 0.2)
      )

      let next_lesson_topic = "Урок"
      if (nextLesson?.notes) {
        const firstLine = String(nextLesson.notes)
          .split("\n")
          .map((s) => s.trim())
          .find((s) => s.length > 0)
        if (firstLine) next_lesson_topic = firstLine.slice(0, 80)
      }

      return {
        id: p.id,
        full_name: p.full_name || "Ученик",
        avatar_url: p.avatar_url || null,
        email: p.email || null,
        english_level: pr.english_level || null,
        total_xp: pr.total_xp || 0,
        current_streak,
        lessons_completed: completed,
        last_lesson_at: lastLessonByStudent[p.id] || null,
        next_lesson_id: nextLesson?.id || null,
        next_lesson_at: nextLesson?.scheduled_at || null,
        next_lesson_topic,
        course_progress_pct,
        needs_attention,
      }
    })

  const counts: Record<string, number> = {
    all: all.length,
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
  }
  for (const s of all) {
    if (s.english_level && counts[s.english_level] !== undefined) {
      counts[s.english_level] += 1
    }
  }

  // Sort: today first, then by next_lesson_at asc, then by last_lesson_at desc.
  const nowDate = new Date()
  all.sort((a: any, b: any) => {
    const aNext = a.next_lesson_at ? new Date(a.next_lesson_at) : null
    const bNext = b.next_lesson_at ? new Date(b.next_lesson_at) : null
    const aToday = aNext ? isSameCalendarDay(aNext, nowDate) : false
    const bToday = bNext ? isSameCalendarDay(bNext, nowDate) : false
    if (aToday !== bToday) return aToday ? -1 : 1
    if (aNext && bNext) return aNext.getTime() - bNext.getTime()
    if (aNext) return -1
    if (bNext) return 1
    const aLast = a.last_lesson_at ? new Date(a.last_lesson_at).getTime() : 0
    const bLast = b.last_lesson_at ? new Date(b.last_lesson_at).getTime() : 0
    return bLast - aLast
  })

  let activeToday = 0
  let needsAttention = 0
  let progressSum = 0
  for (const s of all) {
    if (s.next_lesson_at && isSameCalendarDay(new Date(s.next_lesson_at), nowDate)) {
      activeToday += 1
    }
    if (s.needs_attention) needsAttention += 1
    progressSum += s.course_progress_pct || 0
  }
  const avgProgress = all.length > 0 ? Math.round(progressSum / all.length) : 0

  return {
    students: all,
    counts,
    stats: {
      total: all.length,
      active_today: activeToday,
      avg_progress: avgProgress,
      needs_attention: needsAttention,
    },
  }
}

function pluralStudent(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "ученик"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ученика"
  return "учеников"
}

function pluralLesson(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "урок"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "урока"
  return "уроков"
}

export default async function TeacherStudentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let snap: InitialSnapshot
  try {
    const cached = await getCachedTeacherStudents(user.id)
    // teacher без teacher_profile.id — ведём на /teacher (главная),
    // не на /dashboard (этого route нет — был 404).
    if (!cached.teacher_profile_id) redirect("/teacher")
    snap = buildSnapshot(cached)
  } catch (err) {
    console.error("[teacher/students] cached loader failed", err)
    snap = EMPTY_SNAPSHOT
  }
  const s = snap.stats
  const subParts: string[] = []
  subParts.push(`${s.total} активных`)
  if (s.active_today > 0) {
    subParts.push(`${s.active_today} ${pluralLesson(s.active_today)} сегодня`)
  }
  if (s.needs_attention > 0) {
    subParts.push(`${s.needs_attention} требуют внимания`)
  }
  if (s.total === 0) {
    subParts.splice(0, subParts.length, `Пока ${s.total} ${pluralStudent(s.total)}`)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tch-std">
        <div className="dash-hdr">
          <div>
            <h1>Мои <span className="gl">students</span></h1>
            <div className="sub">{subParts.join(" · ")}</div>
          </div>
        </div>
        <TeacherStudentsClient initial={snap} />
      </div>
    </>
  )
}
