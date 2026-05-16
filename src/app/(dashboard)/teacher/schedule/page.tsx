// @ts-nocheck
"use client"

import "@/styles/dashboard/teacher-schedule.css"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  addDays,
  addWeeks,
  endOfDay,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns"
import { toast } from "sonner"
import { useTranslations, useLocale } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { useLessonsRealtime } from "@/hooks/use-lessons-realtime"
import { computeLessonAccess } from "@/lib/lesson-access"
import {
  formatLessonTime,
  formatLessonDayShort,
  formatLessonDayLong,
  formatWeekdayShort,
  formatWeekdayLong,
  isMoscowToday,
  isMoscowTomorrow,
  moscowDateKey,
  type TimeLocale,
} from "@/lib/time"

type LessonRow = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  student_id: string | null
  price: number | null
}

type StudentMapEntry = {
  full_name: string | null
  avatar_url: string | null
  initials: string
}

type StudentOption = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

type TimeRange = {
  start: string
  end: string
}

type DayAvailability = {
  active: boolean
  ranges: TimeRange[]
}

function asTimeLocale(locale: string): TimeLocale {
  return locale === "en" ? "en" : "ru"
}

/**
 * Простой ru-плюрал для счётчика уроков.
 * en всегда уходит в "many" ветку (она же plural form для англ.).
 */
function pluralKey(
  n: number,
  locale: TimeLocale
): "Empty" | "One" | "Few" | "Many" {
  if (n === 0) return "Empty"
  if (locale === "en") return n === 1 ? "One" : "Many"
  // ru rules: 1 -> one, 2-4 -> few, else many; модули по 100 для 11-19 → many.
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return "Many"
  if (mod10 === 1) return "One"
  if (mod10 >= 2 && mod10 <= 4) return "Few"
  return "Many"
}

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

function nextRoundHour(d: Date): { date: Date; hour: number } {
  const h = d.getHours() + 1
  const date = new Date(d)
  date.setHours(h, 0, 0, 0)
  return { date, hour: h }
}

