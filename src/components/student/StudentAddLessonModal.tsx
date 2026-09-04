"use client"

// ---------------------------------------------------------------------------
// StudentAddLessonModal — Figma nodes:
//   • 2208:2469 — «Добавить новый урок», пилюли collapsed
//   • 2208:3269 — event-picker раскрыт: «Записаться на урок» + список лекций
//   • 2208:2638 — «Запись на урок», препод + дата + время collapsed
//   • 2208:2608 — дата+время развёрнуты (wheel-picker обе колонки)
//   • 2208:3346 — success: «Ваша заявка на урок отправлена!» + 0:59 timer
//   • 2208:3358 — info-нотификация «Время изменилось» (отдельный компонент)
//
// Стили — public/dashboard/student-add-lesson.css (подгружается компонентом).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"

// ─── Types ──────────────────────────────────────────────────────────────────
interface Lecture {
  id: string
  title: string
  description: string | null
  host_name: string | null
  scheduled_at: string
  duration_minutes: number
  cover_url: string | null
  tag: string | null
  capacity: number | null
}

interface Teacher {
  teacherProfileId: string
  userId: string
  name: string
  avatarUrl: string | null
  hourlyRate: number
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

type ModalMode =
  | "event"          // 2469 collapsed
  | "event-open"     // 3269 dropdown
  | "lesson"         // 2638 collapsed
  | "lesson-pickers" // 2608 date+time expanded
  | "lesson-teachers" // teacher dropdown expanded
  | "creating"
  | "success"        // 3346
  | "success-lecture" // registered for a lecture

// ─── Дата/время генерация ────────────────────────────────────────────────────
const MONTHS_RU_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
]

interface DateOption { key: string; label: string; y: number; m: number; d: number }
interface TimeOption { key: string; label: string; h: number; min: number }

function buildDateOptions(): DateOption[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const out: DateOption[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() + i * 86_400_000)
    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const label = i === 0 ? "сегодня" : `${day} ${MONTHS_RU_GEN[m]}`
    out.push({ key, label, y, m, d: day })
  }
  return out
}

function buildTimeOptions(): TimeOption[] {
  const out: TimeOption[] = []
  for (let h = 8; h <= 22; h++) {
    for (const min of [0, 30]) {
      if (h === 22 && min === 30) continue
      const key = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
      const label = `${h}:${String(min).padStart(2, "0")}`
      out.push({ key, label, h, min })
    }
  }
  return out
}

// ─── Icons ──────────────────────────────────────────────────────────────────
function CloseIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function ArrowDown() {
  return (
    <span className="sal-arrow" aria-hidden>
      <svg viewBox="0 0 35 36" width="35" height="36" fill="none">
        <ellipse cx="17.5" cy="18" rx="17.5" ry="18" fill="#1E1E1E" />
        <path d="M17.5 10.5v13m0 0l-5-5m5 5l5-5" stroke="#DFED8C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
function ArrowLeftLime() {
  return (
    <span className="sal-arrow" aria-hidden>
      <svg viewBox="0 0 35 36" width="35" height="36" fill="none">
        <ellipse cx="17.5" cy="18" rx="17.5" ry="18" fill="#DFED8C" />
        <path d="M23 18H10m0 0l5-5m-5 5l5 5" stroke="#1E1E1E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
function ArrowLeftRed() {
  return (
    <svg viewBox="0 0 46 47" width="46" height="47" fill="none" aria-hidden>
      <ellipse cx="23" cy="23.5" rx="23" ry="23.5" fill="#CC3A3A" />
      <path d="M32 23.5H14m0 0l7-7m-7 7l7 7" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 69 69" width="69" height="69" fill="none" aria-hidden>
      <circle cx="34.5" cy="34.5" r="34.5" fill="#1E1E1E" />
      <path d="M20 35l10 10 20-22" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── WheelPicker ────────────────────────────────────────────────────────────
const ITEM_H = 68

interface WheelPickerProps<T extends { key: string; label: string }> {
  items: T[]
  value: string
  onChange(key: string): void
  ariaLabel: string
}
function WheelPicker<T extends { key: string; label: string }>({
  items, value, onChange, ariaLabel,
}: WheelPickerProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeKey, setActiveKey] = useState(value)
  const settleRef = useRef<number | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.max(0, items.findIndex((i) => i.key === value))
    el.scrollTop = idx * ITEM_H
    setActiveKey(value)
  }, [value, items])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollTop / ITEM_H)
    const clamped = Math.max(0, Math.min(items.length - 1, idx))
    const next = items[clamped]?.key
    if (next && next !== activeKey) setActiveKey(next)
    if (settleRef.current !== null) window.clearTimeout(settleRef.current)
    settleRef.current = window.setTimeout(() => {
      const finalIdx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)))
      el.scrollTo({ top: finalIdx * ITEM_H, behavior: "smooth" })
      const key = items[finalIdx]?.key
      if (key) onChange(key)
    }, 120)
  }

  return (
    <div className="sal-wheel" aria-label={ariaLabel} role="listbox">
      <div className="sal-wheel-fade sal-wheel-fade--top" aria-hidden />
      <div className="sal-wheel-fade sal-wheel-fade--bot" aria-hidden />
      <div ref={scrollRef} className="sal-wheel-scroll" onScroll={onScroll}>
        <div className="sal-wheel-spacer" />
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            role="option"
            aria-selected={activeKey === it.key}
            className={`sal-wheel-item ${activeKey === it.key ? "is-active" : ""}`}
            onClick={() => {
              const el = scrollRef.current
              if (!el) return
              const idx = items.findIndex((x) => x.key === it.key)
              el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" })
              onChange(it.key)
            }}
          >
            {it.label}
          </button>
        ))}
        <div className="sal-wheel-spacer" />
      </div>
    </div>
  )
}

