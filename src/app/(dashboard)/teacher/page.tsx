// @ts-nocheck
import { redirect } from "next/navigation"
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { LEVEL_XP_THRESHOLDS, getLevelCEFR, xpToRoastLevel, type RoastLevel } from "@/lib/level-utils"
import { formatLessonTime, formatLessonDayShort, isMoscowToday, isMoscowTomorrow } from "@/lib/time"
import { computeLessonAccess } from "@/lib/lesson-access"

// Не кешируем — секунды у openAt/closeAt должны пересчитываться на каждый запрос.
export const dynamic = "force-dynamic"

const TCH_CSS = `
.tch-home .dashboard-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.tch-home .dashboard-header h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1}
.tch-home .dashboard-header .wave{display:inline-block;animation:tchwave 2s ease-in-out infinite;transform-origin:70% 70%}
@keyframes tchwave{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(14deg)}20%{transform:rotate(-8deg)}30%{transform:rotate(14deg)}40%{transform:rotate(-4deg)}50%{transform:rotate(10deg)}}
.tch-home .dashboard-header .sub{font-size:14px;color:var(--muted);margin-top:4px}
.tch-home .user-menu{display:flex;align-items:center;gap:10px;align-self:flex-start;margin-top:4px}
.tch-home .icon-btn{width:40px;height:40px;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s, background .15s, transform .15s;color:var(--text);position:relative;text-decoration:none;line-height:1;padding:0;margin:0;flex-shrink:0}
.tch-home .icon-btn:hover{border-color:var(--text);background:var(--bg)}
.tch-home .icon-btn:active{transform:scale(.96)}
.tch-home .icon-btn svg{width:18px;height:18px;display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.tch-home .icon-btn .badge{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;background:var(--red);color:#fff;border-radius:999px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;border:2px solid var(--surface)}
.tch-home .user-avatar{width:40px;height:40px;background:var(--accent-dark);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
[data-theme="dark"] .tch-home .user-avatar{background:var(--red)}

.tch-home .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.tch-home .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;transition:all .15s}
.tch-home .stat-card:hover{border-color:var(--text)}
.tch-home .stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.tch-home .stat-card .value{font-size:32px;font-weight:800;margin-top:10px;letter-spacing:-1px;line-height:1}
.tch-home .stat-card .value small{font-size:14px;color:var(--muted);font-weight:500;margin-left:4px}
.tch-home .stat-card .change{font-size:12px;margin-top:10px;color:var(--muted);display:flex;align-items:center;gap:4px}
.tch-home .stat-card .change.positive{color:#22c55e;font-weight:600}
.tch-home .stat-card.accent{background:var(--lime);border-color:var(--lime);color:#0A0A0A}
.tch-home .stat-card.accent .label{color:#0A0A0A;opacity:.7}
.tch-home .stat-card.accent .value small{color:rgba(10,10,10,.6)}
.tch-home .stat-card.accent .change.positive{color:#0A0A0A}
.tch-home .stat-card.dark{background:#0A0A0A;color:#fff;border-color:#0A0A0A}
.tch-home .stat-card.dark .label{color:#A0A09A}
.tch-home .stat-card.dark .value small{color:#A0A09A}
[data-theme="dark"] .tch-home .stat-card.dark{background:var(--red);border-color:var(--red)}
[data-theme="dark"] .tch-home .stat-card.dark .label{color:rgba(255,255,255,.7)}
[data-theme="dark"] .tch-home .stat-card.dark .value small{color:rgba(255,255,255,.7)}

.tch-home .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:background .2s,border-color .2s}
.tch-home .card-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border)}
.tch-home .card-header h3{font-size:18px;font-weight:800;letter-spacing:-.3px}
.tch-home .card-body{padding:8px 22px 20px}

.tch-home .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s;border:none;cursor:pointer;text-decoration:none}
.tch-home .btn:active{transform:scale(.97)}
.tch-home .btn-sm{padding:6px 14px;font-size:12px}
.tch-home .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.tch-home .btn-secondary:hover{border-color:var(--text)}
.tch-home .btn-primary{background:var(--accent-dark);color:#fff}
.tch-home .btn-primary:hover{background:var(--red)}

.tch-home .dashboard-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:16px;margin-bottom:22px}
.tch-home .right-col{display:flex;flex-direction:column;gap:16px}

.tch-home .schedule-item{display:flex;align-items:center;gap:14px;padding:14px 10px;border-bottom:1px solid var(--border);border-radius:12px;transition:background .15s}
.tch-home .schedule-item:last-child{border-bottom:none}
.tch-home .schedule-item:hover{background:var(--surface-2)}
.tch-home .schedule-item.active{background:var(--lime);border-bottom-color:transparent;margin:4px 0;color:#0A0A0A}
.tch-home .schedule-time{width:58px;height:58px;background:var(--bg);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.tch-home .schedule-item.active .schedule-time{background:var(--accent-dark);color:#fff}
.tch-home .schedule-time .time{font-size:14px;font-weight:800;letter-spacing:-.3px}
.tch-home .schedule-time .dur{font-size:9px;opacity:.7;font-weight:500}
.tch-home .schedule-info{flex:1;min-width:0}
.tch-home .schedule-info h4{font-size:14px;font-weight:700;margin-bottom:2px}
.tch-home .schedule-info p{font-size:12px;color:var(--muted)}
.tch-home .schedule-item.active .schedule-info p{color:rgba(10,10,10,.6)}

.tch-home .status{padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.tch-home .status-success{background:var(--surface);border:1px solid var(--border);color:var(--muted)}
.tch-home .status-pending{background:var(--bg);color:var(--muted)}
.tch-home .status-cancelled{background:var(--bg);color:var(--muted);text-decoration:line-through}

.tch-home .schedule-empty{padding:30px 10px;text-align:center;color:var(--muted);font-size:13px}

.tch-home .schedule-link{display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit}
.tch-home .schedule-link:hover{background:var(--surface-2)}
.tch-home .schedule-link.active:hover{background:var(--lime);filter:brightness(.96)}

.tch-today-join{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:12px;background:var(--red,#E63946);color:#fff;font-size:12px;font-weight:800;text-decoration:none;border:none;transition:all .15s;white-space:nowrap;box-shadow:0 2px 0 rgba(180,30,45,.3)}
.tch-today-join:hover{background:#d02e3b;transform:translateY(-1px)}
.tch-today-join--waiting{background:var(--bg);color:var(--muted);cursor:not-allowed;box-shadow:none;border:1px solid var(--border);font-weight:700}
.tch-today-join--waiting:hover{background:var(--bg);transform:none}
.tch-today-join--expired{background:var(--bg);color:var(--muted);cursor:not-allowed;box-shadow:none;border:1px solid var(--border);font-weight:700}
.tch-today-join--cancelled{background:rgba(230,57,70,.08);color:var(--red);cursor:not-allowed;box-shadow:none;border:1px solid rgba(230,57,70,.2);font-weight:700}
.tch-today-hint{font-size:10px;color:var(--muted);margin-top:3px;text-align:right}

.tch-home .quick-actions{display:flex;flex-direction:column;gap:8px}
.tch-home .quick-actions a{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;border:1px solid var(--border);font-size:13px;font-weight:600;transition:all .15s;color:var(--text)}
.tch-home .quick-actions a:hover{border-color:var(--text)}
.tch-home .quick-actions a.primary{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}
.tch-home .quick-actions a.primary:hover{background:var(--red);border-color:var(--red)}
.tch-home .quick-actions .ico{width:30px;height:30px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tch-home .quick-actions a.primary .ico{background:var(--red)}
.tch-home .quick-actions .ico svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tch-home .quick-actions a.primary .ico svg{stroke:#fff;stroke-width:2.5}

.tch-home .week-stats{display:flex;flex-direction:column;gap:14px}
.tch-home .week-stat .row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px}
.tch-home .week-stat .row strong{font-weight:800;font-size:14px}
.tch-home .progress-bar{height:6px;background:var(--bg);border-radius:999px;overflow:hidden}
.tch-home .progress-fill{height:100%;background:var(--accent-dark);border-radius:999px;transition:width .4s}
[data-theme="dark"] .tch-home .progress-fill{background:var(--lime)}
.tch-home .progress-fill.lime{background:var(--lime)}
.tch-home .progress-fill.red{background:var(--red)}

.tch-home .table{width:100%;border-collapse:collapse;font-size:13px}
.tch-home .table thead tr{border-bottom:1px solid var(--border)}
.tch-home .table th{text-align:left;padding:12px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700}
.tch-home .table td{padding:14px 10px;border-top:1px solid var(--border)}
.tch-home .table tbody tr:hover{background:var(--surface-2)}

.tch-home .student-cell{display:flex;align-items:center;gap:10px}
.tch-home .student-avatar{width:34px;height:34px;border-radius:50%;background:var(--avatar-bg,var(--bg));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0;color:var(--text);overflow:hidden}
.tch-home .student-avatar.v1{background:var(--lime);color:#0A0A0A}
.tch-home .student-avatar.v2{background:var(--red);color:#fff}
.tch-home .student-avatar.v3{background:var(--accent-dark);color:#fff}
.tch-home .student-avatar img{width:100%;height:100%;object-fit:cover}
.tch-home .student-name strong{font-weight:700;font-size:13px}
.tch-home .student-name .em{font-size:11px;color:var(--muted)}

.tch-home .level-badge{background:var(--bg);padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;display:inline-block}

.tch-home .empty-row{text-align:center;color:var(--muted);padding:24px 0;font-size:13px}

@media (max-width:1100px){.tch-home .stats-grid{grid-template-columns:repeat(2,1fr)}.tch-home .dashboard-grid{grid-template-columns:1fr}}
@media (max-width:640px){.tch-home .dashboard-header h1{font-size:26px}.tch-home .stats-grid{grid-template-columns:1fr 1fr}}
`