export default function TeacherSchedulePage() {
  const t = useTranslations("dashboard.teacher.schedule")
  const localeRaw = useLocale()
  const locale = asTimeLocale(localeRaw)

  // mounted guard: страница time-зависимая (now / weekCursor / format(...)
  // в JSX), при SSR initial state new Date() != client new Date(), что
  // даёт React error #418. До mount возвращаем простой skeleton, после —
  // реальный рендер. SEO нам тут не нужен — за auth-walled страницами.
  const [mounted, setMounted] = useState(false)
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [studentMap, setStudentMap] = useState<Record<string, StudentMapEntry>>({})
  const [teacherProfileId, setTeacherProfileId] = useState<string | null>(null)
  const [hourlyRate, setHourlyRate] = useState<number>(0)
  const [weekCursor, setWeekCursor] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())
  const [trialIds, setTrialIds] = useState<Set<string>>(new Set())

  // Assign-dialog state
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignDate, setAssignDate] = useState<Date | null>(null)
  const [assignTime, setAssignTime] = useState<string>("09:00")
  const [assignDuration, setAssignDuration] = useState<25 | 50>(50)
  const [assignStudentId, setAssignStudentId] = useState<string>("")
  const [assignSearchQuery, setAssignSearchQuery] = useState<string>("")
  const [assignSearchResults, setAssignSearchResults] = useState<StudentOption[]>([])
  const [myStudents, setMyStudents] = useState<StudentOption[]>([])
  const [assignIsSubmitting, setAssignIsSubmitting] = useState(false)

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

  const fetchLessons = useCallback(async (from: Date, to: Date) => {
    setIsLoading(true)
    setLoadError(null)
    const supabase = createClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      setLoadError(t("errorAuthMissing"))
      setIsLoading(false)
      return
    }

    const { data: tp, error: tpError } = await (supabase as any)
      .from("teacher_profiles")
      .select("id, hourly_rate")
      .eq("user_id", user.id)
      .maybeSingle()

    if (tpError) {
      setLoadError(t("errorTeacherProfile", { message: tpError.message }))
      setIsLoading(false)
      return
    }
    if (!tp) {
      setLoadError(t("errorTeacherProfileMissing"))
      setIsLoading(false)
      return
    }

    setTeacherProfileId(tp.id)
    setHourlyRate(tp.hourly_rate ?? 0)

    const { data: rawLessons, error } = await (supabase as any)
      .from("lessons")
      .select("id, scheduled_at, duration_minutes, status, student_id, price")
      .eq("teacher_id", tp.id)
      .gte("scheduled_at", from.toISOString())
      .lte("scheduled_at", to.toISOString())
      .order("scheduled_at", { ascending: true })

    if (error) {
      setLoadError(t("errorLoadSchedule", { message: error.message }))
      setIsLoading(false)
      return
    }

    const list = (rawLessons ?? []) as LessonRow[]
    setLessons(list)

    // Помечаем уроки, которые были созданы через trial-flow.
    const lessonIds = list.map((l) => l.id)
    if (lessonIds.length > 0) {
      const { data: trials } = await (supabase as any)
        .from("trial_lesson_requests")
        .select("assigned_lesson_id")
        .in("assigned_lesson_id", lessonIds)
      const tset = new Set<string>()
      for (const t of (trials ?? []) as Array<{ assigned_lesson_id: string | null }>) {
        if (t.assigned_lesson_id) tset.add(t.assigned_lesson_id)
      }
      setTrialIds(tset)
    } else {
      setTrialIds(new Set())
    }

    const studentIds = Array.from(new Set(list.map((l) => l.student_id).filter(Boolean))) as string[]
    if (studentIds.length > 0) {
      const { data: profilesRaw } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", studentIds)
      const nextMap: Record<string, StudentMapEntry> = {}
      for (const p of (profilesRaw ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>) {
        nextMap[p.id] = {
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          initials: getInitials(p.full_name),
        }
      }
      setStudentMap(nextMap)
    } else {
      setStudentMap({})
    }

    setIsLoading(false)
  }, [t])

  useEffect(() => {
    fetchLessons(weekStart, weekEnd)
  }, [weekStart, weekEnd, fetchLessons])

  useLessonsRealtime({
    teacherId: teacherProfileId,
    onChange: () => fetchLessons(weekStart, weekEnd),
  })

  // Load "my students" — distinct student_ids from past lessons of this teacher
  const fetchMyStudents = useCallback(async () => {
    if (!teacherProfileId) return
    const supabase = createClient()
    const { data: pastLessons } = await (supabase as any)
      .from("lessons")
      .select("student_id")
      .eq("teacher_id", teacherProfileId)

    const ids = Array.from(
      new Set((pastLessons ?? []).map((l: any) => l.student_id).filter(Boolean))
    ) as string[]

    if (ids.length === 0) {
      setMyStudents([])
      return
    }

    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", ids)

    setMyStudents(
      ((profiles ?? []) as any[]).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url,
      }))
    )
  }, [teacherProfileId])

  useEffect(() => {
    fetchMyStudents()
  }, [fetchMyStudents])

  // Debounced search across all student profiles.
  useEffect(() => {
    const q = assignSearchQuery.trim()
    if (q.length < 2) {
      setAssignSearchResults([])
      return
    }
    const supabase = createClient()
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("role", "student")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10)
      if (!cancelled) {
        setAssignSearchResults(
          ((data ?? []) as any[]).map((p) => ({
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            avatar_url: p.avatar_url,
          }))
        )
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [assignSearchQuery])

  const studentOptions = useMemo<StudentOption[]>(() => {
    const map = new Map<string, StudentOption>()
    for (const s of myStudents) map.set(s.id, s)
    for (const s of assignSearchResults) if (!map.has(s.id)) map.set(s.id, s)
    return Array.from(map.values())
  }, [myStudents, assignSearchResults])

  const estimatedPriceKopeks = useMemo(
    () => Math.round((hourlyRate * assignDuration) / 60),
    [hourlyRate, assignDuration]
  )
  const estimatedPriceRub = Math.round(estimatedPriceKopeks / 100)

  // Stats
  const weekCount = lessons.filter((l) => l.status !== "cancelled" && l.status !== "no_show").length
  const completedCount = useMemo(
    () => lessons.filter((l) => l.status === "completed").length,
    [lessons]
  )
  const nextLesson = useMemo(() => {
    return lessons.find(
      (l) =>
        new Date(l.scheduled_at) >= now &&
        l.status !== "cancelled" &&
        l.status !== "no_show" &&
        l.status !== "completed"
    )
  }, [lessons, now])
  const weekEarningsRub = useMemo(() => {
    const sumKopeks = lessons
      .filter((l) => l.status === "completed")
      .reduce((sum, l) => sum + (l.price || 0), 0)
    return Math.round(sumKopeks / 100)
  }, [lessons])

  // Build dynamic time rows from lessons, fallback to common working hours.
  const timeRows = useMemo(() => {
    const hours = new Set<number>()
    for (const l of lessons) {
      if (l.status === "cancelled" || l.status === "no_show") continue
      const d = new Date(l.scheduled_at)
      hours.add(d.getHours())
    }
    const sorted = Array.from(hours).sort((a, b) => a - b)
    if (sorted.length === 0) return [9, 11, 13, 15, 17, 19]
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

  const lessonsByDay = useMemo(() => {
    const map = new Map<string, LessonRow[]>()
    for (const l of lessons) {
      const key = moscowDateKey(l.scheduled_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(l)
    }
    return map
  }, [lessons])

  function weekTitle(): string {
    const fromStr = formatLessonDayShort(weekStart, locale).replace(/[.,]$/, "")
    const toStr = formatLessonDayLong(addDays(weekStart, 6), locale)
    return t("weekTitle", { from: fromStr, to: toStr })
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

  function openAssignDialog(day: Date | null, hour: number | null) {
    if (day && hour !== null) {
      setAssignDate(day)
      setAssignTime(`${hour.toString().padStart(2, "0")}:00`)
    } else {
      const { date, hour: h } = nextRoundHour(new Date())
      setAssignDate(date)
      setAssignTime(`${h.toString().padStart(2, "0")}:00`)
    }
    setAssignDuration(50)
    setAssignStudentId("")
    setAssignSearchQuery("")
    setAssignSearchResults([])
    setAssignOpen(true)
  }

  function buildScheduledAt(): Date | null {
    if (!assignDate) return null
    const [hh, mm] = assignTime.split(":").map((s) => parseInt(s, 10))
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null
    const d = new Date(assignDate)
    d.setHours(hh, mm, 0, 0)
    return d
  }

  async function handleAssignSubmit() {
    if (!assignStudentId) {
      toast.error(t("toastNeedStudent"))
      return
    }
    const scheduledAt = buildScheduledAt()
    if (!scheduledAt) {
      toast.error(t("toastBadTime"))
      return
    }
    if (scheduledAt.getTime() < Date.now()) {
      toast.error(t("toastNoPast"))
      return
    }

    setAssignIsSubmitting(true)
    try {
      const res = await fetch("/api/booking/teacher-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: assignStudentId,
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: assignDuration,
        }),
      })

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? t("toastSlotTaken"))
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? t("toastErrorStatus", { status: res.status }))
        return
      }

      toast.success(t("toastSuccess"))
      setAssignOpen(false)
      await fetchLessons(weekStart, weekEnd)
    } catch (e: any) {
      toast.error(t("toastNetwork", { message: e?.message ?? "" }))
    } finally {
      setAssignIsSubmitting(false)
    }
  }

  if (!mounted) {
    // Простой skeleton, который ОДИНАКОВ на server и client — значит
    // нет hydration mismatch. После mount useEffect выше выставит
    // mounted=true и компонент перерендерит полноценно.
    return (
      <div className="tch-schedule">
        <div className="hdr">
          <h1>{t("headerH1Prefix")} <span className="gl">{t("headerH1Highlight")}</span></h1>
        </div>
        <div className="empty">{t("loadingSchedule")}</div>
      </div>
    )
  }

  const weekCountKey = pluralKey(weekCount, locale)
  const weekCountSubMap = {
    Empty: t("statThisWeekEmpty"),
    One: t("statThisWeekOne"),
    Few: t("statThisWeekFew"),
    Many: t("statThisWeekMany"),
  } as const

  return (
    <div className="tch-schedule">
      <div className="hdr">
        <h1>{t("headerH1Prefix")} <span className="gl">{t("headerH1Highlight")}</span></h1>
        <div className="hdr-right">
          <button className="btn btn-dark" onClick={() => openAssignDialog(null, null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {t("assignLesson")}
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="st st--red">
          <div className="st-label">{t("statThisWeek")}</div>
          <div className="st-val">{weekCount}</div>
          <div className="st-sub">{weekCountSubMap[weekCountKey]}</div>
        </div>
        <div className="st">
          <div className="st-label">{t("statCompleted")}</div>
          <div className="st-val">{completedCount}</div>
          <div className="st-sub">{t("statCompletedSub")}</div>
        </div>
        <div className={`st ${nextLesson ? "st--lime" : ""}`}>
          <div className="st-label">{t("statNextLesson")}</div>
          <div className="st-val">
            {nextLesson ? (
              <span className="gl">{formatLessonTime(nextLesson.scheduled_at, locale)}</span>
            ) : (
              t("statNextEmpty")
            )}
          </div>
          <div className="st-sub">
            {nextLesson
              ? isMoscowToday(nextLesson.scheduled_at, now)
                ? t("statNextSubToday")
                : isMoscowTomorrow(nextLesson.scheduled_at, now)
                  ? t("statNextSubTomorrow")
                  : formatLessonDayShort(nextLesson.scheduled_at, locale)
              : t("statNextSubNothing")}
          </div>
        </div>
        <div className="st">
          <div className="st-label">{t("statEarnings")}</div>
          <div className="st-val">
            {t("statEarningsValue", {
              value: weekEarningsRub.toLocaleString(locale === "en" ? "en-US" : "ru-RU"),
            })}
          </div>
          <div className="st-sub">{t("statEarningsSub")}</div>
        </div>
      </div>

      <div className="cal-card">
        <div className="cal-top">
          <div className="cal-top-nav">
            <button className="cal-nav-btn" onClick={goPrev} aria-label={t("navPrev")}>←</button>
            <div className="cal-top-title">{weekTitle()}</div>
            <button className="cal-nav-btn" onClick={goNext} aria-label={t("navNext")}>→</button>
          </div>
          <button className="cal-today-btn" onClick={goToday}>{t("navToday")}</button>
        </div>

        <div className="cal-legend">
          <div className="leg"><div className="leg-dot leg-dot--l"></div>{t("legend1on1")}</div>
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
                  <div className="cg-dd">{format(d, "d")}</div>
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
                onCellClick={(day, h) => openAssignDialog(day, h)}
                isHappeningNow={isHappeningNow}
                studentMap={studentMap}
                trialIds={trialIds}
                locale={locale}
                ariaAssignAt={(day, time) =>
                  t("ariaAssignAt", { date: formatLessonDayLong(day, locale), time })
                }
                evNowLabel={t("evNow")}
                evTrialLabel={t("evTrial")}
                evWithName={(name) => t("evWithName", { name })}
                evDefaultLabel={t("evDefault")}
              />
            ))}
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="empty">{loadError}</div>
      ) : isLoading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : lessons.length === 0 ? (
        <div className="empty">{t("emptyWeek")}</div>
      ) : (
        weekDays.map((d) => {
          const key = moscowDateKey(d)
          const dayLessons = lessonsByDay.get(key) ?? []
          if (dayLessons.length === 0) return null
          const today = isMoscowToday(d, now)
          const tomorrow = isMoscowTomorrow(d, now)
          const dayTitle = `${formatWeekdayLong(d, locale)}, ${formatLessonDayLong(d, locale)}`
          return (
            <div key={key}>
              <div className="list-title" style={today ? undefined : { marginTop: 20 }}>
                {dayTitle}
                {today ? <span className="ltb ltb--today">{t("labelToday")}</span> : null}
                {tomorrow ? <span className="ltb ltb--tm">{t("labelTomorrow")}</span> : null}
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
                const student = lesson.student_id ? studentMap[lesson.student_id] : null
                const rowCls = `lc${happening ? " lc--now" : ""}${isDone || expired ? " lc--done" : ""}${isCancel ? " lc--cancel" : ""}${isMissed ? " lc--missed" : ""}`
                const stripCls = `lc-strip${isDone || expired ? " lc-strip--done" : ""}${isCancel ? " lc-strip--cancel" : ""}${isMissed ? " lc-strip--missed" : ""}`
                const priceRub = lesson.price ? Math.round(lesson.price / 100) : null
                const isTrial = trialIds.has(lesson.id)
                return (
                  <div key={lesson.id} className={rowCls}>
                    <div className={stripCls} />
                    <div className="lc-time">
                      <div className="lc-time-val">{formatLessonTime(dt, locale)}</div>
                      <div className="lc-time-dur">{t("minutesShort", { count: lesson.duration_minutes })}</div>
                      {!isCancel && !isMissed && !expired && priceRub ? (
                        <div className="lc-time-xp">
                          {t("lessonPriceRub", {
                            value: priceRub.toLocaleString(locale === "en" ? "en-US" : "ru-RU"),
                          })}
                        </div>
                      ) : null}
                      {!isCancel && !isMissed && !expired && isTrial ? (
                        <div className="lc-time-xp lc-time-xp--trial">{t("lessonPriceFree")}</div>
                      ) : null}
                    </div>
                    <div className="lc-body">
                      <div className="lc-name">
                        {isTrial ? <span className="lc-trial-badge">{t("lessonBadgeTrial")}</span> : null}
                        {isTrial ? t("lessonNameTrial") : t("lessonName1on1")}
                      </div>
                      <div className="lc-desc">
                        {formatLessonTime(dt, locale)}–{formatLessonTime(end, locale)}
                        {isTrial ? t("lessonDescTrialSuffix") : ""}
                        {isDone ? t("lessonDescDoneSuffix") : ""}
                        {expired && !isDone ? t("lessonDescExpiredSuffix") : ""}
                        {isCancel ? t("lessonDescCancelSuffix") : ""}
                        {isMissed ? t("lessonDescMissedSuffix") : ""}
                      </div>
                    </div>
                    <div className="lc-teacher">
                      <div className="lc-tch-ava">
                        {student?.avatar_url ? (
                          <img src={student.avatar_url} alt={student.full_name ?? ""} />
                        ) : (
                          student?.initials ?? "??"
                        )}
                      </div>
                      <div>
                        <div className="lc-tch-name">{student?.full_name ?? t("studentFallback")}</div>
                        <div className="lc-tch-role">{t("studentRole")}</div>
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
                      ) : joinable ? (
                        <Link href={`/teacher/lesson/${lesson.id}`} className="lc-btn lc-btn--join">{t("btnJoin")}</Link>
                      ) : (
                        <span className="lc-btn lc-btn--wait">{t("btnPlanned")}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      )}

      <AvailabilityEditor />

      {assignOpen && (
        <AssignDialog
          onClose={() => setAssignOpen(false)}
          assignDate={assignDate}
          assignTime={assignTime}
          setAssignTime={setAssignTime}
          assignDuration={assignDuration}
          setAssignDuration={setAssignDuration}
          assignStudentId={assignStudentId}
          setAssignStudentId={setAssignStudentId}
          assignSearchQuery={assignSearchQuery}
          setAssignSearchQuery={setAssignSearchQuery}
          studentOptions={studentOptions}
          estimatedPriceRub={estimatedPriceRub}
          hourlyRate={hourlyRate}
          isSubmitting={assignIsSubmitting}
          onSubmit={handleAssignSubmit}
          locale={locale}
        />
      )}
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
  studentMap,
  trialIds,
  locale,
  ariaAssignAt,
  evNowLabel,
  evTrialLabel,
  evWithName,
  evDefaultLabel,
}: {
  hour: number
  weekDays: Date[]
  lessons: LessonRow[]
  now: Date
  onCellClick: (day: Date, hour: number) => void
  isHappeningNow: (l: LessonRow) => boolean
  studentMap: Record<string, StudentMapEntry>
  trialIds: Set<string>
  locale: TimeLocale
  ariaAssignAt: (day: Date, time: string) => string
  evNowLabel: string
  evTrialLabel: string
  evWithName: (name: string) => string
  evDefaultLabel: string
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
        const cellDate = new Date(day)
        cellDate.setHours(hour, 0, 0, 0)
        const isPast = cellDate.getTime() < now.getTime()
        const isEmpty = !first
        const isClickable = isEmpty && !isPast
        const cls = `cg-c${isPast && isEmpty ? " cg-c--past" : ""}${isClickable ? " cg-c--plus" : ""}`
        return (
          <div
            key={`${day.toISOString()}-${hour}`}
            className={cls}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={isClickable ? () => onCellClick(day, hour) : undefined}
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onCellClick(day, hour)
                    }
                  }
                : undefined
            }
            aria-label={isClickable ? ariaAssignAt(day, label) : undefined}
          >
            {first ? (
              <EventChip
                lesson={first}
                isHappeningNow={isHappeningNow}
                studentName={first.student_id ? studentMap[first.student_id]?.full_name ?? null : null}
                isTrial={trialIds.has(first.id)}
                locale={locale}
                evNowLabel={evNowLabel}
                evTrialLabel={evTrialLabel}
                evWithName={evWithName}
                evDefaultLabel={evDefaultLabel}
              />
            ) : isClickable ? (
              "+"
            ) : null}
          </div>
        )
      })}
    </>
  )
}

