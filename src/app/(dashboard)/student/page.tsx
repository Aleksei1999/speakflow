// @ts-nocheck
import "@/styles/dashboard/student-home.css"
import { redirect } from "next/navigation"
import { format, startOfDay, subDays, addDays, isSameDay } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { BookingLauncher } from "./_components/booking-launcher"
import { QuickActions } from "./_components/quick-actions"
import { LandingXpClaimer } from "./_components/landing-xp-claimer"
import { TrialBookingCard } from "./_components/trial-booking-card"
import { LEVEL_XP_THRESHOLDS, getLevelCEFR, xpToRoastLevel, type RoastLevel } from "@/lib/level-utils"
import { LessonRowClient } from "@/components/lesson/lesson-row-client"
import { getCachedStudentDashboard } from "@/lib/dashboard/student"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query/client"
import { STUDENT_DASHBOARD_QUERY_KEY } from "@/hooks/use-student-dashboard"

// Раньше стоял force-dynamic — из-за SSR-side computeLessonAccess (now=new Date())
// внутри рендера каждой строки урока. Теперь строки рендерит client-side
// <LessonRowClient> (тикает каждые 5 сек), а server-side рендер кеширует HTML
// общего layout-а. 30 сек — компромисс между свежестью «у меня X уроков сегодня»
// (counter в шапке зависит от todayLessons.length) и нагрузкой на БД.
export const revalidate = 30

