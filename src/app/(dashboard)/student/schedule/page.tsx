"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  addDays,
  addWeeks,
  differenceInMinutes,
  endOfDay,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  startOfDay,
  startOfWeek,
} from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { LessonBookingModal } from "@/components/booking/lesson-booking-modal"
import { useLessonsRealtime } from "@/hooks/use-lessons-realtime"
import { LESSON_JOIN_WINDOW } from "@/lib/constants"

type LessonRow = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  jitsi_room_name: string | null
  teacher_id: string | null
}

type TeacherMapEntry = { full_name: string | null; initials: string }

const SCHEDULE_CSS = `
.stu-schedule{max-width:1100px;margin:0 auto}
.stu-schedule .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px}
.stu-schedule .hdr h1{font-size:1.6rem;font-weight:800;letter-spacing:-.6px}
.stu-schedule .hdr h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.stu-schedule .hdr-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.stu-schedule .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:10px;font-size:.8rem;font-weight:600;transition:all .15s;border:none;cursor:pointer;font-family:inherit}
.stu-schedule .btn:active{transform:scale(.97)}
.stu-schedule .btn-dark{background:#0A0A0A;color:#fff}
.stu-schedule .btn-dark:hover{background:var(--red)}

.stu-schedule .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.stu-schedule .st{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.stu-schedule .st-label{font-size:.58rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.stu-schedule .st-val{font-size:1.4rem;font-weight:800;margin-top:4px;letter-spacing:-.5px;line-height:1}
.stu-schedule .st-val .gl{font-family:'Gluten',cursive}
.stu-schedule .st-sub{font-size:.6rem;color:var(--muted);margin-top:4px}
.stu-schedule .st--red .st-val{color:var(--red)}
.stu-schedule .st--lime{background:var(--lime);border-color:var(--lime)}
.stu-schedule .st--lime .st-label{color:rgba(0,0,0,.5)}

.stu-schedule .cal-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:0 2px 0 var(--border),0 8px 30px var(--shadow);margin-bottom:32px;overflow:hidden}
.stu-schedule .cal-top{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap}
.stu-schedule .cal-top-nav{display:flex;align-items:center;gap:10px}
.stu-schedule .cal-top-title{font-size:.95rem;font-weight:700}
.stu-schedule .cal-nav-btn{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.8rem;transition:all .15s;cursor:pointer;font-family:inherit}
.stu-schedule .cal-nav-btn:hover{border-color:var(--text);color:var(--text)}
.stu-schedule .cal-today-btn{padding:5px 14px;border-radius:8px;background:var(--red);color:#fff;font-size:.68rem;font-weight:700;border:none;cursor:pointer;font-family:inherit}

.stu-schedule .cal-legend{display:flex;gap:14px;padding:10px 20px;flex-wrap:wrap;border-bottom:1px solid var(--border);background:var(--surface-2)}
.stu-schedule .leg{display:flex;align-items:center;gap:5px;font-size:.62rem;font-weight:600;color:var(--muted)}
.stu-schedule .leg-dot{width:8px;height:8px;border-radius:3px}
.stu-schedule .leg-dot--l{background:var(--lime)}
.stu-schedule .leg-dot--done{background:#22c55e}
.stu-schedule .leg-dot--cancel{background:#8A8A86}

.stu-schedule .cg-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.stu-schedule .cg{display:grid;grid-template-columns:54px repeat(7,1fr);min-width:700px}
.stu-schedule .cg-corner{border-right:1px solid var(--border);border-bottom:2px solid var(--border)}
.stu-schedule .cg-dh{padding:10px 4px;text-align:center;border-bottom:2px solid var(--border);border-right:1px solid var(--border);position:relative;background:var(--surface)}
.stu-schedule .cg-dh:last-child{border-right:none}
.stu-schedule .cg-dn{font-size:.55rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.stu-schedule .cg-dd{font-size:1.05rem;font-weight:800;margin-top:1px;letter-spacing:-.5px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:2px auto 0}
.stu-schedule .cg-dh--today .cg-dd{background:var(--red);color:#fff}
.stu-schedule .cg-dh--today::after{content:'';position:absolute;bottom:-2px;left:25%;right:25%;height:2px;background:var(--red);border-radius:2px}

.stu-schedule .cg-t{padding:4px 6px 4px 0;text-align:right;font-size:.6rem;font-weight:600;color:var(--muted);border-right:1px solid var(--border);height:72px;display:flex;align-items:flex-start;justify-content:flex-end}
.stu-schedule .cg-c{height:72px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);padding:2px;position:relative;background:var(--surface);cursor:pointer;transition:background .1s}
.stu-schedule .cg-c:hover{background:var(--surface-2)}
.stu-schedule .cg-c:last-child{border-right:none}

.stu-schedule .ev{position:absolute;left:3px;right:3px;top:3px;padding:5px 7px;border-radius:8px;font-size:.6rem;font-weight:600;line-height:1.25;cursor:pointer;transition:all .15s;overflow:hidden;z-index:2;border-left:3px solid;background:rgba(216,242,106,.2);color:var(--lime-dark);border-color:var(--lime)}
.stu-schedule .ev:hover{transform:scale(1.04);box-shadow:0 4px 12px var(--shadow);z-index:5}
.stu-schedule .ev-t{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stu-schedule .ev-s{font-size:.52rem;opacity:.65;margin-top:1px}
.stu-schedule .ev--done{background:rgba(34,197,94,.08);color:#15803d;border-color:#22c55e;opacity:.7}
.stu-schedule .ev--cancel{background:rgba(138,138,134,.1);color:var(--muted);border-color:var(--muted);opacity:.5;text-decoration:line-through}
.stu-schedule .ev--now{background:var(--lime)!important;color:#0A0A0A!important;border-color:var(--lime-dark)!important;box-shadow:0 0 0 2px rgba(216,242,106,.3);animation:stuEvP 2s ease-in-out infinite}
@keyframes stuEvP{0%,100%{box-shadow:0 0 0 2px rgba(216,242,106,.3)}50%{box-shadow:0 0 0 5px rgba(216,242,106,.15)}}

.stu-schedule .list-title{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;padding:14px 0 10px;display:flex;align-items:center;gap:8px}
.stu-schedule .ltb{padding:3px 9px;border-radius:6px;font-size:.58rem;font-weight:700;text-transform:none;letter-spacing:0}
.stu-schedule .ltb--today{background:var(--red);color:#fff}
.stu-schedule .ltb--tm{background:rgba(216,242,106,.2);color:var(--lime-dark)}

.stu-schedule .lc{display:flex;align-items:stretch;background:var(--surface);border:1px solid var(--border);border-radius:16px;margin-bottom:10px;overflow:hidden;transition:all .2s}
.stu-schedule .lc:hover{border-color:rgba(230,57,70,.15);box-shadow:0 6px 20px var(--shadow)}
.stu-schedule .lc-strip{width:5px;flex-shrink:0;background:var(--lime)}
.stu-schedule .lc-strip--done{background:#22c55e}
.stu-schedule .lc-strip--cancel{background:var(--muted)}

.stu-schedule .lc-time{width:90px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 8px;border-right:1px solid var(--border);background:var(--surface-2)}
.stu-schedule .lc-time-val{font-size:1.1rem;font-weight:800;letter-spacing:-.5px;line-height:1}
.stu-schedule .lc-time-dur{font-size:.6rem;color:var(--muted);margin-top:3px}
.stu-schedule .lc-time-xp{font-size:.55rem;font-weight:700;color:var(--lime-dark);margin-top:4px;padding:2px 6px;background:rgba(216,242,106,.15);border-radius:4px}

.stu-schedule .lc-body{flex:1;padding:14px 16px;display:flex;flex-direction:column;justify-content:center;min-width:0}
.stu-schedule .lc-name{font-size:.92rem;font-weight:700;margin-bottom:2px}
.stu-schedule .lc-desc{font-size:.72rem;color:var(--muted);line-height:1.4}

.stu-schedule .lc-teacher{display:flex;align-items:center;gap:8px;padding:14px 12px;border-left:1px solid var(--border);flex-shrink:0}
.stu-schedule .lc-tch-ava{width:34px;height:34px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;flex-shrink:0;overflow:hidden}
.stu-schedule .lc-tch-name{font-size:.72rem;font-weight:600;white-space:nowrap}
.stu-schedule .lc-tch-role{font-size:.58rem;color:var(--muted)}

.stu-schedule .lc-action{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 16px;flex-shrink:0;gap:4px}
.stu-schedule .lc-btn{padding:8px 18px;border-radius:10px;font-size:.75rem;font-weight:700;border:none;transition:all .15s;white-space:nowrap;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block;text-align:center}
.stu-schedule .lc-btn--join{background:var(--red);color:#fff;box-shadow:0 2px 0 rgba(180,30,45,.3)}
.stu-schedule .lc-btn--join:hover{filter:brightness(.9)}
.stu-schedule .lc-btn--done{background:rgba(34,197,94,.08);color:#22c55e}
.stu-schedule .lc-btn--wait{background:var(--bg);color:var(--muted)}
.stu-schedule .lc-btn--cancelled{background:rgba(138,138,134,.08);color:var(--muted)}

.stu-schedule .lc--now{border-color:var(--lime);box-shadow:0 0 0 2px rgba(216,242,106,.2),0 6px 20px var(--shadow)}
.stu-schedule .lc--now .lc-time{background:var(--lime)}
.stu-schedule .lc--now .lc-time-val{color:#0A0A0A}
.stu-schedule .lc--now .lc-time-dur{color:rgba(0,0,0,.5)}
.stu-schedule .lc--now .lc-time-xp{background:rgba(0,0,0,.08);color:#0A0A0A}
.stu-schedule .lc--done{opacity:.55}
.stu-schedule .lc--cancel{opacity:.55}
.stu-schedule .lc--cancel .lc-name{text-decoration:line-through}

.stu-schedule .empty{padding:50px 20px;text-align:center;color:var(--muted);font-size:.85rem}
.stu-schedule .loading{padding:50px 20px;display:flex;justify-content:center}
.stu-schedule .spinner{width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--red);border-radius:50%;animation:stuSpin 1s linear infinite}
@keyframes stuSpin{to{transform:rotate(360deg)}}

@media(max-width:900px){.stu-schedule .stats{grid-template-columns:1fr 1fr}}
@media(max-width:600px){
  .stu-schedule .hdr{flex-direction:column;align-items:flex-start}
  .stu-schedule .hdr-right{width:100%;justify-content:space-between}
  .stu-schedule .stats{grid-template-columns:1fr 1fr}
  .stu-schedule .lc{flex-wrap:wrap}
  .stu-schedule .lc-teacher{border-left:none;border-top:1px solid var(--border);width:calc(100% - 5px);padding:10px 16px}
  .stu-schedule .lc-action{width:calc(100% - 5px);border-top:1px solid var(--border);flex-direction:row;justify-content:center}
  .stu-schedule .lc-btn{flex:1;text-align:center}
}
`

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
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [teacherMap, setTeacherMap] = useState<Record<string, TeacherMapEntry>>({})
  const [weekCursor, setWeekCursor] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [isLoading, setIsLoading] = useState(true)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(new Date())

  // Live clock tick so "сейчас" / "ожидается" labels update without refresh.
  useEffect(() => {
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
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setIsLoading(false)
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

    const teacherIds = Array.from(new Set(list.map((l) => l.teacher_id).filter(Boolean))) as string[]
    if (teacherIds.length > 0) {
      const { data: teachersRaw } = await (supabase as any)
        .from("teacher_profiles")
        .select("id, profile_id")
        .in("id", teacherIds)
      const teachers = (teachersRaw ?? []) as Array<{ id: string; profile_id: string }>
      const profileIds = teachers.map((t) => t.profile_id)
      if (profileIds.length > 0) {
        const { data: profilesRaw } = await (supabase as any)
          .from("profiles")
          .select("id, full_name")
          .in("id", profileIds)
        const pMap = Object.fromEntries(
          ((profilesRaw ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p])
        )
        const nextMap: Record<string, TeacherMapEntry> = {}
        for (const t of teachers) {
          const p = pMap[t.profile_id]
          const fullName = p?.full_name ?? null
          nextMap[t.id] = { full_name: fullName, initials: getInitials(fullName) }
        }
        setTeacherMap(nextMap)
      } else {
        setTeacherMap({})
      }
    } else {
      setTeacherMap({})
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchLessons(weekStart, weekEnd)
  }, [weekStart, weekEnd, fetchLessons])

  useLessonsRealtime({
    studentId: currentUserId,
    onChange: () => fetchLessons(weekStart, weekEnd),
  })

  // Month XP (lesson XP, approximate) — used for "XP за неделю" stat.
  const weekXp = useMemo(() => {
    return lessons.reduce((sum, l) => (l.status === "completed" ? sum + 50 : sum), 0)
  }, [lessons])

  const weekCount = lessons.filter((l) => l.status !== "cancelled").length

  const nextLesson = useMemo(() => {
    return lessons.find((l) => new Date(l.scheduled_at) >= now && l.status !== "cancelled" && l.status !== "completed")
  }, [lessons, now])

  const completedCount = useMemo(
    () => lessons.filter((l) => l.status === "completed").length,
    [lessons]
  )

  // Build dynamic time rows from actual lessons (floor to hour), fallback to 10,12,14,16,18.
  const timeRows = useMemo(() => {
    const hours = new Set<number>()
    for (const l of lessons) {
      if (l.status === "cancelled") continue
      const d = new Date(l.scheduled_at)
      hours.add(d.getHours())
    }
    const sorted = Array.from(hours).sort((a, b) => a - b)
    if (sorted.length === 0) return [10, 12, 14, 16, 18]
    return sorted
  }, [lessons])

  function canJoin(scheduledAt: string, status: string): boolean {
    if (status !== "booked" && status !== "in_progress") return false
    const lessonDate = new Date(scheduledAt)
    const minutesUntil = differenceInMinutes(lessonDate, now)
    const minutesSince = -minutesUntil
    return (
      status === "in_progress" ||
      (minutesUntil <= LESSON_JOIN_WINDOW && minutesSince <= 60)
    )
  }

  function isHappeningNow(l: LessonRow): boolean {
    const start = new Date(l.scheduled_at)
    const end = new Date(start.getTime() + l.duration_minutes * 60_000)
    return now >= start && now <= end && (l.status === "booked" || l.status === "in_progress")
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

  return (
    <div className="stu-schedule">
      <style dangerouslySetInnerHTML={{ __html: SCHEDULE_CSS }} />

      <div className="hdr">
        <h1>Моё <span className="gl">schedule</span></h1>
        <div className="hdr-right">
          <button className="btn btn-dark" onClick={() => setBookingOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Записаться
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="st st--red">
          <div className="st-label">Эта неделя</div>
          <div className="st-val">{weekCount}</div>
          <div className="st-sub">{weekCount === 0 ? "нет занятий" : weekCount === 1 ? "занятие запланировано" : weekCount < 5 ? "занятия запланировано" : "занятий запланировано"}</div>
        </div>
        <div className="st">
          <div className="st-label">Завершено</div>
          <div className="st-val">{completedCount}</div>
          <div className="st-sub">уроков за неделю</div>
        </div>
        <div className={`st ${nextLesson ? "st--lime" : ""}`}>
          <div className="st-label">Следующее</div>
          <div className="st-val">
            {nextLesson ? <span className="gl">{format(new Date(nextLesson.scheduled_at), "HH:mm")}</span> : "—"}
          </div>
          <div className="st-sub">
            {nextLesson
              ? `Урок · ${isToday(new Date(nextLesson.scheduled_at)) ? "сегодня" : isTomorrow(new Date(nextLesson.scheduled_at)) ? "завтра" : format(new Date(nextLesson.scheduled_at), "d MMM", { locale: ru })}`
              : "ничего не запланировано"}
          </div>
        </div>
        <div className="st">
          <div className="st-label">XP за неделю</div>
          <div className="st-val">+{weekXp}</div>
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
                onCellClick={() => setBookingOpen(true)}
                isHappeningNow={isHappeningNow}
                teacherMap={teacherMap}
              />
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : lessons.length === 0 ? (
        <div className="empty">На этой неделе занятий нет. Забронируй слот через кнопку выше ↑</div>
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
                const joinable = canJoin(lesson.scheduled_at, lesson.status)
                const teacher = lesson.teacher_id ? teacherMap[lesson.teacher_id] : null
                const rowCls = `lc${happening ? " lc--now" : ""}${isDone ? " lc--done" : ""}${isCancel ? " lc--cancel" : ""}`
                const stripCls = `lc-strip${isDone ? " lc-strip--done" : ""}${isCancel ? " lc-strip--cancel" : ""}`
                return (
                  <div key={lesson.id} className={rowCls}>
                    <div className={stripCls} />
                    <div className="lc-time">
                      <div className="lc-time-val">{format(dt, "HH:mm")}</div>
                      <div className="lc-time-dur">{lesson.duration_minutes} мин</div>
                      {!isCancel ? <div className="lc-time-xp">+{lesson.duration_minutes === 25 ? 25 : 50} XP</div> : null}
                    </div>
                    <div className="lc-body">
                      <div className="lc-name">Урок 1-on-1</div>
                      <div className="lc-desc">
                        {format(dt, "HH:mm")}–{format(end, "HH:mm")}
                        {isDone ? " · ✓ завершён" : ""}
                        {isCancel ? " · отменён" : ""}
                      </div>
                    </div>
                    <div className="lc-teacher">
                      <div className="lc-tch-ava">{teacher?.initials ?? "??"}</div>
                      <div>
                        <div className="lc-tch-name">{teacher?.full_name ?? "Преподаватель"}</div>
                        <div className="lc-tch-role">1-on-1</div>
                      </div>
                    </div>
                    <div className="lc-action">
                      {isDone ? (
                        <span className="lc-btn lc-btn--done">✓ Завершён</span>
                      ) : isCancel ? (
                        <span className="lc-btn lc-btn--cancelled">Отменён</span>
                      ) : joinable ? (
                        <Link href={`/student/lesson/${lesson.id}`} className="lc-btn lc-btn--join">▶ Начать</Link>
                      ) : (
                        <span className="lc-btn lc-btn--wait">Ожидается</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      )}

      <LessonBookingModal open={bookingOpen} onOpenChange={setBookingOpen} />
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
}: {
  hour: number
  weekDays: Date[]
  lessons: LessonRow[]
  now: Date
  onCellClick: () => void
  isHappeningNow: (l: LessonRow) => boolean
  teacherMap: Record<string, TeacherMapEntry>
}) {
  const label = `${String(hour).padStart(2, "0")}:00`
  return (
    <>
      <div className="cg-t">{label}</div>
      {weekDays.map((day) => {
        const lessonsInCell = lessons.filter((l) => {
          const d = new Date(l.scheduled_at)
          return isSameDay(d, day) && d.getHours() === hour && l.status !== "cancelled"
        })
        const first = lessonsInCell[0]
        return (
          <div key={`${day.toISOString()}-${hour}`} className="cg-c" onClick={first ? undefined : onCellClick}>
            {first ? (
              <EventChip lesson={first} now={now} isHappeningNow={isHappeningNow} teacherName={first.teacher_id ? teacherMap[first.teacher_id]?.full_name ?? null : null} />
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
}: {
  lesson: LessonRow
  now: Date
  isHappeningNow: (l: LessonRow) => boolean
  teacherName: string | null
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
        {happening ? "⚡ Сейчас" : shortName ? `Урок · ${shortName}` : "Урок 1-on-1"}
      </div>
      <div className="ev-s">
        {format(start, "HH:mm")}–{format(end, "HH:mm")}{isDone ? " ✓" : ""}
      </div>
    </div>
  )
}
