// @ts-nocheck
import { redirect } from "next/navigation"
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isToday, isTomorrow } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { LEVEL_XP_THRESHOLDS, getLevelCEFR, xpToRoastLevel, type RoastLevel } from "@/lib/level-utils"

const TCH_CSS = `
.tch-home .dashboard-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.tch-home .dashboard-header h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1}
.tch-home .dashboard-header .wave{display:inline-block;animation:tchwave 2s ease-in-out infinite;transform-origin:70% 70%}
@keyframes tchwave{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(14deg)}20%{transform:rotate(-8deg)}30%{transform:rotate(14deg)}40%{transform:rotate(-4deg)}50%{transform:rotate(10deg)}}
.tch-home .dashboard-header .sub{font-size:14px;color:var(--muted);margin-top:4px}
.tch-home .user-menu{display:flex;align-items:center;gap:10px}
.tch-home .icon-btn{width:40px;height:40px;background:var(--surface);border:1px solid var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;color:var(--text);position:relative}
.tch-home .icon-btn:hover{border-color:var(--text)}
.tch-home .icon-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
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
  if (isToday(date)) return `сегодня, ${format(date, "HH:mm")}`
  if (isTomorrow(date)) return `завтра, ${format(date, "HH:mm")}`
  return format(date, "d MMM, HH:mm", { locale: ru })
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
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const prevMonthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  // --- Today's lessons ---
  const { data: todayLessonsRaw } = await (supabase as any)
    .from("lessons")
    .select("id, scheduled_at, duration_minutes, status, price, student_id")
    .eq("teacher_id", teacherId)
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", todayEnd.toISOString())
    .order("scheduled_at", { ascending: true })
  const todayLessons = (todayLessonsRaw ?? []) as any[]

  const todayStudentIds = [...new Set(todayLessons.map((l) => l.student_id))]
  const { data: todayStudentProfilesRaw } = todayStudentIds.length
    ? await (supabase as any).from("profiles").select("id, full_name").in("id", todayStudentIds)
    : { data: [] }
  const todayStudentsMap = new Map<string, { full_name: string | null }>()
  ;(todayStudentProfilesRaw ?? []).forEach((p: any) => todayStudentsMap.set(p.id, { full_name: p.full_name }))

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

  // --- Active students (distinct student_ids with booked/in_progress/completed) ---
  const { data: activeLessonsRaw } = await (supabase as any)
    .from("lessons")
    .select("student_id, scheduled_at, status")
    .eq("teacher_id", teacherId)
    .in("status", ["booked", "in_progress", "completed"])
    .order("scheduled_at", { ascending: true })
  const activeLessons = (activeLessonsRaw ?? []) as Array<{ student_id: string; scheduled_at: string; status: string }>

  // per-student: count of lessons, next upcoming lesson
  const byStudent = new Map<
    string,
    { lessonsCount: number; nextAt: Date | null }
  >()
  for (const l of activeLessons) {
    const cur = byStudent.get(l.student_id) ?? { lessonsCount: 0, nextAt: null }
    cur.lessonsCount += 1
    const at = new Date(l.scheduled_at)
    if (at > now && (cur.nextAt === null || at < cur.nextAt)) cur.nextAt = at
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

  // Find "active now" lesson for the today list (within the window of scheduled_at..+duration).
  const nowMs = now.getTime()
  const activeLessonId = todayLessons.find((l) => {
    const start = new Date(l.scheduled_at).getTime()
    const end = start + Number(l.duration_minutes ?? 50) * 60_000
    return nowMs >= start - 10 * 60_000 && nowMs <= end && (l.status === "booked" || l.status === "in_progress")
  })?.id

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
          <button className="icon-btn" aria-label="Уведомления" type="button">
            <svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </button>
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
            <h3>Сегодня, {format(now, "d MMMM", { locale: ru })}</h3>
            <Link href="/teacher/schedule" className="btn btn-sm btn-secondary">Полное расписание</Link>
          </div>
          <div className="card-body">
            {todayLessons.length === 0 ? (
              <div className="schedule-empty">На сегодня уроков нет</div>
            ) : (
              todayLessons.map((l) => {
                const at = new Date(l.scheduled_at)
                const isActive = l.id === activeLessonId
                const studentName = todayStudentsMap.get(l.student_id)?.full_name ?? "Ученик"
                return (
                  <div key={l.id} className={`schedule-item ${isActive ? "active" : ""}`}>
                    <div className="schedule-time">
                      <div className="time">{format(at, "HH:mm")}</div>
                      <div className="dur">{l.duration_minutes} мин</div>
                    </div>
                    <div className="schedule-info">
                      <h4>{studentName}</h4>
                      <p>Урок английского</p>
                    </div>
                    {l.status === "completed" ? (
                      <span className="status status-success">✓ завершён</span>
                    ) : l.status === "cancelled" || l.status === "no_show" ? (
                      <span className="status status-cancelled">отменён</span>
                    ) : isActive ? (
                      <Link href={`/teacher/lesson/${l.id}`} className="btn btn-sm btn-primary">Начать</Link>
                    ) : (
                      <span className="status status-pending">ожидается</span>
                    )}
                  </div>
                )
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
                <Link href="/teacher/messages">
                  <div className="ico">
                    <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  Написать ученику
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
