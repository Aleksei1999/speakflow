// @ts-nocheck
import "@/styles/dashboard/teacher-home.css"
import { redirect } from "next/navigation"
import { format, addDays, isSameDay, startOfMonth, endOfMonth } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { LEVEL_XP_THRESHOLDS, getLevelCEFR, xpToRoastLevel, type RoastLevel } from "@/lib/level-utils"
import { formatLessonTime, formatLessonDayShort, isMoscowToday, isMoscowTomorrow } from "@/lib/time"
import { LessonRowClient } from "@/components/lesson/lesson-row-client"
import { ClubRowClient } from "@/components/lesson/club-row-client"
// import OnboardingLauncher from "@/components/onboarding/OnboardingLauncher"
import { getCachedTeacherDashboard } from "@/lib/dashboard/teacher"

// Раньше стоял force-dynamic — из-за SSR-side computeLessonAccess(now=new Date())
// внутри рендера каждой строки урока и Speaking Club row. Теперь обе строки
// рендерит client (<LessonRowClient> / <ClubRowClient>, тикают каждые 5 сек),
// а server-side рендер общего layout-а кешируется. 30 сек — компромисс между
// свежестью «количество уроков сегодня» в шапке и нагрузкой на БД.
export const revalidate = 30

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

  // ─────────────────────────────────────────────────────────────
  // ① Один RPC вместо ~10 параллельных запросов.
  // Возвращает: profile / teacher_profile / today (lessons + clubs) /
  //             upcoming-14d / week_stats / month_stats / counters.
  // Кешируется per-user на 30 сек, инвалидируется booking/clubs/finalize.
  // Студенческая секция «Мои ученики» — отдельный батч ниже, т.к. ей
  // нужен полный history-список уроков, а не upcoming/14d.
  // ─────────────────────────────────────────────────────────────
  const dashboard = await getCachedTeacherDashboard(user.id)
  // ВАЖНО: НЕ redirect("/login") при null. У user'а валидная сессия (мы
  // прошли getUser() выше), middleware сразу редиректит залогиненного
  // обратно на /teacher → infinite loop. Лучше показать понятную ошибку.
  if (!dashboard || !dashboard.profile) {
    return (
      <div style={{ padding: 24, maxWidth: 720, margin: "40px auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Не удалось загрузить дашборд
        </h1>
        <p style={{ color: "var(--muted)" }}>
          Возможно временная проблема с базой. Обновите страницу через
          минуту. Если повторяется — напишите в поддержку.
        </p>
      </div>
    )
  }

  const profile = dashboard.profile
  if (profile.role !== "teacher") redirect("/student")

  const teacherProfile = dashboard.teacher_profile
  const teacherId = dashboard.teacher_profile_id ?? ""

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const todayLessons = dashboard.today ?? []
  const upcomingLessons = dashboard.upcoming ?? []
  const todayClubs = dashboard.today_clubs ?? []

  const monthCount = dashboard.month_stats.this_month_count
  const prevMonthCount = dashboard.month_stats.prev_month_count
  const monthDelta = prevMonthCount > 0
    ? Math.round(((monthCount - prevMonthCount) / prevMonthCount) * 100)
    : null

  const earningsRub = Math.round(dashboard.month_stats.earnings_kopecks / 100)

  const weekTotal = dashboard.week_stats.total
  const weekCompleted = dashboard.week_stats.completed
  const weekCancelled = dashboard.week_stats.cancelled

  // ─────────────────────────────────────────────────────────────
  // ② Секция «Мои ученики»: НЕ покрывается RPC (нужны ВСЕ уроки
  // учителя за всё время, не только upcoming 14d). Используем
  // admin-client напрямую — page уже под auth-gate, а данные
  // ниже не зависят от per-user RLS (мы знаем teacherProfileId).
  // ─────────────────────────────────────────────────────────────
  const admin = createAdminClient()

  const { data: activeLessonsRaw } = teacherId
    ? await (admin as any)
        .from("lessons")
        .select("student_id, scheduled_at, status")
        .eq("teacher_id", teacherId)
        // NOTE: "Мой ученик" = хоть один урок в статусах, отличных от cancelled/no_show.
        .in("status", [
          "scheduled",
          "confirmed",
          "booked",
          "in_progress",
          "completed",
          "pending_payment", // TEMP: until Yookassa integration is live — a2a0600
        ])
        .order("scheduled_at", { ascending: true })
    : { data: [] }

  const activeLessons = (activeLessonsRaw ?? []) as Array<{
    student_id: string
    scheduled_at: string
    status: string
  }>

  // per-student: count of lessons, next upcoming lesson.
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

  const [{ data: studentProfilesRaw }, { data: studentProgressRaw }] = studentIds.length
    ? await Promise.all([
        (admin as any)
          .from("profiles")
          .select("id, full_name, email, avatar_url, role")
          .in("id", studentIds)
          .eq("role", "student"),
        (admin as any)
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

  return (
    <div className="tch-home">
      {/* TEMP: онбординг-тур закомментирован. Чтобы вернуть — раскомментируй. */}
      {/* <OnboardingLauncher role="teacher" /> */}

      <div className="dashboard-header">
        <div>
          <h1>{greeting}, {firstName}! <span className="gl">👋</span></h1>
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
        <div className="stat-card" data-onboarding="tch-stat-month">
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
                {todayClubs.map((c: any) => (
                  <ClubRowClient
                    key={c.id}
                    clubId={c.id}
                    startsAt={c.starts_at}
                    durationMin={c.duration_min ?? 60}
                    topic={c.topic}
                    seatsTaken={c.seats_taken ?? 0}
                    capacity={c.capacity ?? c.max_seats ?? c.seats_taken ?? 0}
                  />
                ))}
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
                    const studentName = l.student_name ?? "Ученик"
                    const isTrial = !!l.is_trial
                    // Всю time-dependent логику (access window, CTA, .active-подсветка,
                    // <Link>/<div>) делегируем client-row. Это позволяет странице
                    // жить под revalidate=30 — без force-dynamic.
                    return (
                      <LessonRowClient
                        key={l.id}
                        lessonId={l.id}
                        scheduledAt={l.scheduled_at}
                        durationMinutes={l.duration_minutes ?? 50}
                        status={l.status}
                        role="teacher"
                        counterpartName={studentName}
                        isTrial={isTrial}
                        classPrefix="tch-today-join"
                        rowClassName="schedule-item"
                        linkClassName="schedule-link"
                        hintClassName="tch-today-hint"
                      />
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
                    {/* formatNextLesson зависит от new Date() для "сегодня/завтра" —
                        server и client рендерят в разные моменты, near-midnight
                        возможен mismatch. suppressHydrationWarning подавляет ошибку,
                        клиентский результат всегда корректнее. */}
                    <td suppressHydrationWarning>{r.nextAt ? formatNextLesson(r.nextAt) : "—"}</td>
                    <td>
                      <div className="progress-bar" style={{ width: 100 }}>
                        <div className="progress-fill" style={{ width: `${r.progress}%` }} />
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/teacher/students/${r.id}`}
                        className="btn btn-sm btn-secondary"
                      >
                        Профиль
                      </Link>
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