const LEVEL_ORDER = ["Raw", "Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"] as const
const LEVEL_SHORT: Record<string, string> = {
  Raw: "Raw",
  Rare: "Rare",
  "Medium Rare": "Med Rare",
  Medium: "Medium",
  "Medium Well": "Med Well",
  "Well Done": "Well Done",
}

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const now = new Date()

  // Day of week index (0=Mon .. 6=Sun) — российская неделя
  const weekdayIdx = (d: Date) => (d.getDay() + 6) % 7
  const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  const todayIdx = weekdayIdx(now)

  // ============================================================
  // Один RPC `get_student_dashboard` вместо ~11 параллельных
  // Supabase запросов + 3 follow-up'ов. Миграция 073, кеш в
  // unstable_cache (per-user, тег `student-dashboard-<uid>`,
  // TTL=30s — совпадает с прежним `export const revalidate = 30`).
  // SECURITY DEFINER + auth.uid() check внутри RPC → admin client OK.
  // ============================================================
  const dashboard = await getCachedStudentDashboard(user.id)
  const LIFETIME_REFERRAL_CAP = 10

  const profile = dashboard.profile
  const progress = dashboard.progress
  // Уроки на ближайшие 14 дней — RPC уже фильтрует по МСК-окну.
  const upcomingLessons = dashboard.upcoming_lessons as Array<{
    id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    teacher_id: string | null
    teacher_user_id: string | null
    teacher_name: string | null
    teacher_avatar: string | null
    room_name: string | null
  }>
  const todayLessons = upcomingLessons.filter((l) => isSameDay(new Date(l.scheduled_at), now))
  const monthLessonsCount = dashboard.stats.month_total
  const completedMonthCount = dashboard.stats.completed_30d

  const earnedAchIds = new Set(dashboard.achievements_earned.map((a) => a.achievement_id))
  const achDefsAll = dashboard.achievement_defs
  const achEarned = achDefsAll.filter((a) => earnedAchIds.has(a.id))
  const achLocked = achDefsAll.filter((a) => !earnedAchIds.has(a.id))
  const achDefs = [...achEarned, ...achLocked].slice(0, 8)
  const leaderboard = dashboard.leaderboard_weekly
  const xpDaily = dashboard.xp_events_week

  const fullName = profile?.full_name ?? "Ученик"
  const firstName = fullName.split(" ")[0]

  const totalLessonsCount = dashboard.stats.total_lessons
  const trialReq = dashboard.trial_request
  // Карточку показываем новичкам: нет ни одного урока + нет привязанного пробного.
  const showTrialCard =
    totalLessonsCount === 0 && !(trialReq && trialReq.assigned_lesson_id)

  // todayTrialIds — RPC не возвращает связку urot↔trial_request, но это
  // нужно только для лейбла «🎯 Пробный» в строке урока. Считаем на лету:
  // если у студента есть открытая trial-заявка и её assigned_lesson_id
  // совпадает с одним из upcoming-уроков — помечаем.
  const todayTrialIds = new Set<string>()
  if (trialReq?.assigned_lesson_id) {
    todayTrialIds.add(trialReq.assigned_lesson_id)
  }

  // teacherMap — RPC уже подмешал teacher_name/avatar/user_id в каждую
  // строку upcoming_lessons. Сохраняем форму прежнего map'а для совместимости.
  const teacherMap: Record<string, { full_name: string | null }> = {}
  for (const l of upcomingLessons) {
    if (l.teacher_id) {
      teacherMap[l.teacher_id] = { full_name: l.teacher_name }
    }
  }

  const xp = progress?.total_xp ?? 0
  const level: RoastLevel = xpToRoastLevel(xp)
  const thresholds = LEVEL_XP_THRESHOLDS[level]
  const currentStreak = progress?.current_streak ?? 0
  const longestStreak = progress?.longest_streak ?? 0
  const levelIndex = LEVEL_ORDER.indexOf(level as (typeof LEVEL_ORDER)[number])
  const xpInLevel = Math.max(0, xp - thresholds.min)
  const xpLevelSpan = thresholds.next === null ? 0 : thresholds.next - thresholds.min
  const xpPct = thresholds.next === null
    ? 100
    : Math.min(100, Math.round((xpInLevel / Math.max(xpLevelSpan, 1)) * 100))

  const myRank = leaderboard.find((r) => r.out_user_id === user.id)?.out_rank
  const totalOnLb = leaderboard.length

  // streak dots: indexed 0..6 (Mon..Sun) for last 7 days ending today
  const activeDays = new Set<number>()
  for (const e of xpDaily) {
    const d = new Date(e.created_at)
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff >= 0 && diff <= 6) {
      activeDays.add(weekdayIdx(d))
    }
  }

  // Referral stats — RPC уже посчитал activated/pending для текущего юзера.
  const referralActivated = dashboard.referral.activated_count ?? 0
  const referralCapRemaining = Math.max(0, LIFETIME_REFERRAL_CAP - referralActivated)

  // SSR-prefetch: переиспользуем уже загруженный `dashboard` снапшот
  // как initial-данные для TanStack `useStudentDashboard()`. Никакого
  // второго RPC-вызова — просто seed через setQueryData. После dehydrate
  // данные сериализуются в RSC payload и гидратируются на клиенте
  // вместе с первым рендером, чтобы dashboard-shell XP-бейдж
  // отрисовался без HTTP-запроса.
  const queryClient = getQueryClient()
  queryClient.setQueryData(STUDENT_DASHBOARD_QUERY_KEY, dashboard)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
    <div className="stu-home">
      <LandingXpClaimer />

      <div className="main-header">
        <div>
          <h1>Привет, {firstName}! <span className="gl">🔥</span></h1>
          <div className="sub">
            {format(now, "EEEE, d MMMM", { locale: ru })} · Стрик: {currentStreak} {currentStreak === 1 ? "день" : currentStreak < 5 ? "дня" : "дней"}
            {todayLessons.length > 0 ? ` · ${todayLessons.length} занят${todayLessons.length === 1 ? "ие" : todayLessons.length < 5 ? "ия" : "ий"} сегодня` : ""}
          </div>
        </div>
        <div className="header-actions">
          <Link href="/student/settings" className="icon-btn" aria-label="Настройки">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.46.4.97.41 1.51"/></svg>
          </Link>
        </div>
      </div>

      {showTrialCard && (
        <TrialBookingCard
          pendingRequestId={trialReq?.id ?? null}
          firstName={firstName}
        />
      )}

      {/* XP Hero */}
      <div className="xp-hero">
        <div className="xp-hero-left">
          <div className="xp-hero-emoji">🔥</div>
          <div>
            <div className="xp-hero-level">{level}</div>
            <div className="xp-hero-sub">Уровень прожарки</div>
          </div>
        </div>
        <div className="xp-hero-bar"><div className="xp-hero-fill" style={{ width: `${xpPct}%` }} /></div>
        <div className="xp-hero-right">
          <div className="xp-hero-count">
            <b>{xpInLevel.toLocaleString("ru-RU")}</b> / {thresholds.next === null ? "∞" : xpLevelSpan.toLocaleString("ru-RU")} XP
          </div>
          {currentStreak > 0 ? (
            <div className="xp-hero-streak">🔥 {currentStreak} {currentStreak === 1 ? "день" : currentStreak < 5 ? "дня" : "дней"} подряд</div>
          ) : null}
        </div>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Текущий уровень</div>
          <div className="stat-val stat-val--red"><span className="gl">{LEVEL_SHORT[level]}</span></div>
          <div className="stat-change">≈ {getLevelCEFR(level)}</div>
        </div>
        <div className="stat stat--lime">
          <div className="stat-label">Стрик</div>
          <div className="stat-val">{currentStreak} <small style={{ fontSize: 14, fontWeight: 600 }}>{currentStreak === 1 ? "день" : currentStreak < 5 ? "дня" : "дней"}</small></div>
          <div className="stat-change">🔥 Рекорд: {longestStreak}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Уроков за месяц</div>
          <div className="stat-val">{monthLessonsCount}</div>
          <div className="stat-change">{completedMonthCount} завершено</div>
        </div>
        <div className="stat stat--dark">
          <div className="stat-label">Рейтинг</div>
          <div className="stat-val">{myRank ? `#${myRank}` : "—"}</div>
          <div className="stat-change" style={{ color: "#A0A09A" }}>{totalOnLb > 0 ? `из ${totalOnLb}+ учеников` : "нет данных"}</div>
        </div>
      </div>

      {/* Main grid: schedule + right column */}
      <div className="main-grid">
        <div className="card">
          <div className="card-head">
            <h3>Ближайшие уроки · {format(now, "d MMM", { locale: ru })}–{format(addDays(now, 13), "d MMM", { locale: ru })}</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <Link href="/student/schedule" className="btn btn-sm btn-outline">Всё расписание</Link>
              <BookingLauncher className="btn btn-sm btn-red">+ Записаться</BookingLauncher>
            </div>
          </div>
          <div className="card-body">
            {upcomingLessons.length === 0 ? (
              <div className="sch-empty">На ближайшую неделю уроков нет. Запишись на следующий слот 👆</div>
            ) : (
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
                const teacher = l.teacher_id ? teacherMap[l.teacher_id]?.full_name : null
                const isTrial = todayTrialIds.has(l.id)
                // Всю time-dependent логику (access window, CTA, .active-подсветка,
                // <Link>/<div>) делегируем client-row. Это позволяет странице
                // жить под revalidate=30 — server-side рендер кешируется, а row
                // сама тикает Date.now() через setInterval(5000).
                return (
                  <LessonRowClient
                    key={l.id}
                    lessonId={l.id}
                    scheduledAt={l.scheduled_at}
                    durationMinutes={l.duration_minutes ?? 50}
                    status={l.status}
                    role="student"
                    counterpartName={teacher}
                    isTrial={isTrial}
                    classPrefix="stu-today-join"
                    rowClassName="sch-item"
                    linkClassName="sch-link"
                    hintClassName="stu-today-hint"
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
            <div className="card-head"><h3>Быстрые действия</h3></div>
            <div className="card-body">
              <QuickActions
                clubsThisWeek={0}
                newMaterials={0}
                referralActivated={referralActivated}
                referralCapRemaining={referralCapRemaining}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Стрик этой недели</h3></div>
            <div className="card-body">
              <div className="streak-cal">
                {weekdayLabels.map((lbl, idx) => {
                  const isToday = idx === todayIdx
                  const isFuture = idx > todayIdx
                  const isDone = activeDays.has(idx) && !isToday
                  const cls = isToday
                    ? "streak-dot streak-dot--today"
                    : isFuture
                    ? "streak-dot streak-dot--future"
                    : isDone
                    ? "streak-dot streak-dot--done"
                    : "streak-dot streak-dot--miss"
                  const inner = isToday ? "🔥" : isDone ? "✓" : ""
                  return (
                    <div key={lbl} className="streak-day">
                      <div className={cls}>{inner}</div>
                      <div className="streak-label">{lbl}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="bottom-grid">
        <div className="card">
          <div className="card-head"><h3>Прогресс прожарки</h3></div>
          <div className="card-body">
            <div className="level-progress">
              <div className="lp-track">
                {LEVEL_ORDER.map((_, i) => {
                  const cls = i < levelIndex ? "lp-node lp-node--done" : i === levelIndex ? "lp-node lp-node--active" : "lp-node lp-node--locked"
                  return <div key={i} className={cls} />
                })}
              </div>
              <div className="lp-labels">
                {LEVEL_ORDER.map((lvl, i) => (
                  <span key={lvl} className={`lp-label${i === levelIndex ? " lp-label--active" : ""}`}>{LEVEL_SHORT[lvl]}</span>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {thresholds.nextLevel ? `${xpInLevel.toLocaleString("ru-RU")} / ${xpLevelSpan.toLocaleString("ru-RU")} XP до ${thresholds.nextLevel}` : "Максимальный уровень 🏆"}
              </span>
              <span className="btn btn-sm btn-lime">{xpPct}%</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Достижения</h3><Link href="/student/achievements" className="btn btn-sm btn-outline">Все</Link></div>
          <div className="card-body">
            {achDefs.length === 0 ? (
              <div className="sch-empty">Пока нет достижений</div>
            ) : (
              <div className="ach-grid">
                {achDefs.map((a) => {
                  const earned = earnedAchIds.has(a.id)
                  return (
                    <div key={a.id} className={`ach${earned ? "" : " ach--locked"}`}>
                      <div className="ach-icon">{a.icon_emoji ?? "🏆"}</div>
                      <div className="ach-name">{a.title}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Лидерборд</h3><Link href="/student/leaderboard" className="btn btn-sm btn-outline">Все</Link></div>
          <div className="card-body">
            {leaderboard.length === 0 ? (
              <div className="sch-empty">Лидерборд пуст</div>
            ) : (
              leaderboard.map((r, i) => {
                const isMe = r.out_user_id === user.id
                const avCls = i === 0 ? "lb-av-1" : i === 1 ? "lb-av-2" : "lb-av-3"
                const name = r.out_full_name ?? "—"
                const initials = name.split(" ").filter(Boolean).map((s) => s[0]).join("").toUpperCase().slice(0, 2)
                return (
                  <div key={r.out_user_id} className={`lb-row${isMe ? " lb-row--me" : ""}`}>
                    <div className="lb-rank">{r.out_rank}</div>
                    <div className={`lb-avatar ${avCls}`}>
                      {r.out_avatar_url ? <img src={r.out_avatar_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials || "?"}
                    </div>
                    <div className="lb-name">{isMe ? `${name.split(" ")[0]} (ты)` : name}</div>
                    <div className="lb-xp">{r.out_xp.toLocaleString("ru-RU")}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
    </HydrationBoundary>
  )
}