function greetingByHour(h: number) {
  if (h < 6) return "Доброй ночи"
  if (h < 12) return "Доброе утро"
  if (h < 18) return "Добрый день"
  return "Добрый вечер"
}

function pluralLessons(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "урок"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "урока"
  return "уроков"
}

function formatNextLesson(date: Date): string {
  if (isMoscowToday(date)) return `сегодня, ${formatLessonTime(date)}`
  if (isMoscowTomorrow(date)) return `завтра, ${formatLessonTime(date)}`
  return `${formatLessonDayShort(date)}, ${formatLessonTime(date)}`
}

function avatarVariant(idx: number): "v1" | "v2" | "v3" {
  return (["v1", "v2", "v3"] as const)[idx % 3]
}

function initialsFrom(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase()
}

function xpProgressPct(xp: number, level: RoastLevel): number {
  const th = LEVEL_XP_THRESHOLDS[level]
  if (!th || th.next == null) return 100
  const within = xp - th.min
  const span = th.next - th.min
  if (span <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((within / span) * 100)))
}

export default async function TeacherDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any).from("profiles").select("*").eq("id", user.id).single()
  if (!profile || profile.role !== "teacher") redirect("/student")

  const { data: teacherProfile } = await (supabase as any)
    .from("teacher_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  const teacherId = teacherProfile?.id ?? ""
  const hourlyRate = Number(teacherProfile?.hourly_rate ?? 0) // kopecks

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekAheadEnd = endOfDay(addDays(now, 13))
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const prevMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  // --- Upcoming lessons (today + 6 days ahead) ---
  const { data: upcomingLessonsRaw } = await (supabase as any)
    .from("lessons")
    .select("id, scheduled_at, duration_minutes, status, price, student_id")
    .eq("teacher_id", teacherId)
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", weekAheadEnd.toISOString())
    .order("scheduled_at", { ascending: true })
  const upcomingLessons = (upcomingLessonsRaw ?? []) as any[]
  const todayLessons = upcomingLessons.filter((l) => isSameDay(new Date(l.scheduled_at), now))

  // --- Today's hosted Speaking Clubs (teacher = host) ---
  const { data: hostedTodayRaw } = await (supabase as any)
    .from("club_hosts")
    .select(
      "club_id, clubs!inner(id, topic, starts_at, duration_min, is_published, cancelled_at, seats_taken, capacity)"
    )
    .eq("host_id", user.id)
    .gte("clubs.starts_at", todayStart.toISOString())
    .lte("clubs.starts_at", todayEnd.toISOString())
  const todayClubs = ((hostedTodayRaw ?? []) as any[])
    .map((r) => r.clubs)
    .filter((c) => c && c.is_published && !c.cancelled_at)
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )

  const upcomingStudentIds = [...new Set(upcomingLessons.map((l) => l.student_id))]
  const { data: todayStudentProfilesRaw } = upcomingStudentIds.length
    ? await (supabase as any).from("profiles").select("id, full_name").in("id", upcomingStudentIds)
    : { data: [] }
  const todayStudentsMap = new Map<string, { full_name: string | null }>()
  ;(todayStudentProfilesRaw ?? []).forEach((p: any) => todayStudentsMap.set(p.id, { full_name: p.full_name }))

  // Помечаем пробные уроки (созданы через trial-flow) — на горизонте недели.
  const upcomingLessonIds = upcomingLessons.map((l) => l.id)
  const { data: trialRaw } = upcomingLessonIds.length
    ? await (supabase as any)
        .from("trial_lesson_requests")
        .select("assigned_lesson_id")
        .in("assigned_lesson_id", upcomingLessonIds)
    : { data: [] }
  const trialIdSet = new Set<string>(
    ((trialRaw ?? []) as Array<{ assigned_lesson_id: string | null }>)
      .map((t) => t.assigned_lesson_id)
      .filter((x): x is string => Boolean(x))
  )

  // --- Month counts (current + prev for delta) ---
  const [{ count: monthCount }, { count: prevMonthCount }] = await Promise.all([
    (supabase as any)
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .gte("scheduled_at", monthStart.toISOString())
      .lte("scheduled_at", monthEnd.toISOString()),
    (supabase as any)
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .gte("scheduled_at", prevMonthStart.toISOString())
      .lte("scheduled_at", prevMonthEnd.toISOString()),
  ])

  const monthDelta = (prevMonthCount ?? 0) > 0
    ? Math.round((((monthCount ?? 0) - (prevMonthCount ?? 0)) / (prevMonthCount ?? 1)) * 100)
    : null

  // --- Monthly earnings (completed lessons in current month) ---
  const { data: monthCompletedRaw } = await (supabase as any)
    .from("lessons")
    .select("price")
    .eq("teacher_id", teacherId)
    .eq("status", "completed")
    .gte("scheduled_at", monthStart.toISOString())
    .lte("scheduled_at", monthEnd.toISOString())
  const earningsKopecks = (monthCompletedRaw ?? []).reduce((s: number, l: any) => s + Number(l.price ?? 0), 0)
  // Teacher share — 100% of price by default; adjust if platform takes a cut.
  const earningsRub = Math.round(earningsKopecks / 100)

  // --- Week stats: completed / total and cancelled ---
  const { data: weekLessonsRaw } = await (supabase as any)
    .from("lessons")
    .select("id, status")
    .eq("teacher_id", teacherId)
    .gte("scheduled_at", weekStart.toISOString())
    .lte("scheduled_at", weekEnd.toISOString())
  const weekLessons = (weekLessonsRaw ?? []) as Array<{ status: string }>
  const weekTotal = weekLessons.length
  const weekCompleted = weekLessons.filter((l) => l.status === "completed").length
  const weekCancelled = weekLessons.filter((l) => l.status === "cancelled" || l.status === "no_show").length

  // --- Active students (distinct student_ids with active lessons) ---
  // NOTE: "Мой ученик" = хоть один урок в статусах, отличных от cancelled/no_show.
  // Раньше список ограничивался только ('booked','in_progress','completed'), из-за чего
  // ученики со старыми уроками pending_payment (созданными ДО коммита a2a0600) выпадали.
  const ACTIVE_LESSON_STATUSES = [
    "scheduled",
    "confirmed",
    "booked",
    "in_progress",
    "completed",
    "pending_payment", // TEMP: until Yookassa integration is live — a2a0600
  ]
  const { data: activeLessonsRaw } = await (supabase as any)
    .from("lessons")
    .select("student_id, scheduled_at, status")
    .eq("teacher_id", teacherId)
    .in("status", ACTIVE_LESSON_STATUSES)
    .order("scheduled_at", { ascending: true })
  const activeLessons = (activeLessonsRaw ?? []) as Array<{ student_id: string; scheduled_at: string; status: string }>

  // per-student: count of lessons, next upcoming lesson.
  // "Следующий урок" = только ещё предстоящий слот в не-финальных статусах.
  // pending_payment и in_progress сюда тоже попадают (старые записи + только что
  // стартовавшие), completed / cancelled / no_show — нет.
  const UPCOMING_FOR_NEXT = new Set([
    "scheduled",
    "confirmed",
    "booked",
    "in_progress",
    "pending_payment",
  ])
  const byStudent = new Map<
    string,
    { lessonsCount: number; nextAt: Date | null }
  >()
  for (const l of activeLessons) {
    const cur = byStudent.get(l.student_id) ?? { lessonsCount: 0, nextAt: null }
    cur.lessonsCount += 1
    const at = new Date(l.scheduled_at)
    if (
      UPCOMING_FOR_NEXT.has(l.status) &&
      at > now &&
      (cur.nextAt === null || at < cur.nextAt)
    ) {
      cur.nextAt = at
    }
    byStudent.set(l.student_id, cur)
  }
  const studentIds = [...byStudent.keys()]

  // Profiles + progress for active students
  const [{ data: studentProfilesRaw }, { data: studentProgressRaw }] = studentIds.length
    ? await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", studentIds),
        (supabase as any)
          .from("user_progress")
          .select("user_id, total_xp, english_level")
          .in("user_id", studentIds),
      ])
    : [{ data: [] }, { data: [] }]

  const progressMap = new Map<string, { total_xp: number; level: RoastLevel }>()
  ;(studentProgressRaw ?? []).forEach((p: any) => {
    const xp = Number(p.total_xp ?? 0)
    const level = xpToRoastLevel(xp)
    progressMap.set(p.user_id, { total_xp: xp, level })
  })

  // New students this month
  const firstLessonByStudent = new Map<string, Date>()
  for (const l of activeLessons) {
    const at = new Date(l.scheduled_at)
    const cur = firstLessonByStudent.get(l.student_id)
    if (!cur || at < cur) firstLessonByStudent.set(l.student_id, at)
  }
  const newThisMonth = [...firstLessonByStudent.values()].filter(
    (d) => d >= monthStart && d <= monthEnd,
  ).length

  // Build student table rows — sorted by next upcoming date, then by lessonsCount desc
  const rows = (studentProfilesRaw ?? [])
    .map((p: any) => {
      const info = byStudent.get(p.id)!
      const prog = progressMap.get(p.id)
      const level = prog?.level ?? "Raw"
      return {
        id: p.id,
        name: p.full_name || "Ученик",
        email: p.email ?? "",
        avatarUrl: p.avatar_url ?? null,
        lessonsCount: info.lessonsCount,
        nextAt: info.nextAt,
        level,
        cefr: getLevelCEFR(level),
        xp: prog?.total_xp ?? 0,
        progress: xpProgressPct(prog?.total_xp ?? 0, level),
      }
    })
    .sort((a, b) => {
      if (a.nextAt && b.nextAt) return a.nextAt.getTime() - b.nextAt.getTime()
      if (a.nextAt) return -1
      if (b.nextAt) return 1
      return b.lessonsCount - a.lessonsCount
    })

  const firstName = profile.full_name?.split(" ")[0] ?? "Преподаватель"
  const initials = initialsFrom(profile.full_name)
  const greeting = greetingByHour(now.getHours())
  const todayCount = todayLessons.length

  // (active lesson больше не вычисляем отдельно — его роль выполняет computeLessonAccess в рендере)

  return (
    <div className="tch-home">
      <style dangerouslySetInnerHTML={{ __html: TCH_CSS }} />

      <div className="dashboard-header">
        <div>
          <h1>{greeting}, {firstName} <span className="wave">👋</span></h1>
          <div className="sub">
            {format(now, "EEEE, d MMMM", { locale: ru })} · {todayCount} {pluralLessons(todayCount)} сегодня
          </div>
        </div>
        <div className="user-menu">
          <Link href="/teacher/settings" className="icon-btn" aria-label="Настройки">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.46.4.97.41 1.51"/></svg>
          </Link>
          <div className="user-avatar">{initials}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Уроков в месяце</div>
          <div className="value">{monthCount ?? 0}</div>
          <div className={`change ${monthDelta != null && monthDelta >= 0 ? "positive" : ""}`}>
            {monthDelta == null ? "нет данных" : monthDelta >= 0 ? `↑ +${monthDelta}% к прошлому` : `↓ ${monthDelta}% к прошлому`}
          </div>
        </div>
        <div className="stat-card accent">
          <div className="label">Активных учеников</div>
          <div className="value">{studentIds.length}</div>
          <div className={`change ${newThisMonth > 0 ? "positive" : ""}`}>
            {newThisMonth > 0 ? `↑ +${newThisMonth} ${newThisMonth === 1 ? "новый" : "новых"}` : "новых пока нет"}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Рейтинг</div>
          <div className="value">{Number(teacherProfile?.rating ?? 0).toFixed(1)} <small>★</small></div>
          <div className="change">Из {teacherProfile?.total_reviews ?? 0} отзывов</div>
        </div>
        <div className="stat-card dark">
          <div className="label">Заработано</div>
          <div className="value">{earningsRub.toLocaleString("ru-RU")}<small>₽</small></div>
          <div className="change">Выплата {format(new Date(now.getFullYear(), now.getMonth(), 15), "d MMMM", { locale: ru })}</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>Ближайшие уроки · {format(now, "d MMM", { locale: ru })}–{format(addDays(now, 13), "d MMM", { locale: ru })}</h3>
            <Link href="/teacher/schedule" className="btn btn-sm btn-secondary">Полное расписание</Link>
          </div>
          <div className="card-body">
            {upcomingLessons.length === 0 && todayClubs.length === 0 ? (
              <div className="schedule-empty">На ближайшую неделю уроков нет.</div>
            ) : null}
            {todayClubs.length > 0 ? (
              <>
                {todayClubs.map((c: any) => {
                  const at = new Date(c.starts_at)
                  const access = computeLessonAccess({
                    scheduledAt: c.starts_at,
                    durationMinutes: c.duration_min ?? 60,
                  })
                  const secondsUntilOpen = Math.max(
                    0,
                    Math.floor((access.openAtMs - access.nowMs) / 1000)
                  )
                  const minutesUntilOpen = Math.ceil(secondsUntilOpen / 60)
                  const isLive = access.status === "live"
                  const isSoon =
                    access.status === "waiting" && secondsUntilOpen <= 600
                  let cta: any
                  if (isLive) {
                    cta = <span className="tch-today-join">🎙 Зайти</span>
                  } else if (isSoon) {
                    cta = (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span className="tch-today-join tch-today-join--waiting">Скоро откроется</span>
                        <span className="tch-today-hint">через {minutesUntilOpen} мин</span>
                      </div>
                    )
                  } else if (access.status === "expired") {
                    cta = <span className="tch-today-join tch-today-join--expired">Завершён</span>
                  } else {
                    cta = <span className="status status-pending">ожидается</span>
                  }
                  const clickable = isLive || isSoon
                  const href = `/club/${c.id}/room`
                  const inner = (
                    <>
                      <div className="schedule-time">
                        <div className="time">{formatLessonTime(at)}</div>
                        <div className="dur">{c.duration_min ?? 60} мин</div>
                      </div>
                      <div className="schedule-info">
                        <h4>🎙 {c.topic}</h4>
                        <p>Speaking Club · {c.seats_taken ?? 0}/{c.capacity ?? c.seats_taken ?? 0} участников</p>
                      </div>
                      {cta}
                    </>
                  )
                  return clickable ? (
                    <Link
                      key={c.id}
                      href={href}
                      className={`schedule-link schedule-item${isLive ? " active" : ""}`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={c.id} className="schedule-item">
                      {inner}
                    </div>
                  )
                })}
              </>
            ) : null}
            {upcomingLessons.length === 0 ? null : (
              upcomingLessons.map((l, idx) => {
                // Заголовок-разделитель «Сегодня / Завтра / Сб 3 мая» перед первой
                // строкой нового дня.
                const dt0 = new Date(l.scheduled_at)
                const prev = idx > 0 ? upcomingLessons[idx - 1] : null
                const sameDayAsPrev = prev && isSameDay(new Date(prev.scheduled_at), dt0)
                let dayLabel = ""
                if (!sameDayAsPrev) {
                  if (isSameDay(dt0, now)) dayLabel = "Сегодня"
                  else if (isSameDay(dt0, addDays(now, 1))) dayLabel = "Завтра"
                  else dayLabel = format(dt0, "EEEE, d MMMM", { locale: ru })
                }
                return [
                  !sameDayAsPrev ? (
                    <div
                      key={`hdr-${l.id}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".5px",
                        color: "var(--muted)",
                        padding: "10px 4px 4px",
                        marginTop: idx === 0 ? 0 : 4,
                        borderTop: idx === 0 ? "none" : "1px dashed var(--border)",
                      }}
                    >
                      {dayLabel}
                    </div>
                  ) : null,
                  ((l) => {
                    const at = new Date(l.scheduled_at)
                    const studentName = todayStudentsMap.get(l.student_id)?.full_name ?? "Ученик"
                    const isTrial = trialIdSet.has(l.id)

                    const access = computeLessonAccess({
                      scheduledAt: l.scheduled_at,
                      durationMinutes: l.duration_minutes ?? 50,
                      status: l.status,
                    })
                    const secondsUntilOpen = Math.max(0, Math.floor((access.openAtMs - access.nowMs) / 1000))
                    const minutesUntilOpen = Math.ceil(secondsUntilOpen / 60)

                    const isLive = access.status === "live" && l.status !== "completed" && l.status !== "cancelled" && l.status !== "no_show"
                    const isSoon = access.status === "waiting" && secondsUntilOpen <= 600 && l.status !== "cancelled" && l.status !== "no_show"
                    const isActive = isLive
                    const lessonHref = `/teacher/lesson/${l.id}`

                    let cta: any
                    if (l.status === "completed") {
                      cta = <span className="status status-success">✓ завершён</span>
                    } else if (l.status === "cancelled" || l.status === "no_show" || access.status === "cancelled") {
                      cta = <span className="tch-today-join tch-today-join--cancelled">Отменён</span>
                    } else if (isLive) {
                      cta = <span className="tch-today-join">Начать</span>
                    } else if (isSoon) {
                      cta = (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <span className="tch-today-join tch-today-join--waiting">Скоро откроется</span>
                          <span className="tch-today-hint">через {minutesUntilOpen} мин</span>
                        </div>
                      )
                    } else if (access.status === "expired") {
                      cta = <span className="tch-today-join tch-today-join--expired">Урок завершён</span>
                    } else {
                      cta = <span className="status status-pending">ожидается</span>
                    }

                    const clickable = isLive || isSoon
                    const rowClass = `schedule-item ${isActive ? "active" : ""}`
                    const rowInner = (
                      <>
                        <div className="schedule-time">
                          <div className="time">{formatLessonTime(at)}</div>
                          <div className="dur">{l.duration_minutes} мин</div>
                        </div>
                        <div className="schedule-info">
                          <h4>
                            {studentName}
                            {isTrial ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  marginLeft: 8,
                                  background: "rgba(230,57,70,.10)",
                                  color: "var(--red)",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: "2px 8px",
                                  borderRadius: 100,
                                  letterSpacing: ".3px",
                                  textTransform: "uppercase",
                                  border: "1px solid rgba(230,57,70,.2)",
                                  verticalAlign: "middle",
                                }}
                              >
                                🎯 Пробный
                              </span>
                            ) : null}
                          </h4>
                          <p>{isTrial ? "Пробный урок · бесплатно" : "Урок английского"}</p>
                        </div>
                        {cta}
                      </>
                    )

                    return clickable ? (
                      <Link key={l.id} href={lessonHref} className={`schedule-link ${rowClass}`}>
                        {rowInner}
                      </Link>
                    ) : (
                      <div key={l.id} className={rowClass}>
                        {rowInner}
                      </div>
                    )
                  })(l),
                ]
              })
            )}
          </div>
        </div>

        <div className="right-col">
          <div className="card">
            <div className="card-header"><h3>Быстрые действия</h3></div>
            <div className="card-body">
              <div className="quick-actions">
                <Link href="/teacher/schedule" className="primary">
                  <div className="ico">
                    <svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
                  </div>
                  Управление слотами
                </Link>
                <Link href="/teacher/homework">
                  <div className="ico">
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="18" y2="12"/><line x1="9" x2="15" y1="15" y2="15"/></svg>
                  </div>
                  Создать задание
                </Link>
                <Link href="/teacher/materials">
                  <div className="ico">
                    <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                  </div>
                  Отправить материалы
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Статистика за неделю</h3></div>
            <div className="card-body">
              <div className="week-stats">
                <div className="week-stat">
                  <div className="row"><span>Проведено уроков</span><strong>{weekCompleted} / {weekTotal || 0}</strong></div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${weekTotal ? Math.round((weekCompleted / weekTotal) * 100) : 0}%` }} />
                  </div>
                </div>
                <div className="week-stat">
                  <div className="row"><span>Запланировано</span><strong>{weekTotal}</strong></div>
                  <div className="progress-bar">
                    <div className="progress-fill lime" style={{ width: `${Math.min(100, weekTotal * 10)}%` }} />
                  </div>
                </div>
                <div className="week-stat">
                  <div className="row"><span>Отменено учениками</span><strong>{weekCancelled}</strong></div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill red"
                      style={{ width: `${weekTotal ? Math.round((weekCancelled / weekTotal) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Students */}
      <div className="card">
        <div className="card-header">
          <h3>Мои ученики</h3>
          <Link href="/teacher/students" className="btn btn-sm btn-secondary">Все ученики</Link>
        </div>
        <div className="card-body" style={{ padding: "0 22px 8px" }}>
          {rows.length === 0 ? (
            <div className="empty-row">Учеников пока нет</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th>Уровень</th>
                  <th>Уроков</th>
                  <th>Следующий</th>
                  <th>Прогресс</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id}>
                    <td>
                      <div className="student-cell">
                        <div className={`student-avatar ${avatarVariant(idx)}`}>
                          {r.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.avatarUrl} alt={r.name} />
                          ) : (
                            initialsFrom(r.name)
                          )}
                        </div>
                        <div className="student-name">
                          <strong>{r.name}</strong>
                          <div className="em">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="level-badge">{r.cefr}</span></td>
                    <td>{r.lessonsCount}</td>
                    <td>{r.nextAt ? formatNextLesson(r.nextAt) : "—"}</td>
                    <td>
                      <div className="progress-bar" style={{ width: 100 }}>
                        <div className="progress-fill" style={{ width: `${r.progress}%` }} />
                      </div>
                    </td>
                    <td>
                      <Link href={`/teacher/students/${r.id}`} className="btn btn-sm btn-secondary">Профиль</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
