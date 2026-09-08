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
import CustomScroll from "@/components/dashboard/CustomScroll"

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
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
}
// Стрелка выбора — экспорт Figma: круг Ellipse 36 (35×36, #1E1E1E) + Vector 42 (лаймовая стрелка, повёрнута вниз)
function ArrowDown() {
  return (
    <span className="sal-arrow" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sal-arrow-circle" src="/dashboard/ic-dd-circle.svg" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sal-arrow-glyph" src="/dashboard/ic-dd-arrow.svg" alt="" />
    </span>
  )
}
// Стрелка «назад» — экспорт Figma 2522:3654: круг Ellipse 37 (35×36, #DFED8C) + Vector 43 (тёмная стрелка, повёрнута на 180°)
function ArrowLeftLime() {
  return (
    <span className="sal-arrow" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sal-arrow-circle" src="/dashboard/ic-dd-circle-lime.svg" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sal-arrow-glyph sal-arrow-glyph--left" src="/dashboard/ic-dd-arrow-dark.svg" alt="" />
    </span>
  )
}
// Figma 2522:3701: кнопка «назад» — Ellipse 40 (46×47, #CC3A3A) + Vector 46 (белая стрелка 25×22, повёрнута на 180°)
function ArrowLeftRed() {
  return (
    <span className="sal-back-ic" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sal-back-ic-circle" src="/dashboard/ic-back-circle-red.svg" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sal-back-ic-glyph" src="/dashboard/ic-back-arrow-white.svg" alt="" />
    </span>
  )
}
// Figma 2522:3701: галочка — Ellipse 35 (69×69, #1E1E1E) + Vector 38 (лаймовая галочка 35×29 со штрихом)
function CheckIcon() {
  return (
    <span className="sal-check-ic" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sal-check-ic-circle" src="/dashboard/ic-check-circle.svg" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sal-check-ic-mark" src="/dashboard/ic-check-mark.svg" alt="" />
    </span>
  )
}

