"use client"

import "@/styles/dashboard/student-schedule.css"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  addDays,
  addWeeks,
  endOfDay,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  startOfWeek,
  endOfWeek,
} from "date-fns"
import { useLocale, useTranslations } from "next-intl"
import dynamic from "next/dynamic"
import { createClient } from "@/lib/supabase/client"
import { useLessonsRealtime } from "@/hooks/use-lessons-realtime"
import {
  formatLessonTime,
  formatLessonDayShort,
  formatLessonDayLong,
  formatWeekdayShort,
  formatWeekdayLong,
  type TimeLocale,
} from "@/lib/time"

// LessonBookingModal — большой компонент (~800 строк + supabase realtime канал).
// Открывается по клику на «Забронировать» / по тапу в weekly grid — на первый
// paint /student/schedule не нужен. ssr:false: модалка чисто клиентская.
const LessonBookingModal = dynamic(
  () => import("@/components/booking/lesson-booking-modal").then((m) => m.LessonBookingModal),
  { ssr: false, loading: () => null },
)
import { computeLessonAccess } from "@/lib/lesson-access"

type LessonRow = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  jitsi_room_name: string | null
  teacher_id: string | null
}

type TeacherMapEntry = { full_name: string | null; initials: string; avatar_url: string | null }

function getInitials(name: string | null | undefined): string {
  if (!name) return "??"
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??"
}

function weekdayIdx(d: Date): number {
  return (d.getDay() + 6) % 7
}