function EventChip({
  lesson,
  isHappeningNow,
  studentName,
  isTrial,
  locale,
  evNowLabel,
  evTrialLabel,
  evWithName,
  evDefaultLabel,
}: {
  lesson: LessonRow
  isHappeningNow: (l: LessonRow) => boolean
  studentName: string | null
  isTrial?: boolean
  locale: TimeLocale
  evNowLabel: string
  evTrialLabel: string
  evWithName: (name: string) => string
  evDefaultLabel: string
}) {
  const start = new Date(lesson.scheduled_at)
  const end = new Date(start.getTime() + lesson.duration_minutes * 60_000)
  const happening = isHappeningNow(lesson)
  const isDone = lesson.status === "completed"
  const height = Math.max(44, Math.min(64, (lesson.duration_minutes / 60) * 64))
  const cls = `ev${happening ? " ev--now" : ""}${isDone ? " ev--done" : ""}`
  const shortName = studentName ? studentName.split(" ")[0] : null
  return (
    <div className={cls} style={{ height }}>
      <div className="ev-t">
        {happening ? evNowLabel : isTrial ? evTrialLabel : shortName ? evWithName(shortName) : evDefaultLabel}
      </div>
      <div className="ev-s">
        {formatLessonTime(start, locale)}–{formatLessonTime(end, locale)}{isDone ? " ✓" : ""}
      </div>
    </div>
  )
}