// ─── PickerList (дата / время) ──────────────────────────────────────────────
// Figma 2522:2665 «Добавить урок (дата и время)»: список опций, ряд 70 + разделитель 1px;
// обычный пункт Inter 500 32, выбранный Inter 700 36; скроллбар 7×107 (Rectangle 180/181)
interface PickerListProps<T extends { key: string; label: string }> {
  items: T[]
  value: string
  onChange: (key: string) => void
  ariaLabel: string
}
function PickerList<T extends { key: string; label: string }>({
  items, value, onChange, ariaLabel,
}: PickerListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.max(0, items.findIndex((i) => i.key === value))
    // выбранный пункт — вторым видимым (в макете «2 апреля» на 451 при треке 376…483)
    el.scrollTop = Math.max(0, idx * 71 - 54)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <CustomScroll className="sal-plist" scrollRef={scrollRef} track={107} ariaLabel={ariaLabel} role="listbox">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="option"
          aria-selected={value === it.key}
          className={`sal-plist-item${value === it.key ? " is-active" : ""}`}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </CustomScroll>
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
  const allDateOptions = useMemo(buildDateOptions, [])
  const allTimeOptions = useMemo(buildTimeOptions, [])

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
  const [registeringLectureId, setRegisteringLectureId] = useState<string | null>(null)
  const [successRemaining, setSuccessRemaining] = useState(60)
  const [reverting, setReverting] = useState(false)

  const selectedTeacher = teachers.find((t) => t.teacherProfileId === teacherId) ?? null
  // Прошедшие слоты не показываем: для «сегодня» остаются только времена позже текущего,
  // а если на сегодня слотов не осталось — «сегодня» уходит из списка дат.
  const nowMs = Date.now()
  const slotMs = (d: DateOption, t: TimeOption) => new Date(d.y, d.m, d.d, t.h, t.min, 0, 0).getTime()
  const dateOptions = allDateOptions.filter((d) => allTimeOptions.some((t) => slotMs(d, t) > nowMs))
  const selectedDate = dateKey ? dateOptions.find((d) => d.key === dateKey) ?? null : null
  const timeOptions = selectedDate ? allTimeOptions.filter((t) => slotMs(selectedDate, t) > nowMs) : allTimeOptions
  // Если выбранное время ушло в прошлое — берём первое доступное.
  const effectiveTimeKey = timeKey && timeOptions.some((t) => t.key === timeKey) ? timeKey : timeOptions[0]?.key ?? null
  const selectedTime = effectiveTimeKey ? timeOptions.find((t) => t.key === effectiveTimeKey) ?? null : null
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
    setSuccessRemaining(59) // в макете первое значение «0:59»
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
    if (registeringLectureId) return
    setErrorMsg(null)
    setRegisteringLectureId(lectureId)
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
    } finally {
      setRegisteringLectureId(null)
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
  const timerLabel = `${Math.floor(successRemaining / 60)}:${String(successRemaining % 60).padStart(2, "0")}`
  const isSmallCard = isSuccess

  return createPortal(
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/student-add-lesson.css?v=20260908-success" />
      <div
        className="sal-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      >
        <div
          className={`sal-card${isSmallCard ? " sal-card--small" : ""}${mode === "event-open" ? " sal-card--events" : ""}${mode === "lesson-pickers" ? " sal-card--pickers" : ""}`}
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
              {/* Figma 2522:3704: Inter 500 24, «в» — 400, «чат … календаре» — 700 */}
              <div className="sal-success-note">
                Преподаватель напишет вам<br />
                <span className="sal-success-reg">в</span> <b>чат или вы увидите<br />
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
                – событие появится в вашем календаре.
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
                  {/* Figma 2522:3654: заголовок «Выберете событие» (в макете с опечаткой), пилюли 578×68 r34 Inter 500 32, зазор 23 */}
                  <button
                    type="button"
                    className="sal-pill sal-pill--full sal-pill--lg"
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
                    const isReg = registeringLectureId === l.id
                    return (
                      <div key={l.id} className={`sal-lect-wrap${isExp ? " is-expanded" : ""}`}>
                        <button
                          type="button"
                          className="sal-pill sal-pill--full sal-pill--lg"
                          aria-expanded={isExp}
                          onClick={() => setExpandedLectureId(isExp ? null : l.id)}
                        >
                          <span className="sal-pill-value">{l.title}</span>
                          {isExp ? <ArrowLeftLime /> : <ArrowDown />}
                        </button>
                        {isExp && (
                          /* раскрытая лекция: фон rgba(255,255,255,.5) 578×309, дата Inter 700 32 (красная после нажатия — 2522:3678),
                             описание Inter 500 24, скроллбар 7px */
                          <div className="sal-lect-body">
                            <CustomScroll className="sal-lect" track={188}>
                              <button
                                type="button"
                                className={`sal-lect-when${isReg ? " is-selected" : ""}`}
                                disabled={!!registeringLectureId}
                                onClick={() => registerLecture(l.id, l.title)}
                              >
                                {formatLectureWhen(l.scheduled_at)}
                              </button>
                              {l.description && (
                                <p className="sal-lect-desc">{l.description}</p>
                              )}
                            </CustomScroll>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {errorMsg && <div className="sal-error" role="alert">{errorMsg}</div>}
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
                  className={`sal-pill sal-pill--full${selectedTeacher ? " sal-pill--lg sal-pill--sym" : ""}`}
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
                    <PickerList
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
                    <PickerList
                      items={timeOptions}
                      value={effectiveTimeKey ?? ""}
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

              {mode !== "lesson-pickers" && (
                <div className="sal-footer">
                  <button
                    type="button"
                    className={`sal-btn sal-btn--red${mode === "creating" ? " busy" : ""}`}
                    disabled={!canCreate || mode === "creating"}
                    onClick={submitLesson}
                  >
                    Создать
                  </button>
                  {errorMsg && <div className="sal-error" role="alert">{errorMsg}</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