export default function StudentSchedulePage() {
  const t = useTranslations("dashboard.student.schedule")
  const rawLocale = useLocale()
  const locale: TimeLocale = rawLocale === "en" ? "en" : "ru"
  // mounted guard: страница time-зависимая (now / weekCursor / format(...)
  // в JSX), при SSR initial state new Date() != client new Date(), что
  // даёт React error #418. Из-за этого после bail-out клик на «Записаться»
  // не доходил до handler-а — модалка не открывалась. До mount возвращаем
  // skeleton (одинаковый на server и client) — после mount полноценный
  // рендер. Тот же паттерн что в /teacher/schedule (commit 3603bb1).
  const [mounted, setMounted] = useState(false)
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [trialIds, setTrialIds] = useState<Set<string>>(new Set())
  const [teacherMap, setTeacherMap] = useState<Record<string, TeacherMapEntry>>({})
  const [weekCursor, setWeekCursor] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [isLoading, setIsLoading] = useState(true)
  const [bookingOpen, setBookingOpen] = useState(false)
  // Контекст брони из клика по ячейке weekly-grid: дата+время передаются
  // в LessonBookingModal через initialDate/initialTime, чтобы модалка
  // открылась сразу с предвыбранным слотом (без шага «выбор времени»).
  // null = открыта через кнопку «Записаться» (без контекста).
  const [bookingPreset, setBookingPreset] = useState<{ date: Date; time: string } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Live clock tick so "сейчас" / "ожидается" labels update without refresh.
  useEffect(() => {
    // Сначала переводим компонент в mounted (это всегда после server-render
    // и first client-render — внутри них state ещё одинаковый, а значит
    // нет hydration mismatch). После этого можно безопасно тикать now.
    setMounted(true)
    setNow(new Date())
    setWeekCursor(startOfWeek(new Date(), { weekStartsOn: 1 }))
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const weekStart = useMemo(() => startOfWeek(weekCursor, { weekStartsOn: 1 }), [weekCursor])
  const weekEnd = useMemo(() => endOfDay(addDays(weekStart, 6)), [weekStart])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const fetchLessons = useCallback(async (from: Date, to: Date, opts?: { silent?: boolean }) => {
    // silent=true — refetch без моргания спиннером. Используем для
    // realtime-событий: WebSocket к Supabase Realtime через RU-прокси
    // часто реконнектится и стрелял бы isLoading=true каждые пару секунд,
    // из-за чего пользователю казалось что страница «то грузит, то нет».
    if (!opts?.silent) setIsLoading(true)
    try {
      const supabase = createClient()
      // getSession() читает локальную сессию мгновенно, без сетевого
      // round-trip к /auth/v1/user — раньше getUser() зависал на reverse
      // proxy, и /student/schedule навсегда оставалось в isLoading=true.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user ?? null

      if (!user) {
        if (!opts?.silent) setIsLoading(false)
        return
      }

      setCurrentUserId(user.id)

      const { data: rawLessons } = await (supabase as any)
        .from("lessons")
        .select("id, scheduled_at, duration_minutes, status, jitsi_room_name, teacher_id")
        .eq("student_id", user.id)
        .gte("scheduled_at", from.toISOString())
        .lte("scheduled_at", to.toISOString())
        .order("scheduled_at", { ascending: true })

      const list = (rawLessons ?? []) as LessonRow[]
      setLessons(list)

      // После того как у нас есть список уроков, параллельно запускаем:
      //   (a) trial_lesson_requests — пометить trial-flow строки;
      //   (b) teacher_profiles → profiles — резолв имени/аватара препода.
      // Раньше (a) и (b) шли последовательно после lessons, плюс (b) сама
      // ждала свой второй round-trip к profiles. Теперь (a) и (b) гонятся
      // одновременно, а внутри (b) выкручиваем оба уровня одним PostgREST
      // embed-запросом (teacher_profiles → profiles по teacher_profiles_user_id_fkey).
      const lessonIds = list.map((l) => l.id)
      const teacherIds = Array.from(new Set(list.map((l) => l.teacher_id).filter(Boolean))) as string[]

      const trialsPromise = lessonIds.length > 0
        ? (supabase as any)
            .from("trial_lesson_requests")
            .select("assigned_lesson_id")
            .eq("user_id", user.id)
            .in("assigned_lesson_id", lessonIds)
        : Promise.resolve({ data: [] as Array<{ assigned_lesson_id: string | null }> })

      const teachersPromise = teacherIds.length > 0
        ? (supabase as any)
            .from("teacher_profiles")
            .select(
              "id, user_id, user:profiles!teacher_profiles_user_id_fkey(full_name, avatar_url)"
            )
            .in("id", teacherIds)
        : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; user: any }> })

      const [{ data: trials }, { data: teachersRaw }] = await Promise.all([
        trialsPromise,
        teachersPromise,
      ])

      const tset = new Set<string>()
      for (const tt of (trials ?? []) as Array<{ assigned_lesson_id: string | null }>) {
        if (tt.assigned_lesson_id) tset.add(tt.assigned_lesson_id)
      }
      setTrialIds(tset)

      if ((teachersRaw ?? []).length > 0) {
        const teachers = (teachersRaw ?? []) as Array<{ id: string; user_id: string; user: any }>
        const nextMap: Record<string, TeacherMapEntry> = {}
        for (const tt of teachers) {
          const p = Array.isArray(tt.user) ? tt.user[0] : tt.user
          const fullName = (p?.full_name ?? null) as string | null
          nextMap[tt.id] = {
            full_name: fullName,
            initials: getInitials(fullName),
            avatar_url: (p?.avatar_url ?? null) as string | null,
          }
        }
        setTeacherMap(nextMap)
      } else {
        setTeacherMap({})
      }
    } catch (e) {
      console.error("[student/schedule] fetchLessons crashed:", e)
    } finally {
      if (!opts?.silent) setIsLoading(false)
    }
  }, [])

  // Отмена урока. Confirm + POST /api/booking/cancel + рефреш списка.
  // Политика возврата (24ч до начала) живёт на бэке, тут только UX.
  const cancelLesson = useCallback(async (lessonId: string, scheduledAt: string) => {
    const dt = new Date(scheduledAt)
    const hoursLeft = (dt.getTime() - Date.now()) / 3_600_000
    const hint = hoursLeft < 24
      ? t("cancelHintNoRefund")
      : t("cancelHintRefund")
    const whenLabel = `${formatWeekdayLong(dt, locale)}, ${formatLessonDayLong(dt, locale)} ${formatLessonTime(dt, locale)}`
    if (!confirm(t("cancelConfirm", { when: whenLabel, hint }))) return
    setCancellingId(lessonId)
    try {
      const r = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        alert(j?.error ?? t("cancelFailed"))
        return
      }
      const ws = startOfWeek(weekCursor, { weekStartsOn: 1 })
      const we = endOfWeek(weekCursor, { weekStartsOn: 1 })
      await fetchLessons(ws, we, { silent: true })
    } catch (e: any) {
      alert(e?.message ?? t("cancelNetworkError"))
    } finally {
      setCancellingId(null)
    }
  }, [weekCursor, fetchLessons, t, locale])

  useEffect(() => {
    fetchLessons(weekStart, weekEnd)
  }, [weekStart, weekEnd, fetchLessons])

  useLessonsRealtime({
    studentId: currentUserId,
    onChange: () => fetchLessons(weekStart, weekEnd, { silent: true }),
  })

  // Month XP (lesson XP, approximate) — used for "XP за неделю" stat.
  const weekXp = useMemo(() => {
    return lessons.reduce((sum, l) => (l.status === "completed" ? sum + 50 : sum), 0)
  }, [lessons])

  const weekCount = lessons.filter((l) => l.status !== "cancelled" && l.status !== "no_show").length

  const nextLesson = useMemo(() => {
    return lessons.find(
      (l) =>
        new Date(l.scheduled_at) >= now &&
        l.status !== "cancelled" &&
        l.status !== "no_show" &&
        l.status !== "completed"
    )
  }, [lessons, now])

  const completedCount = useMemo(
    () => lessons.filter((l) => l.status === "completed").length,
    [lessons]
  )

  // Build dynamic time rows from actual lessons (floor to hour), fallback to 10,12,14,16,18.
  const timeRows = useMemo(() => {
    const hours = new Set<number>()
    for (const l of lessons) {
      if (l.status === "cancelled" || l.status === "no_show") continue
      const d = new Date(l.scheduled_at)
      hours.add(d.getHours())
    }
    const sorted = Array.from(hours).sort((a, b) => a - b)
    if (sorted.length === 0) return [10, 12, 14, 16, 18]
    return sorted
  }, [lessons])

  function accessState(l: LessonRow) {
    return computeLessonAccess({
      scheduledAt: l.scheduled_at,
      durationMinutes: l.duration_minutes,
      status: l.status,
      now: now.getTime(),
    })
  }

  function canJoin(l: LessonRow): boolean {
    if (l.status === "completed" || l.status === "cancelled" || l.status === "no_show") return false
    return accessState(l).status === "live"
  }

  function isHappeningNow(l: LessonRow): boolean {
    if (l.status === "completed" || l.status === "cancelled" || l.status === "no_show") return false
    return accessState(l).status === "live"
  }

  function isExpired(l: LessonRow): boolean {
    if (l.status === "completed" || l.status === "cancelled" || l.status === "no_show") return false
    return accessState(l).status === "expired"
  }

  // Lessons grouped by day for list view.
  const lessonsByDay = useMemo(() => {
    const map = new Map<string, LessonRow[]>()
    for (const l of lessons) {
      const key = format(new Date(l.scheduled_at), "yyyy-MM-dd")
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(l)
    }
    return map
  }, [lessons])

  function weekTitle(): string {
    // "23 — 29 апреля 2026" / "Apr 23 — Apr 29, 2026" — locale-aware.
    const from = weekStart
    const to = addDays(weekStart, 6)
    const intlLocale = locale === "en" ? "en-US" : "ru-RU"
    const fromLabel = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: locale === "en" ? "short" : undefined }).format(from)
    const toLabel = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: locale === "en" ? "short" : "long", year: "numeric" }).format(to)
    return `${fromLabel} — ${toLabel}`
  }

  function goPrev() {
    setWeekCursor((c) => addWeeks(c, -1))
  }
  function goNext() {
    setWeekCursor((c) => addWeeks(c, 1))
  }
  function goToday() {
    setWeekCursor(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  if (!mounted) {
    // Skeleton ОДИНАКОВ на server и client → нет hydration mismatch.
    // После mount useEffect выставит mounted=true и компонент перерендерит
    // полноценно, уже с прицепленным onClick-handler-ом на «Записаться».
    return (
      <div className="stu-schedule">
        <div className="hdr">
          <h1>{t("headingMy")} <span className="gl">{t("headingScheduleWord")}</span></h1>
        </div>
        <div className="loading"><div className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="stu-schedule">
      <div className="hdr">
        <h1>{t("headingMy")} <span className="gl">{t("headingScheduleWord")}</span></h1>
        <div className="hdr-right">
          <button
            className="btn btn-dark"
            onClick={() => {
              setBookingPreset(null)
              setBookingOpen(true)
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {t("bookCtaShort")}
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="st st--red">
          <div className="st-label">{t("statWeek")}</div>
          <div className="st-val">{weekCount}</div>
          <div className="st-sub">{t("statWeekSub", { count: weekCount })}</div>
        </div>
        <div className="st">
          <div className="st-label">{t("statCompleted")}</div>
          <div className="st-val">{completedCount}</div>
          <div className="st-sub">{t("statCompletedSub")}</div>
        </div>
        <div className={`st ${nextLesson ? "st--lime" : ""}`}>
          <div className="st-label">{t("statNext")}</div>
          <div className="st-val">
            {nextLesson ? <span className="gl">{formatLessonTime(nextLesson.scheduled_at, locale)}</span> : "—"}
          </div>
          <div className="st-sub">
            {nextLesson
              ? t("statNextSubWith", {
                  when: isToday(new Date(nextLesson.scheduled_at))
                    ? t("todayBadge")
                    : isTomorrow(new Date(nextLesson.scheduled_at))
                      ? t("tomorrowBadge")
                      : formatLessonDayShort(nextLesson.scheduled_at, locale),
                })
              : t("statNextSubEmpty")}
          </div>
        </div>
        <div className="st">
          <div className="st-label">{t("statXpWeek")}</div>
          <div className="st-val">+{weekXp}</div>
          <div className="st-sub">{t("statXpSub")}</div>
        </div>
      </div>

      <div className="cal-card">
        <div className="cal-top">
          <div className="cal-top-nav">
            <button className="cal-nav-btn" onClick={goPrev} aria-label={t("prevWeekAria")}>←</button>
            <div className="cal-top-title">{weekTitle()}</div>
            <button className="cal-nav-btn" onClick={goNext} aria-label={t("nextWeekAria")}>→</button>
          </div>
          <button className="cal-today-btn" onClick={goToday}>{t("todayBtn")}</button>
        </div>

        <div className="cal-legend">
          <div className="leg"><div className="leg-dot leg-dot--l"></div>{t("legendLesson")}</div>
          <div className="leg"><div className="leg-dot leg-dot--done"></div>{t("legendDone")}</div>
          <div className="leg"><div className="leg-dot leg-dot--cancel"></div>{t("legendCancel")}</div>
        </div>

        <div className="cg-wrap">
          <div className="cg">
            <div className="cg-corner" />
            {weekDays.map((d) => {
              const today = isSameDay(d, now)
              return (
                <div key={d.toISOString()} className={`cg-dh${today ? " cg-dh--today" : ""}`}>
                  <div className="cg-dn">{formatWeekdayShort(d, locale)}</div>
                  <div className="cg-dd">{d.getDate()}</div>
                </div>
              )
            })}

            {timeRows.map((hour) => (
              <RowFragment
                key={hour}
                hour={hour}
                weekDays={weekDays}
                lessons={lessons}
                now={now}
                onCellClick={(cellDate, cellTime) => {
                  // Предзаполняем дату+время из ячейки grid — модалка
                  // подхватит initialDate/initialTime и автоматически
                  // выберет слот, если он свободен у выбранного препода.
                  setBookingPreset({ date: cellDate, time: cellTime })
                  setBookingOpen(true)
                }}
                isHappeningNow={isHappeningNow}
                teacherMap={teacherMap}
                trialIds={trialIds}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : lessons.length === 0 ? (
        <div className="empty">{t("weekEmpty")}</div>
      ) : (
        weekDays.map((d) => {
          const key = format(d, "yyyy-MM-dd")
          const dayLessons = lessonsByDay.get(key) ?? []
          if (dayLessons.length === 0) return null
          const today = isSameDay(d, now)
          const tomorrow = isTomorrow(d)
          const dayLabel = `${formatWeekdayLong(d, locale)}, ${formatLessonDayLong(d, locale)}`
          return (
            <div key={key}>
              <div className="list-title" style={today ? undefined : { marginTop: 20 }}>
                {dayLabel}
                {today ? <span className="ltb ltb--today">{t("todayBadge")}</span> : null}
                {tomorrow ? <span className="ltb ltb--tm">{t("tomorrowBadge")}</span> : null}
              </div>

              {dayLessons.map((lesson) => {
                const happening = isHappeningNow(lesson)
                const dt = new Date(lesson.scheduled_at)
                const end = new Date(dt.getTime() + lesson.duration_minutes * 60_000)
                const isDone = lesson.status === "completed"
                const isCancel = lesson.status === "cancelled"
                const isMissed = lesson.status === "no_show"
                const expired = isExpired(lesson)
                const joinable = canJoin(lesson)
                const teacher = lesson.teacher_id ? teacherMap[lesson.teacher_id] : null
                const rowCls = `lc${happening ? " lc--now" : ""}${isDone || expired ? " lc--done" : ""}${isCancel ? " lc--cancel" : ""}${isMissed ? " lc--missed" : ""}`
                const stripCls = `lc-strip${isDone || expired ? " lc-strip--done" : ""}${isCancel ? " lc-strip--cancel" : ""}${isMissed ? " lc-strip--missed" : ""}`
                const xpAmount = lesson.duration_minutes === 25 ? 25 : 50
                return (
                  <div key={lesson.id} className={rowCls}>
                    <div className={stripCls} />
                    <div className="lc-time">
                      <div className="lc-time-val">{formatLessonTime(dt, locale)}</div>
                      <div className="lc-time-dur">{t("minutesShort", { count: lesson.duration_minutes })}</div>
                      {!isCancel && !isMissed && !expired ? <div className="lc-time-xp">{t("xpReward", { xp: xpAmount })}</div> : null}
                    </div>
                    <div className="lc-body">
                      <div className="lc-name">
                        {trialIds.has(lesson.id) ? t("trialLesson") : t("oneOnOneLesson")}
                      </div>
                      <div className="lc-desc">
                        {formatLessonTime(dt, locale)}–{formatLessonTime(end, locale)}
                        {trialIds.has(lesson.id) ? t("freeNote") : ""}
                        {isDone ? t("doneNote") : ""}
                        {expired && !isDone ? t("expiredNote") : ""}
                        {isCancel ? t("cancelledNote") : ""}
                        {isMissed ? t("missedNote") : ""}
                      </div>
                    </div>
                    <div className="lc-teacher">
                      <div className="lc-tch-ava">{teacher?.initials ?? "??"}</div>
                      <div>
                        <div className="lc-tch-name">{teacher?.full_name ?? t("teacherFallback")}</div>
                        <div className="lc-tch-role">{t("teacherRole")}</div>
                      </div>
                    </div>
                    <div className="lc-action">
                      {isDone ? (
                        <span className="lc-btn lc-btn--done">{t("btnDone")}</span>
                      ) : isCancel ? (
                        <span className="lc-btn lc-btn--cancelled">{t("btnCancelled")}</span>
                      ) : isMissed ? (
                        <span className="lc-btn lc-btn--missed">{t("btnMissed")}</span>
                      ) : expired ? (
                        <span className="lc-btn lc-btn--cancelled">{t("btnExpired")}</span>
                      ) : joinable && lesson.status === "in_progress" ? (
                        <Link href={`/student/lesson/${lesson.id}`} className="lc-btn lc-btn--live">{t("btnLive")}</Link>
                      ) : joinable ? (
                        <Link href={`/student/lesson/${lesson.id}`} className="lc-btn lc-btn--join">{t("btnJoin")}</Link>
                      ) : (
                        <div className="lc-action-stack">
                          <span className="lc-btn lc-btn--wait">{t("btnPlanned")}</span>
                          <button
                            type="button"
                            className="lc-btn lc-btn--cancel-link"
                            disabled={cancellingId === lesson.id}
                            onClick={() => cancelLesson(lesson.id, lesson.scheduled_at)}
                          >
                            {cancellingId === lesson.id ? t("btnCancelling") : t("btnCancel")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      )}

      {bookingOpen ? (
        <LessonBookingModal
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          initialDate={bookingPreset?.date}
          initialTime={bookingPreset?.time}
          onBooked={(scheduledAt) => {
          // Прыгаем на неделю урока, чтобы свежая бронь сразу была видна.
          const dt = new Date(scheduledAt)
          const newWeekStart = startOfWeek(dt, { weekStartsOn: 1 })
          setWeekCursor(newWeekStart)
          // useEffect на weekStart вызовет fetchLessons автоматически.
        }}
        />
      ) : null}
    </div>
  )
}

function RowFragment({
  hour,
  weekDays,
  lessons,
  now,
  onCellClick,
  isHappeningNow,
  teacherMap,
  trialIds,
  locale,
  t,
}: {
  hour: number
  weekDays: Date[]
  lessons: LessonRow[]
  now: Date
  // Передаём родителю дату ячейки и время в формате "HH:mm" — модалка
  // ожидает initialTime по Europe/Moscow, тут локальный час совпадает
  // у MSK-аудитории; в других TZ предзаполнение времени просто молча
  // не сматчится, а дата всё равно подсветится.
  onCellClick: (date: Date, time: string) => void
  isHappeningNow: (l: LessonRow) => boolean
  teacherMap: Record<string, TeacherMapEntry>
  trialIds: Set<string>
  locale: TimeLocale
  t: ReturnType<typeof useTranslations>
}) {
  const label = `${String(hour).padStart(2, "0")}:00`
  return (
    <>
      <div className="cg-t">{label}</div>
      {weekDays.map((day) => {
        const lessonsInCell = lessons.filter((l) => {
          const d = new Date(l.scheduled_at)
          return isSameDay(d, day) && d.getHours() === hour && l.status !== "cancelled" && l.status !== "no_show"
        })
        const first = lessonsInCell[0]
        return (
          <div
            key={`${day.toISOString()}-${hour}`}
            className="cg-c"
            onClick={first ? undefined : () => onCellClick(day, label)}
          >
            {first ? (
              <EventChip lesson={first} now={now} isHappeningNow={isHappeningNow} teacherName={first.teacher_id ? teacherMap[first.teacher_id]?.full_name ?? null : null} isTrial={trialIds.has(first.id)} locale={locale} t={t} />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

function EventChip({
  lesson,
  now,
  isHappeningNow,
  teacherName,
  isTrial,
  locale,
  t,
}: {
  lesson: LessonRow
  now: Date
  isHappeningNow: (l: LessonRow) => boolean
  teacherName: string | null
  isTrial?: boolean
  locale: TimeLocale
  t: ReturnType<typeof useTranslations>
}) {
  const start = new Date(lesson.scheduled_at)
  const end = new Date(start.getTime() + lesson.duration_minutes * 60_000)
  const happening = isHappeningNow(lesson)
  const isDone = lesson.status === "completed"
  const height = Math.max(44, Math.min(64, (lesson.duration_minutes / 60) * 64))
  const cls = `ev${happening ? " ev--now" : ""}${isDone ? " ev--done" : ""}`
  const shortName = teacherName ? teacherName.split(" ")[0] : null
  return (
    <div className={cls} style={{ height }}>
      <div className="ev-t">
        {happening
          ? t("chipNow")
          : isTrial
            ? t("chipTrial")
            : shortName
              ? t("chipLessonWith", { name: shortName })
              : t("chipLesson")}
      </div>
      <div className="ev-s">
        {formatLessonTime(start, locale)}–{formatLessonTime(end, locale)}{isDone ? " ✓" : ""}
      </div>
    </div>
  )
}