function AssignDialog({
  onClose,
  assignDate,
  assignTime,
  setAssignTime,
  assignDuration,
  setAssignDuration,
  assignStudentId,
  setAssignStudentId,
  assignSearchQuery,
  setAssignSearchQuery,
  studentOptions,
  estimatedPriceRub,
  hourlyRate,
  isSubmitting,
  onSubmit,
  locale,
}: {
  onClose: () => void
  assignDate: Date | null
  assignTime: string
  setAssignTime: (v: string) => void
  assignDuration: 25 | 50
  setAssignDuration: (v: 25 | 50) => void
  assignStudentId: string
  setAssignStudentId: (v: string) => void
  assignSearchQuery: string
  setAssignSearchQuery: (v: string) => void
  studentOptions: StudentOption[]
  estimatedPriceRub: number
  hourlyRate: number
  isSubmitting: boolean
  onSubmit: () => void
  locale: TimeLocale
}) {
  const t = useTranslations("dashboard.teacher.schedule")
  const numLocale = locale === "en" ? "en-US" : "ru-RU"
  const subtitle = assignDate
    ? `${formatWeekdayLong(assignDate, locale)}, ${formatLessonDayLong(assignDate, locale)}`
    : ""

  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()}>
        <div className="mdl-h">
          <div>
            <div className="mdl-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
              {t("modalAssignTitle")}
            </div>
            <div className="mdl-sub">{subtitle}</div>
          </div>
          <button className="mdl-close" onClick={onClose} aria-label={t("modalClose")}>✕</button>
        </div>

        <div className="mdl-b">
          <div>
            <label className="mdl-lbl" htmlFor="assign-student-search">{t("modalStudent")}</label>
            <input
              id="assign-student-search"
              className="mdl-input"
              placeholder={t("modalSearchPlaceholder")}
              value={assignSearchQuery}
              onChange={(e) => setAssignSearchQuery(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div className="mdl-results">
              {studentOptions.length === 0 ? (
                <div className="mdl-empty">
                  {assignSearchQuery.trim().length >= 2
                    ? t("modalNoResults")
                    : t("modalDefaultHint")}
                </div>
              ) : (
                studentOptions.map((s) => (
                  <div
                    key={s.id}
                    className={`mdl-result${assignStudentId === s.id ? " mdl-result--on" : ""}`}
                    onClick={() => setAssignStudentId(s.id)}
                  >
                    <div>{s.full_name}</div>
                    <div className="mdl-result-sm">{s.email}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="mdl-lbl">{t("modalDuration")}</label>
            <div className="mdl-dur">
              {([25, 50] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`mdl-dur-btn${assignDuration === d ? " mdl-dur-btn--on" : ""}`}
                  onClick={() => setAssignDuration(d)}
                >
                  {t("minutesShort", { count: d })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mdl-lbl" htmlFor="assign-time">{t("modalTime")}</label>
            <input
              id="assign-time"
              className="mdl-input"
              type="time"
              value={assignTime}
              onChange={(e) => setAssignTime(e.target.value)}
              style={{ width: 140 }}
            />
          </div>

          <div className="mdl-price" style={{ flexWrap: "wrap" }}>
            <span className="mdl-price-lbl">{t("modalRateLabel")}</span>
            <span className="mdl-price-val">
              {t("lessonPriceRub", { value: estimatedPriceRub.toLocaleString(numLocale) })}
            </span>
            <div className="mdl-price-sub">
              {t("modalRateSub", {
                duration: assignDuration,
                hourly: (hourlyRate / 100).toLocaleString(numLocale),
              })}
            </div>
          </div>
        </div>

        <div className="mdl-f">
          <button className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>{t("modalCancel")}</button>
          <button
            className="btn btn-dark"
            onClick={onSubmit}
            disabled={isSubmitting || !assignStudentId}
          >
            {isSubmitting ? t("modalSubmitting") : t("modalSubmit")}
          </button>
        </div>
      </div>
    </div>
  )
}

function AvailabilityEditor() {
  const t = useTranslations("dashboard.teacher.schedule")
  const localeRaw = useLocale()
  const locale = asTimeLocale(localeRaw)

  const dayFullNames = useMemo(
    () => [
      t("weekdayMon"),
      t("weekdayTue"),
      t("weekdayWed"),
      t("weekdayThu"),
      t("weekdayFri"),
      t("weekdaySat"),
      t("weekdaySun"),
    ],
    [t]
  )

  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [blockDate, setBlockDate] = useState("")
  // Когда в БД ноль строк — preview-default Пн-Пт 09-18 "врёт" преподу,
  // он видит активные тогглы и не сохраняет. Из-за этого ученики реально
  // не могут записаться. Теперь:
  //  - initial state = всё выключено (один и тот же на server и client),
  //  - после load если в БД пусто — выставляем preview Пн-Пт 09-18 + флаг
  //    notSavedYet, на основе которого показываем баннер «нажми Сохранить».
  const [hasSavedSchedule, setHasSavedSchedule] = useState(false)

  const emptyAvailability: DayAvailability[] = dayFullNames.map(() => ({
    active: false,
    ranges: [],
  }))
  const previewAvailability: DayAvailability[] = dayFullNames.map((_, i) => ({
    active: i < 5,
    ranges: i < 5 ? [{ start: "09:00", end: "18:00" }] : [],
  }))

  const [availability, setAvailability] =
    useState<DayAvailability[]>(emptyAvailability)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        if (authErr) console.error("auth error:", authErr)
        setIsLoading(false)
        return
      }

      const { data: tp, error: tpError } = await (supabase as any)
        .from("teacher_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (tpError) {
        toast.error(t("availToastProfile", { message: tpError.message }))
        setIsLoading(false)
        return
      }

      if (!tp) {
        toast.error(t("availToastProfileMissing"))
        setIsLoading(false)
        return
      }

      const { data: rows, error: rowsError } = await (supabase as any)
        .from("teacher_availability")
        .select("day_of_week, start_time, end_time, is_active")
        .eq("teacher_id", tp.id)
        .order("start_time", { ascending: true })

      if (rowsError) {
        toast.error(t("availToastLoadError", { message: rowsError.message }))
      }

      if (rows && rows.length > 0) {
        const grouped: DayAvailability[] = dayFullNames.map(() => ({ active: false, ranges: [] }))
        for (const row of rows as any[]) {
          // DB: 0=Sun,1=Mon..6=Sat → UI: 0=Mon..6=Sun
          const uiDay = row.day_of_week === 0 ? 6 : row.day_of_week - 1
          if (uiDay >= 0 && uiDay < 7) {
            grouped[uiDay].active = true
            grouped[uiDay].ranges.push({
              start: (row.start_time as string).slice(0, 5),
              end: (row.end_time as string).slice(0, 5),
            })
          }
        }
        setAvailability(grouped)
        setHasSavedSchedule(true)
      } else {
        // В БД пусто — заполним preview-расписанием Пн-Пт 09-18, чтобы
        // преподу не пришлось проставлять с нуля; но сохранения ещё не
        // было, hasSavedSchedule остаётся false → баннер сверху напомнит
        // нажать «Сохранить».
        setAvailability(previewAvailability)
        setHasSavedSchedule(false)
      }
      setIsLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleDay(index: number) {
    setAvailability((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        active: !next[index].active,
        ranges: !next[index].active
          ? next[index].ranges.length
            ? next[index].ranges
            : [{ start: "09:00", end: "18:00" }]
          : next[index].ranges,
      }
      return next
    })
  }

  function addRange(dayIndex: number) {
    setAvailability((prev) => {
      const next = [...prev]
      const lastRange = next[dayIndex].ranges[next[dayIndex].ranges.length - 1]
      const newStart = lastRange ? lastRange.end : "09:00"
      next[dayIndex] = {
        ...next[dayIndex],
        ranges: [
          ...next[dayIndex].ranges,
          { start: newStart, end: "18:00" },
        ],
      }
      return next
    })
  }

  function removeRange(dayIndex: number, rangeIndex: number) {
    setAvailability((prev) => {
      const next = [...prev]
      next[dayIndex] = {
        ...next[dayIndex],
        ranges: next[dayIndex].ranges.filter((_, i) => i !== rangeIndex),
      }
      return next
    })
  }

  function updateRange(
    dayIndex: number,
    rangeIndex: number,
    field: "start" | "end",
    value: string
  ) {
    setAvailability((prev) => {
      const next = [...prev]
      const ranges = [...next[dayIndex].ranges]
      ranges[rangeIndex] = { ...ranges[rangeIndex], [field]: value }
      next[dayIndex] = { ...next[dayIndex], ranges }
      return next
    })
  }

  async function handleSave() {
    setIsSaving(true)

    try {
      const supabase = createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        toast.error(t("availToastAuth"))
        setIsSaving(false)
        return
      }

      const { data: tp } = await (supabase as any)
        .from("teacher_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (!tp) throw new Error("Teacher profile not found")

      await (supabase.from("teacher_availability") as any).delete().eq("teacher_id", tp.id)

      const rows: any[] = []
      availability.forEach((day, uiIndex) => {
        if (!day.active || day.ranges.length === 0) return
        // UI: 0=Mon..6=Sun → DB: 0=Sun,1=Mon..6=Sat
        const dbDay = uiIndex === 6 ? 0 : uiIndex + 1
        for (const range of day.ranges) {
          rows.push({
            teacher_id: tp.id,
            day_of_week: dbDay,
            start_time: range.start + ":00",
            end_time: range.end + ":00",
            is_active: true,
          })
        }
      })

      if (rows.length > 0) {
        const { error } = await (supabase.from("teacher_availability") as any).insert(rows)
        if (error) throw error
      }

      toast.success(t("availToastSaved"))
    } catch (e: any) {
      toast.error(t("availToastSaveError", { message: e?.message ?? "" }))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBlockDate() {
    if (!blockDate) return

    try {
      toast.success(
        t("blockToastSuccess", { date: formatLessonDayLong(new Date(blockDate), locale) })
      )
      setShowBlockDialog(false)
      setBlockDate("")
    } catch {
      toast.error(t("blockToastError"))
    }
  }

  return (
    <>
      <div className="av-card">
        <div className="av-head">
          <div className="av-head-title">{t("availTitle")}</div>
          <div className="av-head-actions">
            <button className="btn btn-outline" onClick={() => setShowBlockDialog(true)}>
              {t("availBlockBtn")}
            </button>
            <button
              className="btn btn-lime"
              onClick={async () => {
                await handleSave()
                setHasSavedSchedule(true)
              }}
              disabled={isSaving}
            >
              {isSaving ? t("availSaving") : t("availSaveBtn")}
            </button>
          </div>
        </div>
        <div className="av-body">
          {!isLoading && !hasSavedSchedule && (
            <div
              role="alert"
              style={{
                background: "rgba(182,63,55,.08)",
                border: "1px solid rgba(182,63,55,.25)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 14,
                fontSize: 13,
                color: "var(--text)",
                lineHeight: 1.45,
              }}
            >
              <b style={{ color: "var(--red)" }}>{t("availUnsavedTitle")}</b>{" "}
              {t("availUnsavedBody")}
            </div>
          )}
          {isLoading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            availability.map((day, dayIdx) => (
              <div
                key={dayIdx}
                className={`av-row${day.active ? "" : " av-row--off"}`}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={day.active}
                  aria-label={t("availSwitchAria", {
                    day: dayFullNames[dayIdx],
                    state: day.active ? t("availSwitchOn") : t("availSwitchOff"),
                  })}
                  onClick={() => toggleDay(dayIdx)}
                  className={`av-sw${day.active ? " av-sw--on" : ""}`}
                >
                  <span className="av-sw-dot" />
                </button>

                <span className="av-day-lbl">{dayFullNames[dayIdx]}</span>

                {day.active && (
                  <div className="av-ranges">
                    {day.ranges.map((range, rangeIdx) => (
                      <div key={rangeIdx} className="av-range">
                        <input
                          type="time"
                          value={range.start}
                          onChange={(e) => updateRange(dayIdx, rangeIdx, "start", e.target.value)}
                          aria-label={t("availRangeStart")}
                        />
                        <span className="av-range-sep">—</span>
                        <input
                          type="time"
                          value={range.end}
                          onChange={(e) => updateRange(dayIdx, rangeIdx, "end", e.target.value)}
                          aria-label={t("availRangeEnd")}
                        />
                        {day.ranges.length > 1 && (
                          <button
                            type="button"
                            className="av-icon-btn"
                            onClick={() => removeRange(dayIdx, rangeIdx)}
                            aria-label={t("availRangeRemove")}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="av-icon-btn av-icon-btn--add"
                      onClick={() => addRange(dayIdx)}
                      aria-label={t("availRangeAdd")}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showBlockDialog && (
        <div className="mdl-backdrop" onClick={() => setShowBlockDialog(false)}>
          <div className="mdl" onClick={(e) => e.stopPropagation()}>
            <div className="mdl-h">
              <div className="mdl-title">{t("blockTitle")}</div>
              <button className="mdl-close" onClick={() => setShowBlockDialog(false)} aria-label={t("modalClose")}>✕</button>
            </div>
            <div className="mdl-b">
              <p style={{ fontSize: ".8rem", color: "var(--muted)", margin: 0 }}>
                {t("blockBody")}
              </p>
              <input
                className="mdl-input"
                type="date"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="mdl-f">
              <button className="btn btn-outline" onClick={() => setShowBlockDialog(false)}>{t("blockCancel")}</button>
              <button
                className="btn btn-dark"
                onClick={handleBlockDate}
                disabled={!blockDate}
              >
                {t("blockSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
