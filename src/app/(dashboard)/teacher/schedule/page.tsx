// @ts-nocheck
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
  startOfWeek,
} from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useLessonsRealtime } from "@/hooks/use-lessons-realtime"
import { useUser } from "@/hooks/use-user"
import { LESSON_JOIN_WINDOW } from "@/lib/constants"

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

const TCH_SCHEDULE_CSS = `
.tch-schedule{max-width:1100px;margin:0 auto}
.tch-schedule .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px}
.tch-schedule .hdr h1{font-size:1.6rem;font-weight:800;letter-spacing:-.6px}
.tch-schedule .hdr h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.tch-schedule .hdr-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tch-schedule .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:10px;font-size:.8rem;font-weight:600;transition:all .15s;border:none;cursor:pointer;font-family:inherit}
.tch-schedule .btn:active{transform:scale(.97)}
.tch-schedule .btn-dark{background:#0A0A0A;color:#fff}
.tch-schedule .btn-dark:hover{background:var(--red)}
.tch-schedule .btn-outline{background:var(--surface);color:var(--text);border:1px solid var(--border)}
.tch-schedule .btn-outline:hover{border-color:var(--text)}
.tch-schedule .btn-lime{background:var(--lime);color:#0A0A0A;box-shadow:0 2px 0 var(--lime-dark,#a8c941)}
.tch-schedule .btn-lime:hover{filter:brightness(.95)}

.tch-schedule .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.tch-schedule .st{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.tch-schedule .st-label{font-size:.58rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.tch-schedule .st-val{font-size:1.4rem;font-weight:800;margin-top:4px;letter-spacing:-.5px;line-height:1}
.tch-schedule .st-val .gl{font-family:'Gluten',cursive}
.tch-schedule .st-sub{font-size:.6rem;color:var(--muted);margin-top:4px}
.tch-schedule .st--red .st-val{color:var(--red)}
.tch-schedule .st--lime{background:var(--lime);border-color:var(--lime)}
.tch-schedule .st--lime .st-label{color:rgba(0,0,0,.5)}

.tch-schedule .cal-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:0 2px 0 var(--border),0 8px 30px var(--shadow);margin-bottom:32px;overflow:hidden}
.tch-schedule .cal-top{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap}
.tch-schedule .cal-top-nav{display:flex;align-items:center;gap:10px}
.tch-schedule .cal-top-title{font-size:.95rem;font-weight:700}
.tch-schedule .cal-nav-btn{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.8rem;transition:all .15s;cursor:pointer;font-family:inherit}
.tch-schedule .cal-nav-btn:hover{border-color:var(--text);color:var(--text)}
.tch-schedule .cal-today-btn{padding:5px 14px;border-radius:8px;background:var(--red);color:#fff;font-size:.68rem;font-weight:700;border:none;cursor:pointer;font-family:inherit}

.tch-schedule .cal-legend{display:flex;gap:14px;padding:10px 20px;flex-wrap:wrap;border-bottom:1px solid var(--border);background:var(--surface-2)}
.tch-schedule .leg{display:flex;align-items:center;gap:5px;font-size:.62rem;font-weight:600;color:var(--muted)}
.tch-schedule .leg-dot{width:8px;height:8px;border-radius:3px}
.tch-schedule .leg-dot--l{background:var(--lime)}
.tch-schedule .leg-dot--done{background:#22c55e}
.tch-schedule .leg-dot--cancel{background:#8A8A86}

.tch-schedule .cg-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.tch-schedule .cg{display:grid;grid-template-columns:54px repeat(7,1fr);min-width:700px}
.tch-schedule .cg-corner{border-right:1px solid var(--border);border-bottom:2px solid var(--border)}
.tch-schedule .cg-dh{padding:10px 4px;text-align:center;border-bottom:2px solid var(--border);border-right:1px solid var(--border);position:relative;background:var(--surface)}
.tch-schedule .cg-dh:last-child{border-right:none}
.tch-schedule .cg-dn{font-size:.55rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.tch-schedule .cg-dd{font-size:1.05rem;font-weight:800;margin-top:1px;letter-spacing:-.5px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:2px auto 0}
.tch-schedule .cg-dh--today .cg-dd{background:var(--red);color:#fff}
.tch-schedule .cg-dh--today::after{content:'';position:absolute;bottom:-2px;left:25%;right:25%;height:2px;background:var(--red);border-radius:2px}

.tch-schedule .cg-t{padding:4px 6px 4px 0;text-align:right;font-size:.6rem;font-weight:600;color:var(--muted);border-right:1px solid var(--border);height:72px;display:flex;align-items:flex-start;justify-content:flex-end}
.tch-schedule .cg-c{height:72px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);padding:2px;position:relative;background:var(--surface);cursor:pointer;transition:background .1s}
.tch-schedule .cg-c:hover{background:var(--surface-2)}
.tch-schedule .cg-c:last-child{border-right:none}
.tch-schedule .cg-c--past{background:var(--surface-2);cursor:default;opacity:.6}
.tch-schedule .cg-c--past:hover{background:var(--surface-2)}
.tch-schedule .cg-c--plus{display:flex;align-items:center;justify-content:center;color:transparent;font-size:1.1rem;font-weight:700}
.tch-schedule .cg-c--plus:hover{color:var(--red)}

.tch-schedule .ev{position:absolute;left:3px;right:3px;top:3px;padding:5px 7px;border-radius:8px;font-size:.6rem;font-weight:600;line-height:1.25;cursor:pointer;transition:all .15s;overflow:hidden;z-index:2;border-left:3px solid;background:rgba(216,242,106,.2);color:var(--lime-dark);border-color:var(--lime)}
.tch-schedule .ev:hover{transform:scale(1.04);box-shadow:0 4px 12px var(--shadow);z-index:5}
.tch-schedule .ev-t{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tch-schedule .ev-s{font-size:.52rem;opacity:.65;margin-top:1px}
.tch-schedule .ev--done{background:rgba(34,197,94,.08);color:#15803d;border-color:#22c55e;opacity:.7}
.tch-schedule .ev--cancel{background:rgba(138,138,134,.1);color:var(--muted);border-color:var(--muted);opacity:.5;text-decoration:line-through}
.tch-schedule .ev--now{background:var(--lime)!important;color:#0A0A0A!important;border-color:var(--lime-dark)!important;box-shadow:0 0 0 2px rgba(216,242,106,.3);animation:tchEvP 2s ease-in-out infinite}
@keyframes tchEvP{0%,100%{box-shadow:0 0 0 2px rgba(216,242,106,.3)}50%{box-shadow:0 0 0 5px rgba(216,242,106,.15)}}

.tch-schedule .list-title{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;padding:14px 0 10px;display:flex;align-items:center;gap:8px}
.tch-schedule .ltb{padding:3px 9px;border-radius:6px;font-size:.58rem;font-weight:700;text-transform:none;letter-spacing:0}
.tch-schedule .ltb--today{background:var(--red);color:#fff}
.tch-schedule .ltb--tm{background:rgba(216,242,106,.2);color:var(--lime-dark)}

.tch-schedule .lc{display:flex;align-items:stretch;background:var(--surface);border:1px solid var(--border);border-radius:16px;margin-bottom:10px;overflow:hidden;transition:all .2s}
.tch-schedule .lc:hover{border-color:rgba(230,57,70,.15);box-shadow:0 6px 20px var(--shadow)}
.tch-schedule .lc-strip{width:5px;flex-shrink:0;background:var(--lime)}
.tch-schedule .lc-strip--done{background:#22c55e}
.tch-schedule .lc-strip--cancel{background:var(--muted)}

.tch-schedule .lc-time{width:90px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 8px;border-right:1px solid var(--border);background:var(--surface-2)}
.tch-schedule .lc-time-val{font-size:1.1rem;font-weight:800;letter-spacing:-.5px;line-height:1}
.tch-schedule .lc-time-dur{font-size:.6rem;color:var(--muted);margin-top:3px}
.tch-schedule .lc-time-xp{font-size:.55rem;font-weight:700;color:var(--lime-dark);margin-top:4px;padding:2px 6px;background:rgba(216,242,106,.15);border-radius:4px}

.tch-schedule .lc-body{flex:1;padding:14px 16px;display:flex;flex-direction:column;justify-content:center;min-width:0}
.tch-schedule .lc-name{font-size:.92rem;font-weight:700;margin-bottom:2px}
.tch-schedule .lc-desc{font-size:.72rem;color:var(--muted);line-height:1.4}

.tch-schedule .lc-teacher{display:flex;align-items:center;gap:8px;padding:14px 12px;border-left:1px solid var(--border);flex-shrink:0}
.tch-schedule .lc-tch-ava{width:34px;height:34px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;flex-shrink:0;overflow:hidden}
.tch-schedule .lc-tch-ava img{width:100%;height:100%;object-fit:cover}
.tch-schedule .lc-tch-name{font-size:.72rem;font-weight:600;white-space:nowrap}
.tch-schedule .lc-tch-role{font-size:.58rem;color:var(--muted)}

.tch-schedule .lc-action{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 16px;flex-shrink:0;gap:4px}
.tch-schedule .lc-btn{padding:8px 18px;border-radius:10px;font-size:.75rem;font-weight:700;border:none;transition:all .15s;white-space:nowrap;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block;text-align:center}
.tch-schedule .lc-btn--join{background:var(--red);color:#fff;box-shadow:0 2px 0 rgba(180,30,45,.3)}
.tch-schedule .lc-btn--join:hover{filter:brightness(.9)}
.tch-schedule .lc-btn--done{background:rgba(34,197,94,.08);color:#22c55e}
.tch-schedule .lc-btn--wait{background:var(--bg);color:var(--muted)}
.tch-schedule .lc-btn--cancelled{background:rgba(138,138,134,.08);color:var(--muted)}

.tch-schedule .lc--now{border-color:var(--lime);box-shadow:0 0 0 2px rgba(216,242,106,.2),0 6px 20px var(--shadow)}
.tch-schedule .lc--now .lc-time{background:var(--lime)}
.tch-schedule .lc--now .lc-time-val{color:#0A0A0A}
.tch-schedule .lc--now .lc-time-dur{color:rgba(0,0,0,.5)}
.tch-schedule .lc--now .lc-time-xp{background:rgba(0,0,0,.08);color:#0A0A0A}
.tch-schedule .lc--done{opacity:.55}
.tch-schedule .lc--cancel{opacity:.55}
.tch-schedule .lc--cancel .lc-name{text-decoration:line-through}

.tch-schedule .empty{padding:50px 20px;text-align:center;color:var(--muted);font-size:.85rem}
.tch-schedule .loading{padding:50px 20px;display:flex;justify-content:center}
.tch-schedule .spinner{width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--red);border-radius:50%;animation:tchSpin 1s linear infinite}
@keyframes tchSpin{to{transform:rotate(360deg)}}

.tch-schedule .av-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:0 2px 0 var(--border),0 8px 30px var(--shadow);margin-top:32px;overflow:hidden}
.tch-schedule .av-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap}
.tch-schedule .av-head-title{font-size:.95rem;font-weight:700;display:flex;align-items:center;gap:8px}
.tch-schedule .av-head-title::before{content:'';width:10px;height:10px;background:var(--lime);border-radius:3px}
.tch-schedule .av-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tch-schedule .av-body{padding:16px 20px}
.tch-schedule .av-row{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;background:var(--surface);transition:background .15s}
.tch-schedule .av-row--off{background:var(--surface-2);opacity:.7}
.tch-schedule .av-sw{position:relative;display:inline-flex;width:36px;height:20px;border-radius:999px;background:var(--border);flex-shrink:0;cursor:pointer;transition:background .15s;border:none;padding:0}
.tch-schedule .av-sw--on{background:var(--lime)}
.tch-schedule .av-sw-dot{position:absolute;top:3px;left:3px;width:14px;height:14px;background:#fff;border-radius:50%;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.tch-schedule .av-sw--on .av-sw-dot{transform:translateX(16px)}
.tch-schedule .av-day-lbl{width:108px;font-size:.8rem;font-weight:600;flex-shrink:0}
.tch-schedule .av-row--off .av-day-lbl{color:var(--muted)}
.tch-schedule .av-ranges{display:flex;flex-wrap:wrap;gap:8px;flex:1;align-items:center}
.tch-schedule .av-range{display:inline-flex;align-items:center;gap:6px}
.tch-schedule .av-range input[type="time"]{height:28px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-family:inherit;font-size:.72rem;color:var(--text)}
.tch-schedule .av-range input[type="time"]:focus{outline:none;border-color:var(--lime)}
.tch-schedule .av-range-sep{font-size:.7rem;color:var(--muted)}
.tch-schedule .av-icon-btn{width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:var(--surface);cursor:pointer;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;font-size:.72rem;font-family:inherit;transition:all .15s;padding:0}
.tch-schedule .av-icon-btn:hover{border-color:var(--red);color:var(--red)}
.tch-schedule .av-icon-btn--add:hover{border-color:var(--lime);color:var(--lime-dark)}

.tch-schedule .mdl-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:60;display:flex;align-items:center;justify-content:center;padding:20px}
.tch-schedule .mdl{background:var(--surface);border:1px solid var(--border);border-radius:20px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:90vh;overflow-y:auto}
.tch-schedule .mdl-h{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.tch-schedule .mdl-title{font-size:1.05rem;font-weight:800;display:flex;align-items:center;gap:8px}
.tch-schedule .mdl-close{width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--surface);cursor:pointer;color:var(--muted);font-size:.9rem;font-family:inherit}
.tch-schedule .mdl-close:hover{border-color:var(--text);color:var(--text)}
.tch-schedule .mdl-sub{font-size:.72rem;color:var(--muted);margin-top:2px}
.tch-schedule .mdl-b{padding:18px 22px;display:flex;flex-direction:column;gap:14px}
.tch-schedule .mdl-lbl{display:block;font-size:.62rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.tch-schedule .mdl-input{width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface);font-family:inherit;font-size:.85rem;color:var(--text)}
.tch-schedule .mdl-input:focus{outline:none;border-color:var(--red)}
.tch-schedule .mdl-results{border:1px solid var(--border);border-radius:10px;max-height:180px;overflow-y:auto;background:var(--surface)}
.tch-schedule .mdl-result{padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:.78rem;transition:background .1s}
.tch-schedule .mdl-result:last-child{border-bottom:none}
.tch-schedule .mdl-result:hover{background:var(--surface-2)}
.tch-schedule .mdl-result--on{background:rgba(216,242,106,.2)}
.tch-schedule .mdl-result-sm{font-size:.62rem;color:var(--muted)}
.tch-schedule .mdl-empty{padding:12px;text-align:center;font-size:.72rem;color:var(--muted)}
.tch-schedule .mdl-dur{display:flex;gap:8px}
.tch-schedule .mdl-dur-btn{flex:1;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-family:inherit;font-size:.78rem;font-weight:600;cursor:pointer;color:var(--text)}
.tch-schedule .mdl-dur-btn--on{background:var(--red);border-color:var(--red);color:#fff}
.tch-schedule .mdl-price{border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--surface-2);display:flex;align-items:center;justify-content:space-between}
.tch-schedule .mdl-price-lbl{font-size:.72rem;color:var(--muted)}
.tch-schedule .mdl-price-val{font-size:1.05rem;font-weight:800;color:var(--red)}
.tch-schedule .mdl-price-sub{font-size:.6rem;color:var(--muted);margin-top:3px;width:100%}
.tch-schedule .mdl-f{padding:14px 22px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}

@media(max-width:900px){.tch-schedule .stats{grid-template-columns:1fr 1fr}}
@media(max-width:600px){
  .tch-schedule .hdr{flex-direction:column;align-items:flex-start}
  .tch-schedule .hdr-right{width:100%;justify-content:space-between}
  .tch-schedule .stats{grid-template-columns:1fr 1fr}
  .tch-schedule .lc{flex-wrap:wrap}
  .tch-schedule .lc-teacher{border-left:none;border-top:1px solid var(--border);width:calc(100% - 5px);padding:10px 16px}
  .tch-schedule .lc-action{width:calc(100% - 5px);border-top:1px solid var(--border);flex-direction:row;justify-content:center}
  .tch-schedule .lc-btn{flex:1;text-align:center}
  .tch-schedule .av-row{flex-wrap:wrap}
  .tch-schedule .av-day-lbl{width:auto}
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

function nextRoundHour(d: Date): { date: Date; hour: number } {
  const h = d.getHours() + 1
  const date = new Date(d)
  date.setHours(h, 0, 0, 0)
  return { date, hour: h }
}

export default function TeacherSchedulePage() {
  const { user, isLoading: userLoading } = useUser()
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [studentMap, setStudentMap] = useState<Record<string, StudentMapEntry>>({})
  const [teacherProfileId, setTeacherProfileId] = useState<string | null>(null)
  const [hourlyRate, setHourlyRate] = useState<number>(0)
  const [weekCursor, setWeekCursor] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(new Date())

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
    if (userLoading) return
    if (!user) {
      setLoadError("Не удалось определить пользователя. Перезайдите в систему.")
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setLoadError(null)
    const supabase = createClient()

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
  }, [user, userLoading])

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
  const weekCount = lessons.filter((l) => l.status !== "cancelled").length
  const completedCount = useMemo(
    () => lessons.filter((l) => l.status === "completed").length,
    [lessons]
  )
  const nextLesson = useMemo(() => {
    return lessons.find(
      (l) =>
        new Date(l.scheduled_at) >= now &&
        l.status !== "cancelled" &&
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
      if (l.status === "cancelled") continue
      const d = new Date(l.scheduled_at)
      hours.add(d.getHours())
    }
    const sorted = Array.from(hours).sort((a, b) => a - b)
    if (sorted.length === 0) return [9, 11, 13, 15, 17, 19]
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

  return (
    <div className="tch-schedule">
      <style dangerouslySetInnerHTML={{ __html: TCH_SCHEDULE_CSS }} />

      <div className="hdr">
        <h1>Моё <span className="gl">расписание</span></h1>
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
                const joinable = canJoin(lesson.scheduled_at, lesson.status)
                const student = lesson.student_id ? studentMap[lesson.student_id] : null
                const rowCls = `lc${happening ? " lc--now" : ""}${isDone ? " lc--done" : ""}${isCancel ? " lc--cancel" : ""}`
                const stripCls = `lc-strip${isDone ? " lc-strip--done" : ""}${isCancel ? " lc-strip--cancel" : ""}`
                const priceRub = lesson.price ? Math.round(lesson.price / 100) : null
                return (
                  <div key={lesson.id} className={rowCls}>
                    <div className={stripCls} />
                    <div className="lc-time">
                      <div className="lc-time-val">{format(dt, "HH:mm")}</div>
                      <div className="lc-time-dur">{lesson.duration_minutes} мин</div>
                      {!isCancel && priceRub ? <div className="lc-time-xp">{priceRub.toLocaleString("ru-RU")} ₽</div> : null}
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
                      ) : joinable ? (
                        <Link href={`/teacher/lesson/${lesson.id}`} className="lc-btn lc-btn--join">▶ Начать</Link>
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
}: {
  hour: number
  weekDays: Date[]
  lessons: LessonRow[]
  now: Date
  onCellClick: (day: Date, hour: number) => void
  isHappeningNow: (l: LessonRow) => boolean
  studentMap: Record<string, StudentMapEntry>
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
}: {
  lesson: LessonRow
  isHappeningNow: (l: LessonRow) => boolean
  studentName: string | null
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
        {happening ? "⚡ Сейчас" : shortName ? `Урок · ${shortName}` : "Урок 1-on-1"}
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
  const { user, isLoading: userLoading, error: userError } = useUser()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [blockDate, setBlockDate] = useState("")

  const defaultAvailability: DayAvailability[] = DAY_NAMES.map((_, i) => ({
    active: i < 5,
    ranges: i < 5 ? [{ start: "09:00", end: "18:00" }] : [],
  }))

  const [availability, setAvailability] =
    useState<DayAvailability[]>(defaultAvailability)

  useEffect(() => {
    async function load() {
      if (userLoading) return
      if (!user) {
        if (userError) console.error("useUser error:", userError)
        setIsLoading(false)
        return
      }
      const supabase = createClient()

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
      }
      setIsLoading(false)
    }

    load()
  }, [user, userLoading, userError])

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
    if (!user) return
    setIsSaving(true)

    try {
      const supabase = createClient()

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
            <button className="btn btn-lime" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "…" : "💾 Сохранить"}
            </button>
          </div>
        </div>
        <div className="av-body">
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
