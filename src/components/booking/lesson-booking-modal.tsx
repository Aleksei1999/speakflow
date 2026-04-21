"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, isBefore, startOfDay } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useLessonsRealtime } from "@/hooks/use-lessons-realtime"

type Duration = 25 | 50

interface TeacherOption {
  teacherProfileId: string
  userId: string
  name: string
  avatarUrl: string | null
  hourlyRate: number
  rating: number | null
  specializations: string[]
  experienceYears: number
}

interface TimeSlot {
  startTime: string
  endTime: string
  available: boolean
}

interface SlotsResponse {
  slots: TimeSlot[] | Record<number, TimeSlot[]>
  teacherRate: number
  trialRate: number | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  onBooked?: () => void
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

function formatPrice(kopeks: number): string {
  return `${Math.ceil(kopeks / 100).toLocaleString("ru-RU")} ₽`
}

function formatTimeUTC(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`
}

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function buildMonthDays(view: Date): (Date | null)[] {
  const first = startOfMonth(view)
  const last = endOfMonth(view)
  const firstWeekday = (first.getDay() + 6) % 7 // Monday-first
  const total = last.getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= total; d++) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), d))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function LessonBookingModal({ open, onOpenChange, initialDate, onBooked }: Props) {
  const [step, setStep] = useState<"teacher" | "calendar">("teacher")
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [teachersFilter, setTeachersFilter] = useState<string>("all")
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherOption | null>(null)

  const [viewMonth, setViewMonth] = useState<Date>(initialDate ?? new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate ?? null)
  const [duration, setDuration] = useState<Duration>(50)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [teacherRate, setTeacherRate] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep("teacher")
        setSelectedTeacher(null)
        setSelectedDate(null)
        setSelectedSlot(null)
        setSlots([])
        setTeachersFilter("all")
      }, 200)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open || step !== "teacher") return
    let cancelled = false
    ;(async () => {
      setTeachersLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("teacher_profiles")
        .select("id, user_id, hourly_rate, rating, specializations, experience_years, profiles:profiles!teacher_profiles_user_id_fkey(full_name, avatar_url)")
        .eq("is_listed", true)

      if (cancelled) return
      if (error) {
        toast.error("Не удалось загрузить преподавателей")
        setTeachersLoading(false)
        return
      }
      const list: TeacherOption[] = ((data as unknown as Array<Record<string, unknown>>) ?? []).map((row) => ({
        teacherProfileId: row.id as string,
        userId: row.user_id as string,
        name: (row as { profiles?: { full_name?: string } }).profiles?.full_name ?? "Преподаватель",
        avatarUrl: (row as { profiles?: { avatar_url?: string | null } }).profiles?.avatar_url ?? null,
        hourlyRate: (row.hourly_rate as number) ?? 0,
        rating: (row.rating as number | null) ?? null,
        specializations: (row.specializations as string[]) ?? [],
        experienceYears: (row.experience_years as number) ?? 0,
      }))
      setTeachers(list)
      setTeachersLoading(false)
    })()
    return () => { cancelled = true }
  }, [open, step])

  const loadSlots = useCallback(async (teacherUserId: string, date: Date, dur: Duration) => {
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)
    try {
      const dateStr = format(date, "yyyy-MM-dd")
      const res = await fetch(`/api/booking/slots?teacherId=${teacherUserId}&date=${dateStr}&duration=${dur}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? "Ошибка загрузки слотов")
        setSlots([])
        return
      }
      const payload = data as SlotsResponse
      const list = Array.isArray(payload.slots) ? payload.slots : (payload.slots?.[dur] ?? [])
      setSlots(list)
      setTeacherRate(payload.teacherRate ?? 0)
    } catch {
      toast.error("Ошибка соединения с сервером")
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step !== "calendar" || !selectedTeacher || !selectedDate) return
    loadSlots(selectedTeacher.userId, selectedDate, duration)
  }, [step, selectedTeacher, selectedDate, duration, loadSlots])

  useLessonsRealtime({
    teacherId: selectedTeacher?.teacherProfileId ?? null,
    enabled: open && step === "calendar" && !!selectedTeacher && !!selectedDate,
    onChange: () => {
      if (selectedTeacher && selectedDate) loadSlots(selectedTeacher.userId, selectedDate, duration)
    },
  })

  const price = useMemo(() => {
    const hourly = teacherRate || selectedTeacher?.hourlyRate || 0
    return Math.round((hourly * duration) / 60)
  }, [teacherRate, duration, selectedTeacher])

  const filteredTeachers = useMemo(() => {
    if (teachersFilter === "all") return teachers
    const needle = teachersFilter.toLowerCase()
    return teachers.filter((t) => t.specializations.some((s) => s.toLowerCase().includes(needle)))
  }, [teachers, teachersFilter])

  const today = useMemo(() => startOfDay(new Date()), [])
  const monthDays = useMemo(() => buildMonthDays(viewMonth), [viewMonth])

  async function handleConfirm() {
    if (!selectedTeacher || !selectedSlot) return
    setBookingLoading(true)
    try {
      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: selectedTeacher.userId,
          scheduledAt: selectedSlot,
          durationMinutes: String(duration),
        }),
      })
      const data = await res.json()
      if (res.status === 409) {
        toast.error("Слот только что занят, выберите другой")
        if (selectedDate) loadSlots(selectedTeacher.userId, selectedDate, duration)
        setBookingLoading(false)
        return
      }
      if (!res.ok) {
        toast.error(data?.error ?? "Ошибка бронирования")
        setBookingLoading(false)
        return
      }
      onBooked?.()
      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl
      }
    } catch {
      toast.error("Ошибка соединения с сервером")
      setBookingLoading(false)
    }
  }

  if (!open) return null

  const ctaLabel = (() => {
    if (bookingLoading) return "Бронирование..."
    if (!selectedDate) return "Выбери день"
    if (!selectedSlot) return "Выбери время"
    return `Забронировать · ${formatPrice(price)}`
  })()

  return (
    <>
      <div className={`cal-overlay ${open ? "open visible" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false) }}>
        <div className={step === "teacher" ? "tch-modal" : "cal-modal"} role="dialog" aria-modal="true">
          {step === "teacher" ? (
            <>
              <div className="tch-header">
                <h3>Выбор преподавателя</h3>
                <button className="cal-close" onClick={() => onOpenChange(false)} aria-label="Закрыть">✕</button>
              </div>
              <div className="tch-body">
                <div className="tch-filters">
                  {[
                    { k: "all", label: "Все" },
                    { k: "native", label: "Native" },
                    { k: "general", label: "General" },
                    { k: "business", label: "Business" },
                    { k: "ielts", label: "IELTS / FCE" },
                  ].map((f) => (
                    <button
                      key={f.k}
                      className={`tch-filter${teachersFilter === f.k ? " active" : ""}`}
                      onClick={() => setTeachersFilter(f.k)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {teachersLoading ? (
                  <div className="tch-empty">Загружаем преподавателей...</div>
                ) : filteredTeachers.length === 0 ? (
                  <div className="tch-empty">Преподаватели не найдены</div>
                ) : (
                  <div className="tch-list">
                    {filteredTeachers.map((t) => (
                      <button
                        key={t.teacherProfileId}
                        className="tch-card"
                        onClick={() => {
                          setSelectedTeacher(t)
                          setStep("calendar")
                          if (!selectedDate) setSelectedDate(today)
                        }}
                      >
                        <div className="tch-avatar">
                          {t.avatarUrl ? <img src={t.avatarUrl} alt={t.name} /> : getInitials(t.name)}
                        </div>
                        <div className="tch-info">
                          <div className="tch-name">{t.name}</div>
                          <div className="tch-spec">
                            {[t.specializations.slice(0, 3).join(" · "), t.experienceYears ? `${t.experienceYears} лет опыта` : null]
                              .filter(Boolean)
                              .join(" · ") || "Преподаватель английского"}
                          </div>
                        </div>
                        <div className="tch-right">
                          {t.rating != null && (
                            <div className="tch-rating">
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              {t.rating.toFixed(1)}
                            </div>
                          )}
                          <div className="tch-price"><b>{formatPrice(t.hourlyRate)}</b> / час</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="cal-header">
                <div className="cal-header-left">
                  <button className="cal-back" onClick={() => setStep("teacher")} aria-label="Назад">←</button>
                  <div>
                    <h3>Записаться на занятие</h3>
                    <div className="cal-sub">{selectedTeacher?.name}</div>
                  </div>
                </div>
                <button className="cal-close" onClick={() => onOpenChange(false)} aria-label="Закрыть">✕</button>
              </div>
              <div className="cal-body">
                <div className="cal-dur">
                  {([25, 50] as Duration[]).map((d) => (
                    <button
                      key={d}
                      className={`cal-dur-btn${duration === d ? " active" : ""}`}
                      onClick={() => setDuration(d)}
                    >
                      {d} мин
                    </button>
                  ))}
                </div>

                <div className="cal-month">
                  <button className="cal-month-btn" onClick={() => setViewMonth((m) => subMonths(m, 1))} aria-label="Предыдущий месяц">←</button>
                  <div className="cal-month-name">{format(viewMonth, "LLLL yyyy", { locale: ru })}</div>
                  <button className="cal-month-btn" onClick={() => setViewMonth((m) => addMonths(m, 1))} aria-label="Следующий месяц">→</button>
                </div>

                <div className="cal-grid">
                  {WEEKDAYS.map((d) => <div key={d} className="cal-day-head">{d}</div>)}
                  {monthDays.map((d, i) => {
                    if (!d) return <div key={`e${i}`} className="cal-day cal-day--empty" />
                    const past = isBefore(d, today)
                    const isToday = isSameDay(d, today)
                    const isSelected = selectedDate && isSameDay(d, selectedDate)
                    const classes = ["cal-day"]
                    if (past) classes.push("cal-day--past")
                    if (isToday) classes.push("cal-day--today")
                    if (isSelected) classes.push("cal-day--selected")
                    return (
                      <button
                        key={d.toISOString()}
                        className={classes.join(" ")}
                        disabled={past}
                        onClick={() => setSelectedDate(d)}
                      >
                        {d.getDate()}
                      </button>
                    )
                  })}
                </div>

                {selectedDate && (
                  <>
                    <div className="cal-slots-title">
                      Доступные слоты — {format(selectedDate, "d MMMM", { locale: ru })}
                    </div>
                    {slotsLoading ? (
                      <div className="cal-slots">
                        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="cal-slot cal-slot--skeleton" />)}
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="cal-empty">Нет слотов на этот день</div>
                    ) : (
                      <div className="cal-slots">
                        {slots.map((s) => {
                          const isSel = selectedSlot === s.startTime
                          const cls = ["cal-slot"]
                          if (!s.available) cls.push("cal-slot--taken")
                          if (isSel) cls.push("selected")
                          return (
                            <button
                              key={s.startTime}
                              className={cls.join(" ")}
                              disabled={!s.available}
                              onClick={() => s.available && setSelectedSlot(s.startTime)}
                            >
                              <div className="cal-slot-time">{formatTimeUTC(s.startTime)}</div>
                              <div className="cal-slot-dur">{s.available ? `${duration} мин · UTC` : "Занято"}</div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="cal-footer">
                <button
                  className="cal-btn cal-btn--red"
                  disabled={!selectedSlot || bookingLoading}
                  onClick={handleConfirm}
                >
                  {ctaLabel}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{MODAL_CSS}</style>
    </>
  )
}

const MODAL_CSS = `
.cal-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .25s;padding:20px;font-family:Inter,system-ui,sans-serif}
.cal-overlay.open{display:flex}
.cal-overlay.visible{opacity:1}

.cal-modal,.tch-modal{width:100%;background:var(--surface);border-radius:24px;box-shadow:0 8px 0 var(--border),0 30px 60px rgba(0,0,0,.25);position:relative;overflow:hidden;max-height:90vh;display:flex;flex-direction:column;animation:calIn .3s cubic-bezier(.2,.7,.2,1.1);color:var(--text)}
.cal-modal{max-width:480px}
.tch-modal{max-width:620px}
.cal-modal::before,.tch-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),var(--lime));z-index:2}
@keyframes calIn{from{transform:translateY(14px) scale(.97);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}

.cal-header,.tch-header{padding:20px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);gap:12px}
.cal-header h3,.tch-header h3{font-size:1.1rem;font-weight:800;letter-spacing:-.3px;margin:0;color:var(--text)}
.cal-header-left{display:flex;align-items:center;gap:10px}
.cal-sub{font-size:.72rem;color:var(--muted);margin-top:2px}
.cal-back{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.9rem;flex-shrink:0}
.cal-back:hover{border-color:var(--red);color:var(--red)}
.cal-close{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:1rem;flex-shrink:0}
.cal-close:hover{border-color:var(--red);color:var(--red)}

