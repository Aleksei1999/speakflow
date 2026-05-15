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
  isToday,
  isTomorrow,
  startOfWeek,
} from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useLessonsRealtime } from "@/hooks/use-lessons-realtime"
import { computeLessonAccess } from "@/lib/lesson-access"

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

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const DAY_FULL_NAMES = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
]

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
      setLoadError("Не удалось определить пользователя. Перезайдите в систему.")
      setIsLoading(false)
      return
    }

    const { data: tp, error: tpError } = await (supabase as any)
      .from("teacher_profiles")
      .select("id, hourly_rate")
      .eq("user_id", user.id)
      .maybeSingle()

    if (tpError) {
      setLoadError(`Не удалось загрузить профиль преподавателя: ${tpError.message}`)
      setIsLoading(false)
      return
    }
    if (!tp) {
      setLoadError("Профиль преподавателя не найден. Обратитесь к администратору.")
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
      setLoadError(`Ошибка загрузки расписания: ${error.message}`)
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
  }, [])

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
      const key = format(new Date(l.scheduled_at), "yyyy-MM-dd")
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(l)
    }
    return map
  }, [lessons])

  function weekTitle(): string {
    const from = format(weekStart, "d", { locale: ru })
    const to = format(addDays(weekStart, 6), "d MMMM yyyy", { locale: ru })
    return `${from} — ${to}`
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
      toast.error("Выберите ученика")
      return
    }
    const scheduledAt = buildScheduledAt()
    if (!scheduledAt) {
      toast.error("Некорректное время урока")
      return
    }
    if (scheduledAt.getTime() < Date.now()) {
      toast.error("Нельзя назначать урок в прошлом")
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
        toast.error(body?.error ?? "Слот занят. Выберите другое время.")
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? `Ошибка ${res.status}`)
        return
      }

      toast.success("Урок назначен. Ученику отправлено уведомление об оплате.")
      setAssignOpen(false)
      await fetchLessons(weekStart, weekEnd)
    } catch (e: any) {
      toast.error("Ошибка сети: " + (e?.message ?? ""))
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
          <h1>Моё <span className="gl">schedule</span></h1>
        </div>
        <div className="empty">Загружаем расписание…</div>
      </div>
    )
  }

  return (
    <div className="tch-schedule">
      <div className="hdr">
        <h1>Моё <span className="gl">schedule</span></h1>
        <div className="hdr-right">
          <button className="btn btn-dark" onClick={() => openAssignDialog(null, null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Назначить урок
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="st st--red">
          <div className="st-label">Эта неделя</div>
          <div className="st-val">{weekCount}</div>
          <div className="st-sub">
            {weekCount === 0
              ? "нет занятий"
              : weekCount === 1
                ? "урок на этой неделе"
                : weekCount < 5
                  ? "урока на этой неделе"
                  : "уроков на этой неделе"}
          </div>
        </div>
        <div className="st">
          <div className="st-label">Проведено</div>
          <div className="st-val">{completedCount}</div>
          <div className="st-sub">уроков за неделю</div>
        </div>
        <div className={`st ${nextLesson ? "st--lime" : ""}`}>
          <div className="st-label">Следующий урок</div>
          <div className="st-val">
            {nextLesson ? <span className="gl">{format(new Date(nextLesson.scheduled_at), "HH:mm")}</span> : "—"}
          </div>
          <div className="st-sub">
            {nextLesson
              ? `${isToday(new Date(nextLesson.scheduled_at)) ? "сегодня" : isTomorrow(new Date(nextLesson.scheduled_at)) ? "завтра" : format(new Date(nextLesson.scheduled_at), "d MMM", { locale: ru })}`
              : "ничего не запланировано"}
          </div>
        </div>
        <div className="st">
          <div className="st-label">Заработано за неделю</div>
          <div className="st-val">{weekEarningsRub.toLocaleString("ru-RU")} ₽</div>
          <div className="st-sub">за завершённые уроки</div>
        </div>
      </div>

      <div className="cal-card">
        <div className="cal-top">
          <div className="cal-top-nav">
            <button className="cal-nav-btn" onClick={goPrev} aria-label="Предыдущая неделя">←</button>
            <div className="cal-top-title">{weekTitle()}</div>
            <button className="cal-nav-btn" onClick={goNext} aria-label="Следующая неделя">→</button>
          </div>
          <button className="cal-today-btn" onClick={goToday}>Сегодня</button>
        </div>

        <div className="cal-legend">
          <div className="leg"><div className="leg-dot leg-dot--l"></div>Урок 1-on-1</div>
          <div className="leg"><div className="leg-dot leg-dot--done"></div>Завершён</div>
          <div className="leg"><div className="leg-dot leg-dot--cancel"></div>Отменён</div>
        </div>

        <div className="cg-wrap">
          <div className="cg">
            <div className="cg-corner" />
            {weekDays.map((d) => {
              const today = isSameDay(d, now)
              return (
                <div key={d.toISOString()} className={`cg-dh${today ? " cg-dh--today" : ""}`}>
                  <div className="cg-dn">{format(d, "EEEEEE", { locale: ru })}</div>
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
        <div className="empty">На этой неделе занятий нет. Назначь урок через кнопку выше ↑</div>
      ) : (
        weekDays.map((d) => {
          const key = format(d, "yyyy-MM-dd")
          const dayLessons = lessonsByDay.get(key) ?? []
          if (dayLessons.length === 0) return null
          const today = isSameDay(d, now)
          const tomorrow = isTomorrow(d)
          return (
            <div key={key}>
              <div className="list-title" style={today ? undefined : { marginTop: 20 }}>
                {format(d, "EEEE, d MMMM", { locale: ru })}
                {today ? <span className="ltb ltb--today">Сегодня</span> : null}
                {tomorrow ? <span className="ltb ltb--tm">Завтра</span> : null}
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
                      <div className="lc-time-val">{format(dt, "HH:mm")}</div>
                      <div className="lc-time-dur">{lesson.duration_minutes} мин</div>
                      {!isCancel && !isMissed && !expired && priceRub ? <div className="lc-time-xp">{priceRub.toLocaleString("ru-RU")} ₽</div> : null}
                      {!isCancel && !isMissed && !expired && isTrial ? <div className="lc-time-xp lc-time-xp--trial">Бесплатно</div> : null}
                    </div>
                    <div className="lc-body">
                      <div className="lc-name">
                        {isTrial ? <span className="lc-trial-badge">🎯 Пробный</span> : null}
                        {isTrial ? "Пробный урок" : "Урок 1-on-1"}
                      </div>
                      <div className="lc-desc">
                        {format(dt, "HH:mm")}–{format(end, "HH:mm")}
                        {isTrial ? " · бесплатное знакомство" : ""}
                        {isDone ? " · ✓ завершён" : ""}
                        {expired && !isDone ? " · время прошло" : ""}
                        {isCancel ? " · отменён" : ""}
                        {isMissed ? " · пропущен" : ""}
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
                        <div className="lc-tch-name">{student?.full_name ?? "Ученик"}</div>
                        <div className="lc-tch-role">Ученик</div>
                      </div>
                    </div>
                    <div className="lc-action">
                      {isDone ? (
                        <span className="lc-btn lc-btn--done">✓ Завершён</span>
                      ) : isCancel ? (
                        <span className="lc-btn lc-btn--cancelled">Отменён</span>
                      ) : isMissed ? (
                        <span className="lc-btn lc-btn--missed">Пропущен</span>
                      ) : expired ? (
                        <span className="lc-btn lc-btn--cancelled">Урок завершён</span>
                      ) : joinable ? (
                        <Link href={`/teacher/lesson/${lesson.id}`} className="lc-btn lc-btn--join">▶ Зайти в урок</Link>
                      ) : (
                        <span className="lc-btn lc-btn--wait">Запланирован</span>
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
}: {
  hour: number
  weekDays: Date[]
  lessons: LessonRow[]
  now: Date
  onCellClick: (day: Date, hour: number) => void
  isHappeningNow: (l: LessonRow) => boolean
  studentMap: Record<string, StudentMapEntry>
  trialIds: Set<string>
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
            aria-label={
              isClickable
                ? `Назначить урок ${format(day, "d MMMM", { locale: ru })} в ${label}`
                : undefined
            }
          >
            {first ? (
              <EventChip
                lesson={first}
                isHappeningNow={isHappeningNow}
                studentName={first.student_id ? studentMap[first.student_id]?.full_name ?? null : null}
                isTrial={trialIds.has(first.id)}
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
}: {
  lesson: LessonRow
  isHappeningNow: (l: LessonRow) => boolean
  studentName: string | null
  isTrial?: boolean
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
        {happening ? "⚡ Сейчас" : isTrial ? "🎯 Пробный" : shortName ? `Урок · ${shortName}` : "Урок 1-on-1"}
      </div>
      <div className="ev-s">
        {format(start, "HH:mm")}–{format(end, "HH:mm")}{isDone ? " ✓" : ""}
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
}) {
  return (
    <div className="mdl-backdrop" onClick={onClose}>
      <div className="mdl" onClick={(e) => e.stopPropagation()}>
        <div className="mdl-h">
          <div>
            <div className="mdl-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
              Назначить урок
            </div>
            <div className="mdl-sub">
              {assignDate ? format(assignDate, "EEEE, d MMMM yyyy", { locale: ru }) : ""}
            </div>
          </div>
          <button className="mdl-close" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        <div className="mdl-b">
          <div>
            <label className="mdl-lbl" htmlFor="assign-student-search">Ученик</label>
            <input
              id="assign-student-search"
              className="mdl-input"
              placeholder="Поиск по имени или email"
              value={assignSearchQuery}
              onChange={(e) => setAssignSearchQuery(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div className="mdl-results">
              {studentOptions.length === 0 ? (
                <div className="mdl-empty">
                  {assignSearchQuery.trim().length >= 2
                    ? "Никого не найдено"
                    : "Ваши ученики появятся здесь. Или введите имя/email для поиска."}
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
            <label className="mdl-lbl">Длительность</label>
            <div className="mdl-dur">
              {([25, 50] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`mdl-dur-btn${assignDuration === d ? " mdl-dur-btn--on" : ""}`}
                  onClick={() => setAssignDuration(d)}
                >
                  {d} мин
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mdl-lbl" htmlFor="assign-time">Время</label>
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
            <span className="mdl-price-lbl">Ваша ставка за урок</span>
            <span className="mdl-price-val">{estimatedPriceRub.toLocaleString("ru-RU")} ₽</span>
            <div className="mdl-price-sub">
              {assignDuration} мин · {(hourlyRate / 100).toLocaleString("ru-RU")} ₽/час
            </div>
          </div>
        </div>

        <div className="mdl-f">
          <button className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Отмена</button>
          <button
            className="btn btn-dark"
            onClick={onSubmit}
            disabled={isSubmitting || !assignStudentId}
          >
            {isSubmitting ? "…" : "Назначить урок"}
          </button>
        </div>
      </div>
    </div>
  )
}

function AvailabilityEditor() {
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

  const emptyAvailability: DayAvailability[] = DAY_NAMES.map(() => ({
    active: false,
    ranges: [],
  }))
  const previewAvailability: DayAvailability[] = DAY_NAMES.map((_, i) => ({
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
        toast.error(`Не удалось загрузить профиль: ${tpError.message}`)
        setIsLoading(false)
        return
      }

      if (!tp) {
        toast.error("Профиль преподавателя не найден.")
        setIsLoading(false)
        return
      }

      const { data: rows, error: rowsError } = await (supabase as any)
        .from("teacher_availability")
        .select("day_of_week, start_time, end_time, is_active")
        .eq("teacher_id", tp.id)
        .order("start_time", { ascending: true })

      if (rowsError) {
        toast.error(`Ошибка загрузки доступности: ${rowsError.message}`)
      }

      if (rows && rows.length > 0) {
        const grouped: DayAvailability[] = DAY_NAMES.map(() => ({ active: false, ranges: [] }))
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
        toast.error("Нужно войти заново")
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

      toast.success("Расписание доступности сохранено")
    } catch (e: any) {
      toast.error("Ошибка при сохранении: " + (e?.message ?? ""))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBlockDate() {
    if (!blockDate) return

    try {
      toast.success(
        `Дата ${format(new Date(blockDate), "d MMMM yyyy", { locale: ru })} заблокирована`
      )
      setShowBlockDialog(false)
      setBlockDate("")
    } catch {
      toast.error("Ошибка при блокировке даты")
    }
  }

  return (
    <>
      <div className="av-card">
        <div className="av-head">
          <div className="av-head-title">Доступность для бронирования</div>
          <div className="av-head-actions">
            <button className="btn btn-outline" onClick={() => setShowBlockDialog(true)}>
              🚫 Заблокировать дату
            </button>
            <button
              className="btn btn-lime"
              onClick={async () => {
                await handleSave()
                setHasSavedSchedule(true)
              }}
              disabled={isSaving}
            >
              {isSaving ? "…" : "💾 Сохранить"}
            </button>
          </div>
        </div>
        <div className="av-body">
          {!isLoading && !hasSavedSchedule && (
            <div
              role="alert"
              style={{
                background: "rgba(230,57,70,.08)",
                border: "1px solid rgba(230,57,70,.25)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 14,
                fontSize: 13,
                color: "var(--text)",
                lineHeight: 1.45,
              }}
            >
              <b style={{ color: "var(--red)" }}>Расписание ещё не сохранено.</b>{" "}
              Включи нужные дни и нажми <b>«💾 Сохранить»</b> справа сверху.
              Пока расписание не сохранено, ученики <b>не видят</b> у тебя
              свободных слотов и не могут записаться.
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
                  aria-label={`${DAY_FULL_NAMES[dayIdx]}: ${day.active ? "активен" : "выключен"}`}
                  onClick={() => toggleDay(dayIdx)}
                  className={`av-sw${day.active ? " av-sw--on" : ""}`}
                >
                  <span className="av-sw-dot" />
                </button>

                <span className="av-day-lbl">{DAY_FULL_NAMES[dayIdx]}</span>

                {day.active && (
                  <div className="av-ranges">
                    {day.ranges.map((range, rangeIdx) => (
                      <div key={rangeIdx} className="av-range">
                        <input
                          type="time"
                          value={range.start}
                          onChange={(e) => updateRange(dayIdx, rangeIdx, "start", e.target.value)}
                          aria-label="Начало"
                        />
                        <span className="av-range-sep">—</span>
                        <input
                          type="time"
                          value={range.end}
                          onChange={(e) => updateRange(dayIdx, rangeIdx, "end", e.target.value)}
                          aria-label="Конец"
                        />
                        {day.ranges.length > 1 && (
                          <button
                            type="button"
                            className="av-icon-btn"
                            onClick={() => removeRange(dayIdx, rangeIdx)}
                            aria-label="Удалить интервал"
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
                      aria-label="Добавить интервал"
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
              <div className="mdl-title">Заблокировать дату</div>
              <button className="mdl-close" onClick={() => setShowBlockDialog(false)} aria-label="Закрыть">✕</button>
            </div>
            <div className="mdl-b">
              <p style={{ fontSize: ".8rem", color: "var(--muted)", margin: 0 }}>
                Выберите дату, в которую вы не сможете проводить уроки. Все слоты в этот день будут недоступны для бронирования.
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
              <button className="btn btn-outline" onClick={() => setShowBlockDialog(false)}>Отмена</button>
              <button
                className="btn btn-dark"
                onClick={handleBlockDate}
                disabled={!blockDate}
              >
                Заблокировать
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