// ─── formatting helpers ─────────────────────────────────────────────────────
function formatLectureWhen(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const m = MONTHS_RU_GEN[d.getMonth()]
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${day} ${m} ${hh}:${mm}`
}

// ─── Main component ────────────────────────────────────────────────────────
export default function StudentAddLessonModal({ open, onClose, onCreated }: Props) {
  const router = useRouter()
  const dateOptions = useMemo(buildDateOptions, [])
  const timeOptions = useMemo(buildTimeOptions, [])

  const [mode, setMode] = useState<ModalMode>("event")

  // Event-picker state
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [lecturesLoading, setLecturesLoading] = useState(false)
  const [expandedLectureId, setExpandedLectureId] = useState<string | null>(null)

  // Lesson state
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [dateKey, setDateKey] = useState<string | null>(null)
  const [timeKey, setTimeKey] = useState<string | null>(null)

  // Success state
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [createdLesson, setCreatedLesson] = useState<{
    lessonId: string
    teacherName: string
    dateLabel: string
    timeLabel: string
  } | null>(null)
  const [registeredLectureTitle, setRegisteredLectureTitle] = useState<string | null>(null)
  const [successRemaining, setSuccessRemaining] = useState(60)
  const [reverting, setReverting] = useState(false)

  const selectedTeacher = teachers.find((t) => t.teacherProfileId === teacherId) ?? null
  const selectedDate = dateKey ? dateOptions.find((d) => d.key === dateKey) ?? null : null
  const selectedTime = timeKey ? timeOptions.find((t) => t.key === timeKey) ?? null : null
  const canCreate = !!selectedTeacher && !!selectedDate && !!selectedTime

  // Reset on open
  useEffect(() => {
    if (!open) return
    setMode("event")
    setExpandedLectureId(null)
    setTeacherId(null)
    setDateKey(null)
    setTimeKey(null)
    setErrorMsg(null)
    setCreatedLesson(null)
    setRegisteredLectureTitle(null)
    setSuccessRemaining(60)
    // Разрешаем повторную загрузку teachers в этой сессии модалки
    // (fetchedRef был поставлен в true при прошлом open — при закрытии
    // мы могли не дождаться ответа).
    teachersFetchedRef.current = false
    setTeachers([])
  }, [open])

  // Load lectures когда открывается event-picker
  useEffect(() => {
    if (!open || mode !== "event-open") return
    let cancelled = false
    setLecturesLoading(true)
    fetch("/api/lectures", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { lectures: [] }))
      .then((json) => { if (!cancelled) setLectures(json.lectures ?? []) })
      .catch(() => { if (!cancelled) setLectures([]) })
      .finally(() => { if (!cancelled) setLecturesLoading(false) })
    return () => { cancelled = true }
  }, [open, mode])

  // Load teachers когда переходим в lesson-режим.
  // fire-and-forget: cancelled/abort умышленно НЕ используем, потому что
  // deps=[open,mode] триггерят cleanup при каждой смене mode
  // (lesson → lesson-pickers → lesson-teachers). Прошлая версия ставила
  // cancelled=true в cleanup — finally уходил в early-return и
  // teachersLoading залипал в true. AbortController оставляем только для
  // 15-сек hard-таймаута.
  const teachersFetchedRef = useRef(false)
  useEffect(() => {
    if (!open) return
    if (mode !== "lesson" && mode !== "lesson-teachers") return
    if (teachersFetchedRef.current) return
    teachersFetchedRef.current = true
    setTeachersLoading(true)
    const ctrl = new AbortController()
    const timeoutId = window.setTimeout(() => ctrl.abort(), 15_000)
    ;(async () => {
      try {
        const r = await fetch("/api/booking/teachers", { cache: "no-store", signal: ctrl.signal })
        const json = r.ok ? await r.json() : { teachers: [] }
        const list = (json.teachers ?? []) as Teacher[]
        setTeachers(list)
        if (list.length > 0) setTeacherId((prev) => prev || list[0].teacherProfileId)
      } catch (e) {
        console.error("[StudentAddLessonModal] teachers fetch failed", e)
        setTeachers([])
        // retry разрешён после ошибки
        teachersFetchedRef.current = false
      } finally {
        window.clearTimeout(timeoutId)
        setTeachersLoading(false)
      }
    })()
  }, [open, mode])

  // ESC + scroll-lock
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (mode === "event-open") setMode("event")
      else if (mode === "lesson-pickers" || mode === "lesson-teachers") setMode("lesson")
      else handleClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, mode])

  // Success timer
  useEffect(() => {
    if (mode !== "success") return
    setSuccessRemaining(60)
    const id = window.setInterval(() => {
      setSuccessRemaining((r) => {
        if (r <= 1) { window.clearInterval(id); return 0 }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [mode])

  const dirtyRef = useRef(false)

  function handleClose() {
    if (dirtyRef.current) router.refresh()
    onClose()
  }

  async function pickEventLesson() {
    setMode("lesson")
    // Prefill defaults для пикеров.
    if (!dateKey) setDateKey(dateOptions[0]?.key ?? null)
    if (!timeKey) setTimeKey(timeOptions[0]?.key ?? null)
  }

  async function registerLecture(lectureId: string, title: string) {
    setErrorMsg(null)
    setMode("creating")
    try {
      const r = await fetch("/api/lectures/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
      dirtyRef.current = true
      setRegisteredLectureTitle(title)
      setMode("success-lecture")
      onCreated?.()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Не удалось зарегистрироваться")
      setMode("event-open")
    }
  }

  async function submitLesson() {
    if (!selectedTeacher || !selectedDate || !selectedTime) return
    setErrorMsg(null)
    setMode("creating")
    const dt = new Date(
      selectedDate.y,
      selectedDate.m,
      selectedDate.d,
      selectedTime.h,
      selectedTime.min,
      0,
      0,
    )
    try {
      // Заявка на урок (не прямая бронь). Учитель увидит в модалке «запрос
      // на урок»; при accept у него автоматически создастся lessons.
      const r = await fetch("/api/lesson-request/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: selectedTeacher.userId,
          scheduledAt: dt.toISOString(),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
      dirtyRef.current = true
      setCreatedLesson({
        // Храним requestId в поле lessonId (переиспользуем существующий стейт;
        // фактически это id заявки, а не урока — revert идёт в /lesson-request/cancel).
        lessonId: j.requestId,
        teacherName: selectedTeacher.name,
        dateLabel: selectedDate.label,
        timeLabel: selectedTime.label,
      })
      setMode("success")
      onCreated?.()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Не удалось отправить заявку")
      setMode("lesson")
    }
  }

  async function revertLesson() {
    if (!createdLesson || successRemaining <= 0 || reverting) return
    setReverting(true)
    try {
      // createdLesson.lessonId в новом flow — это id заявки, отменяем через
      // соответствующий endpoint.
      await fetch("/api/lesson-request/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: createdLesson.lessonId }),
      })
    } catch (e) {
      console.error("[StudentAddLessonModal] cancel failed", e)
    } finally {
      dirtyRef.current = true
      setCreatedLesson(null)
      setReverting(false)
      setMode("lesson")
    }
  }

  if (!open || typeof document === "undefined") return null

  const isSuccess = mode === "success" || mode === "success-lecture"
  const timerLabel = `0:${String(successRemaining).padStart(2, "0")}`
  const isSmallCard = isSuccess

  return createPortal(
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/student-add-lesson.css?v=1" />
      <div
        className="sal-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      >
        <div
          className={`sal-card${isSmallCard ? " sal-card--small" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sal-title"
        >
          {mode === "success" && (
            <div className="sal-timer" aria-live="polite">{timerLabel}</div>
          )}

          <button type="button" className="sal-close" aria-label="Закрыть" onClick={handleClose}>
            <CloseIcon />
          </button>

          {/* ============ SUCCESS (lesson) ============ */}
          {mode === "success" && (
            <>
              <h2 id="sal-title" className="sal-success-title">
                Ваша заявка<br />на урок отправлена!
              </h2>
              <div className="sal-success-check"><CheckIcon /></div>
              <div className="sal-success-note">
                Преподаватель напишет вам<br />
                в <b>чат или вы увидите<br />
                упоминание в календаре</b>,<br />
                что ваше время принято.
              </div>
              <button
                type="button"
                className={`sal-success-back${successRemaining <= 0 || reverting ? " is-disabled" : ""}`}
                aria-label={successRemaining > 0 ? "Отменить и вернуться к редактированию" : "Отмена больше недоступна"}
                onClick={revertLesson}
                disabled={successRemaining <= 0 || reverting}
              >
                <ArrowLeftRed />
              </button>
            </>
          )}

          {/* ============ SUCCESS (lecture) ============ */}
          {mode === "success-lecture" && (
            <>
              <h2 id="sal-title" className="sal-success-title">
                Вы зарегистрированы<br />на лекцию!
              </h2>
              <div className="sal-success-check"><CheckIcon /></div>
              <div className="sal-success-note">
                <b>{registeredLectureTitle}</b><br />
                — событие появится в вашем календаре.
              </div>
            </>
          )}

          {/* ============ EVENT / EVENT-OPEN ============ */}
          {(mode === "event" || mode === "event-open") && (
            <>
              <h2 id="sal-title" className="sal-title">
                {mode === "event-open" ? "Выберите событие" : "Добавить новый урок"}
              </h2>

              {mode === "event" ? (
                <>
                  <button
                    type="button"
                    className="sal-pill sal-pill--full"
                    onClick={() => setMode("event-open")}
                  >
                    <span className="sal-pill-placeholder">выберите событие</span>
                    <ArrowDown />
                  </button>
                  <div className="sal-row">
                    <div className="sal-pill sal-pill--half sal-pill--disabled">
                      <span className="sal-pill-placeholder">дата</span>
                      <ArrowDown />
                    </div>
                    <div className="sal-pill sal-pill--half sal-pill--disabled">
                      <span className="sal-pill-placeholder">время</span>
                      <ArrowDown />
                    </div>
                  </div>
                  <div className="sal-footer">
                    <button type="button" className="sal-btn sal-btn--red" disabled>
                      Создать
                    </button>
                    {errorMsg && <div className="sal-error" role="alert">{errorMsg}</div>}
                  </div>
                </>
              ) : (
                <div className="sal-event-list">
                  <button
                    type="button"
                    className="sal-pill sal-pill--full sal-pill--head"
                    onClick={() => setMode("event")}
                  >
                    <span className="sal-pill-placeholder">выберите событие</span>
                    <ArrowLeftLime />
                  </button>
                  <button
                    type="button"
                    className="sal-pill sal-pill--full sal-pill--option"
                    onClick={pickEventLesson}
                  >
                    <span className="sal-pill-value">Записаться на урок</span>
                    <ArrowDown />
                  </button>

                  {lecturesLoading && (
                    <div className="sal-lect-empty">Загружаем расписание лектория…</div>
                  )}
                  {!lecturesLoading && lectures.length === 0 && (
                    <div className="sal-lect-empty">Пока нет запланированных лекций.</div>
                  )}
                  {lectures.map((l) => {
                    const isExp = expandedLectureId === l.id
                    return (
                      <div key={l.id} className="sal-lect-wrap">
                        <button
                          type="button"
                          className={`sal-pill sal-pill--full sal-pill--option${isExp ? " is-expanded" : ""}`}
                          onClick={() => setExpandedLectureId(isExp ? null : l.id)}
                        >
                          <span className="sal-pill-value">{l.title}</span>
                          {isExp ? <ArrowLeftLime /> : <ArrowDown />}
                        </button>
                        {isExp && (
                          <div className="sal-lect-body">
                            <div className="sal-lect-when">{formatLectureWhen(l.scheduled_at)}</div>
                            {l.description && (
                              <p className="sal-lect-desc">{l.description}</p>
                            )}
                            <button
                              type="button"
                              className="sal-btn sal-btn--red sal-lect-cta"
                              onClick={() => registerLecture(l.id, l.title)}
                            >
                              Записаться
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ============ LESSON MODES ============ */}
          {(mode === "lesson" || mode === "lesson-pickers" || mode === "lesson-teachers" || mode === "creating") && (
            <>
              <h2 id="sal-title" className="sal-title">Запись на урок</h2>

              {/* Teacher pill */}
              {mode === "lesson-teachers" ? (
                <div className="sal-dropdown">
                  <button
                    type="button"
                    className="sal-pill sal-pill--full sal-pill--head"
                    onClick={() => setMode("lesson")}
                  >
                    <span className="sal-pill-placeholder">выберите преподавателя</span>
                    <ArrowLeftLime />
                  </button>
                  <div className="sal-dropdown-list" role="listbox">
                    {teachersLoading && <div className="sal-dropdown-empty">Загружаем…</div>}
                    {!teachersLoading && teachers.length === 0 && (
                      <div className="sal-dropdown-empty">Преподаватели не найдены</div>
                    )}
                    {teachers.map((t, i) => (
                      <button
                        key={t.teacherProfileId}
                        type="button"
                        role="option"
                        aria-selected={teacherId === t.teacherProfileId}
                        className={`sal-dropdown-item${teacherId === t.teacherProfileId ? " is-selected" : ""}${i > 0 ? " has-divider" : ""}`}
                        onClick={() => {
                          setTeacherId(t.teacherProfileId)
                          setMode("lesson")
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="sal-pill sal-pill--full"
                  onClick={() => setMode("lesson-teachers")}
                  disabled={mode === "creating"}
                >
                  {selectedTeacher ? (
                    <span className="sal-pill-value">{selectedTeacher.name}</span>
                  ) : (
                    <span className="sal-pill-placeholder">
                      {teachersLoading ? "загружаем…" : "выберите преподавателя"}
                    </span>
                  )}
                  <ArrowDown />
                </button>
              )}

              {/* Date + Time */}
              {mode === "lesson-pickers" ? (
                <div className="sal-row sal-row--picker">
                  <div className="sal-half sal-half--picker">
                    <div className="sal-picker-head">
                      <span className="sal-pill-placeholder">дата</span>
                      <button
                        type="button"
                        className="sal-picker-back"
                        aria-label="Свернуть выбор даты"
                        onClick={() => setMode("lesson")}
                      >
                        <ArrowLeftLime />
                      </button>
                    </div>
                    <WheelPicker
                      items={dateOptions}
                      value={dateKey ?? dateOptions[0].key}
                      onChange={setDateKey}
                      ariaLabel="Дата урока"
                    />
                  </div>
                  <div className="sal-half sal-half--picker">
                    <div className="sal-picker-head">
                      <span className="sal-pill-placeholder">время</span>
                      <button
                        type="button"
                        className="sal-picker-back"
                        aria-label="Свернуть выбор времени"
                        onClick={() => setMode("lesson")}
                      >
                        <ArrowLeftLime />
                      </button>
                    </div>
                    <WheelPicker
                      items={timeOptions}
                      value={timeKey ?? timeOptions[0].key}
                      onChange={setTimeKey}
                      ariaLabel="Время урока"
                    />
                  </div>
                </div>
              ) : (
                <div className="sal-row">
                  <button
                    type="button"
                    className="sal-pill sal-pill--half"
                    onClick={() => setMode("lesson-pickers")}
                    disabled={mode === "creating"}
                  >
                    {selectedDate ? (
                      <span className="sal-pill-value">{selectedDate.label}</span>
                    ) : (
                      <span className="sal-pill-placeholder">дата</span>
                    )}
                    <ArrowDown />
                  </button>
                  <button
                    type="button"
                    className="sal-pill sal-pill--half"
                    onClick={() => setMode("lesson-pickers")}
                    disabled={mode === "creating"}
                  >
                    {selectedTime ? (
                      <span className="sal-pill-value">{selectedTime.label}</span>
                    ) : (
                      <span className="sal-pill-placeholder">время</span>
                    )}
                    <ArrowDown />
                  </button>
                </div>
              )}

              <div className="sal-footer">
                <button
                  type="button"
                  className="sal-btn sal-btn--red"
                  disabled={!canCreate || mode === "creating"}
                  onClick={submitLesson}
                >
                  {mode === "creating" ? "Создаём…" : "Создать"}
                </button>
                {errorMsg && <div className="sal-error" role="alert">{errorMsg}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