.cal-body,.tch-body{padding:18px 22px;overflow-y:auto;flex:1}

.cal-dur{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px}
.cal-dur-btn{padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s}
.cal-dur-btn:hover{border-color:var(--red)}
.cal-dur-btn.active{background:rgba(230,57,70,.08);border-color:var(--red);color:var(--red)}

.cal-month{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.cal-month-name{font-size:.95rem;font-weight:700;text-transform:capitalize;color:var(--text)}
.cal-month-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.8rem;font-family:inherit}
.cal-month-btn:hover{border-color:var(--text);color:var(--text)}

.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:20px}
.cal-day-head{text-align:center;font-size:.6rem;font-weight:700;color:var(--muted);text-transform:uppercase;padding:4px 0}
.cal-day{aspect-ratio:1;border:none;border-radius:10px;background:none;display:flex;align-items:center;justify-content:center;font:inherit;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;color:var(--text)}
.cal-day:hover:not(:disabled){background:var(--surface-2)}
.cal-day--empty{pointer-events:none}
.cal-day--past,.cal-day:disabled{color:var(--muted);opacity:.4;cursor:not-allowed}
.cal-day--today{background:rgba(230,57,70,.12);color:var(--red);font-weight:800}
.cal-day--selected{background:var(--red)!important;color:#fff!important;box-shadow:0 2px 0 rgba(180,30,45,.3)}

.cal-slots-title{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
.cal-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}
.cal-slot{padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);text-align:center;cursor:pointer;transition:all .15s;font:inherit}
.cal-slot:hover:not(:disabled){border-color:var(--red);background:rgba(230,57,70,.04)}
.cal-slot.selected{background:var(--red);border-color:var(--red);color:#fff}
.cal-slot-time{font-size:.85rem;font-weight:700}
.cal-slot-dur{font-size:.6rem;color:var(--muted);margin-top:1px}
.cal-slot.selected .cal-slot-dur{color:rgba(255,255,255,.7)}
.cal-slot--taken{opacity:.35;cursor:not-allowed}
.cal-slot--taken .cal-slot-time{text-decoration:line-through}
.cal-slot--skeleton{height:54px;background:var(--surface-2);border-color:transparent;animation:calSkel 1.2s ease-in-out infinite;pointer-events:none}
@keyframes calSkel{50%{opacity:.5}}
.cal-empty{padding:16px;text-align:center;font-size:.82rem;color:var(--muted);border:1px dashed var(--border);border-radius:12px}

.cal-footer{padding:14px 22px 18px;border-top:1px solid var(--border)}
.cal-btn{width:100%;padding:14px;border:none;border-radius:14px;font-family:inherit;font-size:.9rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .3s}
.cal-btn--red{background:var(--red);color:#fff;box-shadow:0 4px 0 rgba(180,30,45,.4)}
.cal-btn--red:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 0 rgba(180,30,45,.4),0 12px 24px rgba(230,57,70,.22)}
.cal-btn--red:disabled{opacity:.4;cursor:not-allowed}

.tch-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.tch-filter{padding:7px 13px;border-radius:100px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:.72rem;font-weight:600;cursor:pointer;transition:all .15s}
.tch-filter:hover{border-color:var(--red);color:var(--red)}
.tch-filter.active{background:var(--red);border-color:var(--red);color:#fff}
.tch-list{display:flex;flex-direction:column;gap:8px}
.tch-card{display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;border:1px solid var(--border);background:var(--surface);cursor:pointer;transition:all .15s;text-align:left;font:inherit;color:var(--text);width:100%}
.tch-card:hover{border-color:var(--red);background:rgba(230,57,70,.03);transform:translateY(-1px)}
.tch-avatar{width:48px;height:48px;border-radius:14px;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.9rem;flex-shrink:0;overflow:hidden}
.tch-avatar img{width:100%;height:100%;object-fit:cover}
.tch-info{flex:1;min-width:0}
.tch-name{font-size:.92rem;font-weight:700;margin-bottom:2px}
.tch-spec{font-size:.72rem;color:var(--muted);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tch-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
.tch-rating{display:flex;align-items:center;gap:4px;font-size:.78rem;font-weight:700;color:#F59E0B}
.tch-price{font-size:.72rem;color:var(--muted)}
.tch-price b{color:var(--text);font-weight:800}
.tch-empty{padding:28px;text-align:center;color:var(--muted);font-size:.85rem}

@media(max-width:600px){
  .cal-overlay{padding:0;align-items:flex-end}
  .cal-modal,.tch-modal{border-radius:24px 24px 0 0;max-height:95vh}
  .cal-slots{grid-template-columns:repeat(2,1fr)}
  .tch-card{flex-wrap:wrap}
}
`
