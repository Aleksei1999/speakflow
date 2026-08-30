"use client"

// ---------------------------------------------------------------------------
// AddLessonModal — pixel-perfect по Figma YSwlSQF1n6QIpGTOohlMOd:
//   • 2208:2449 — empty (выбрать ученика, дата, время disabled)
//   • 2208:2699 — student dropdown (скролл-список, жирный выбранный)
//   • 2208:2489 — filled (можно нажать «Создать»)
//   • 2208:685  — date+time iOS-style scroll picker (два столбца)
//   • 2208:2509 — success (чек, ФИО+дата, таймер 0:59, красный ← back)
//
// Стили — в public/dashboard/raw-teacher.css (секция «Add Lesson Modal»
// в самом конце файла).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { cancelLesson, createLesson } from './lesson-actions'

export interface AddLessonStudent {
  id: string
  name: string
  level: string
  avatar: string | null
}

interface AddLessonModalProps {
  students: AddLessonStudent[]
  onClose: () => void
}

type ModalState =
  | 'empty'
  | 'picking-student'
  | 'picking-datetime'
  | 'filled'
  | 'creating'
  | 'success'
  | 'error'

// -----------------------------------------------------------------------------
// Date/time генерация. Дата — 30 дней вперёд от сегодня; время — 08:00..22:00,
// шаг 30 мин. Русская локаль без внешних зависимостей: даты вида «2 апреля».
// -----------------------------------------------------------------------------

const MONTHS_RU_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

interface DateOption {
  /** YYYY-MM-DD (local) */
  key: string
  label: string
  y: number
  m: number // 0-11
  d: number // 1-31
}

interface TimeOption {
  /** HH:MM */
  key: string
  label: string
  h: number
  min: number
}

function buildDateOptions(): DateOption[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const out: DateOption[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() + i * 86_400_000)
    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const label = i === 0 ? 'сегодня' : `${day} ${MONTHS_RU_GEN[m]}`
    out.push({ key, label, y, m, d: day })
  }
  return out
}

function buildTimeOptions(): TimeOption[] {
  const out: TimeOption[] = []
  for (let h = 8; h <= 22; h++) {
    for (const min of [0, 30]) {
      if (h === 22 && min === 30) continue
      const key = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      const label = `${h}:${String(min).padStart(2, '0')}`
      out.push({ key, label, h, min })
    }
  }
  return out
}

// -----------------------------------------------------------------------------
// iOS-style scroll picker колонки. Snap-scroll, активный элемент по центру.
// -----------------------------------------------------------------------------

const ITEM_H = 68 // px, высота одного элемента в пикере

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

  // Скроллим к выбранному при монтировании / смене value извне.
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
    // debounce — как только скролл остановился, коммитим value наверх и
    // подравниваем к сетке (snap).
    if (settleRef.current !== null) window.clearTimeout(settleRef.current)
    settleRef.current = window.setTimeout(() => {
      const finalIdx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)))
      el.scrollTo({ top: finalIdx * ITEM_H, behavior: 'smooth' })
      const key = items[finalIdx]?.key
      if (key) onChange(key)
    }, 120)
  }

  return (
    <div className="tr-al-wheel" aria-label={ariaLabel} role="listbox">
      <div className="tr-al-wheel-fade tr-al-wheel-fade--top" aria-hidden />
      <div className="tr-al-wheel-fade tr-al-wheel-fade--bot" aria-hidden />
      <div
        ref={scrollRef}
        className="tr-al-wheel-scroll"
        onScroll={onScroll}
      >
        <div className="tr-al-wheel-spacer" />
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            role="option"
            aria-selected={activeKey === it.key}
            className={`tr-al-wheel-item ${activeKey === it.key ? 'is-active' : ''}`}
            onClick={() => {
              const el = scrollRef.current
              if (!el) return
              const idx = items.findIndex((x) => x.key === it.key)
              el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
              onChange(it.key)
            }}
          >
            {it.label}
          </button>
        ))}
        <div className="tr-al-wheel-spacer" />
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Reusable UI-элементы
// -----------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ArrowDown() {
  // Чёрный круг с лаймовой стрелкой вниз. Размер 35×36 (Figma ellipse36).
  return (
    <span className="tr-al-arrow" aria-hidden>
      <svg viewBox="0 0 35 36" width="35" height="36" fill="none">
        <ellipse cx="17.5" cy="18" rx="17.5" ry="18" fill="#1E1E1E" />
        <path d="M17.5 10.5v13m0 0l-5-5m5 5l5-5" stroke="#DFED8C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function ArrowLeftLime() {
  // Лаймовый круг (в дропдауне ученика — «свернуть»). Стрелка ← чёрная.
  return (
    <span className="tr-al-arrow" aria-hidden>
      <svg viewBox="0 0 35 36" width="35" height="36" fill="none">
        <ellipse cx="17.5" cy="18" rx="17.5" ry="18" fill="#DFED8C" />
        <path d="M23 18H10m0 0l5-5m-5 5l5 5" stroke="#1E1E1E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function ArrowLeftRed() {
  // Красный круг с белой стрелкой ← (success back button).
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

// -----------------------------------------------------------------------------
// Основной компонент
// -----------------------------------------------------------------------------

export default function AddLessonModal({ students, onClose }: AddLessonModalProps) {
  const router = useRouter()

  const dateOptions = useMemo(buildDateOptions, [])
  const timeOptions = useMemo(buildTimeOptions, [])

  // ---- Стейт ----
  const [state, setState] = useState<ModalState>('empty')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [dateKey, setDateKey] = useState<string | null>(null)
  const [timeKey, setTimeKey] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [createdLesson, setCreatedLesson] = useState<{
    lessonId: string
    studentName: string
    dateLabel: string
    timeLabel: string
  } | null>(null)
  // Пока идёт cancelLesson RPC — блокируем повторный клик по ←.
  const [reverting, setReverting] = useState(false)

  // Success-таймер: 60 → 0. При 0 таймер просто останавливается —
  // модалка НЕ закрывается сама (пользователь должен закрыть крестиком/ESC).
  // Кнопка ← становится disabled когда 0 (revert больше нельзя).
  const [successRemaining, setSuccessRemaining] = useState(60)

  const selectedStudent = students.find((s) => s.id === studentId) ?? null
  const selectedDate = dateKey ? dateOptions.find((d) => d.key === dateKey) ?? null : null
  const selectedTime = timeKey ? timeOptions.find((t) => t.key === timeKey) ?? null : null

  const canCreate = !!selectedStudent && !!selectedDate && !!selectedTime

  // ---- ESC + body scroll lock ----
  // ESC в success → закрываем модалку (не revert). Это соответствует
  // логике «крестик X = закрыть», а revert доступен только через ←.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (state === 'picking-student' || state === 'picking-datetime') {
        setState(canCreate ? 'filled' : 'empty')
      } else {
        if (state === 'success') router.refresh()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [state, canCreate, onClose, router])

  // ---- Success-таймер ----
  // Таймер 60→0 просто отсчитывает окно, в котором пользователь может отменить
  // урок и вернуться редактировать (кнопка ←). При 0 → кнопка ← становится
  // disabled, но модалка остаётся открытой; пользователь сам закрывает её.
  useEffect(() => {
    if (state !== 'success') return
    setSuccessRemaining(60)
    const id = window.setInterval(() => {
      setSuccessRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [state])

  // Пересчёт state при заполнении полей (переход empty → filled).
  useEffect(() => {
    if (state === 'creating' || state === 'success' || state === 'error') return
    if (state === 'picking-student' || state === 'picking-datetime') return
    setState(canCreate ? 'filled' : 'empty')
  }, [canCreate, state])

  // ---- Обработчики ----

  function openStudentPicker() {
    setErrorMsg(null)
    setState('picking-student')
  }
  function openDateTimePicker() {
    setErrorMsg(null)
    // Если дата/время пусты — предзаполним первым вариантом чтобы пикер сразу
    // показывал что-то осмысленное (сегодня + 8:00).
    if (!dateKey) setDateKey(dateOptions[0]?.key ?? null)
    if (!timeKey) setTimeKey(timeOptions[0]?.key ?? null)
    setState('picking-datetime')
  }

  function pickStudent(id: string) {
    setStudentId(id)
    // При смене выбора чистим прошлые ошибки (slot_busy_*, validation и т.д.).
    setErrorMsg(null)
    // Закрываем дропдаун, возвращаемся в filled или empty
    setState(canCreate || (id && dateKey && timeKey) ? 'filled' : 'empty')
  }

  async function submit() {
    if (!selectedStudent || !selectedDate || !selectedTime) return
    setErrorMsg(null)
    setState('creating')
    // Собираем ISO из выбранных даты + времени (в локальной таймзоне пользователя).
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
      const res = await createLesson({
        studentId: selectedStudent.id,
        scheduledAt: dt.toISOString(),
      })
      if (res.ok) {
        setCreatedLesson({
          lessonId: res.lessonId,
          studentName: selectedStudent.name,
          dateLabel: selectedDate.label,
          timeLabel: selectedTime.label,
        })
        setState('success')
      } else {
        setErrorMsg(res.error || 'Не удалось создать урок')
        setState('error')
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось создать урок')
      setState('error')
    }
  }

  // Отмечаем, было ли создание урока успешным в этой сессии открытия модалки,
  // чтобы `handleClose` знал, нужен ли router.refresh() (расписание/students).
  // Отдельный ref, а не state — не хотим триггерить лишние ре-рендеры.
  const dirtyRef = useRef(false)

  // ---- Revert из success → filled (кнопка ← пока таймер > 0) ----
  // Удаляем урок из БД + Google (server action), возвращаемся в filled,
  // чтобы пользователь мог отредактировать поля. Пока идёт RPC — блок кнопки.
  async function revertToFilled() {
    if (!createdLesson || successRemaining <= 0 || reverting) return
    setReverting(true)
    try {
      await cancelLesson({ lessonId: createdLesson.lessonId })
    } catch (e) {
      // Даже если cancel упал — всё равно возвращаемся в filled, чтобы
      // пользователь мог поправить и пересоздать. Показываем ошибку в filled.
      console.error('[AddLessonModal] cancelLesson failed', e)
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось отменить урок')
    } finally {
      // Урок либо удалён, либо был попыткой удаления → БД потенциально изменена,
      // при закрытии обязательно refresh.
      dirtyRef.current = true
      setCreatedLesson(null)
      setReverting(false)
      setState('filled')
    }
  }

  // Финальное закрытие: обновляем дашборд ТОЛЬКО когда закрываемся
  // (в success мы не рефрешили, иначе data-fetch перерисовал бы под нами).
  function handleClose() {
    if (state === 'success' || dirtyRef.current) {
      router.refresh()
    }
    onClose()
  }

  // ---- Рендер ----

  const isSuccess = state === 'success'
  const timerLabel = `0:${String(successRemaining).padStart(2, '0')}`

  return (
    <div
      className="tr-add-lesson-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className={`tr-add-lesson${isSuccess ? ' tr-add-lesson--success' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tr-add-lesson-title"
      >
        {/* ─── Success timer top-center ─── */}
        {isSuccess && (
          <div className="tr-add-lesson-timer" aria-live="polite">
            {timerLabel}
          </div>
        )}

        <button
          type="button"
          className="tr-add-lesson-close"
          aria-label="Закрыть"
          onClick={handleClose}
        >
          <CloseIcon />
        </button>

        {/* ─── SUCCESS ─── */}
        {isSuccess ? (
          <>
            <div className="tr-add-lesson-success-title">
              В ваш календарь<br />добавлен урок
            </div>
            <div className="tr-add-lesson-success-check">
              <CheckIcon />
            </div>
            <div className="tr-add-lesson-success-name">{createdLesson?.studentName}</div>
            <div className="tr-add-lesson-success-when">
              {createdLesson?.dateLabel}, {createdLesson?.timeLabel}
            </div>
            <button
              type="button"
              className={`tr-add-lesson-success-back${successRemaining <= 0 || reverting ? ' is-disabled' : ''}`}
              aria-label={
                successRemaining > 0
                  ? 'Отменить и вернуться к редактированию'
                  : 'Отмена больше недоступна — таймер истёк'
              }
              title={
                successRemaining > 0
                  ? 'Отменить урок и вернуться к редактированию'
                  : 'Отмена больше недоступна'
              }
              onClick={revertToFilled}
              disabled={successRemaining <= 0 || reverting}
              style={successRemaining <= 0 ? { opacity: 0.4, cursor: 'default' } : undefined}
            >
              <ArrowLeftRed />
            </button>
          </>
        ) : (
          <>
            <h2 id="tr-add-lesson-title" className="tr-add-lesson-title">
              Добавить новый урок
            </h2>

            {/* ─── STUDENT ROW ─── */}
            {state === 'picking-student' ? (
              <div className="tr-add-lesson-dropdown">
                <button
                  type="button"
                  className="tr-add-lesson-pill tr-add-lesson-pill--full tr-add-lesson-pill--dropdown-head"
                  onClick={() => setState(canCreate ? 'filled' : 'empty')}
                >
                  <span className="tr-add-lesson-pill-placeholder">выберите ученика</span>
                  <ArrowLeftLime />
                </button>
                <div className="tr-add-lesson-dropdown-list" role="listbox">
                  {students.length === 0 ? (
                    <div className="tr-add-lesson-dropdown-empty">Учеников пока нет</div>
                  ) : (
                    students.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={studentId === s.id}
                        className={`tr-add-lesson-dropdown-item${studentId === s.id ? ' is-selected' : ''}${i > 0 ? ' has-divider' : ''}`}
                        onClick={() => pickStudent(s.id)}
                      >
                        {s.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="tr-add-lesson-pill tr-add-lesson-pill--full"
                onClick={openStudentPicker}
              >
                {selectedStudent ? (
                  <span className="tr-add-lesson-pill-value">{selectedStudent.name}</span>
                ) : (
                  <span className="tr-add-lesson-pill-placeholder">выберите ученика</span>
                )}
                <ArrowDown />
              </button>
            )}

            {/* ─── DATE + TIME ROW ─── */}
            {state === 'picking-datetime' ? (
              <div className="tr-add-lesson-row tr-add-lesson-row--picker">
                <div className="tr-add-lesson-half tr-add-lesson-half--picker">
                  <div className="tr-add-lesson-picker-head">
                    <span className="tr-add-lesson-pill-placeholder">дата</span>
                    <button
                      type="button"
                      className="tr-add-lesson-picker-back"
                      aria-label="Свернуть выбор даты"
                      onClick={() => setState(canCreate ? 'filled' : 'empty')}
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
                <div className="tr-add-lesson-half tr-add-lesson-half--picker">
                  <div className="tr-add-lesson-picker-head">
                    <span className="tr-add-lesson-pill-placeholder">время</span>
                    <button
                      type="button"
                      className="tr-add-lesson-picker-back"
                      aria-label="Свернуть выбор времени"
                      onClick={() => setState(canCreate ? 'filled' : 'empty')}
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
              <div className="tr-add-lesson-row">
                <button
                  type="button"
                  className="tr-add-lesson-pill tr-add-lesson-pill--half"
                  onClick={openDateTimePicker}
                >
                  {selectedDate ? (
                    <span className="tr-add-lesson-pill-value">{selectedDate.label}</span>
                  ) : (
                    <span className="tr-add-lesson-pill-placeholder">дата</span>
                  )}
                  <ArrowDown />
                </button>
                <button
                  type="button"
                  className="tr-add-lesson-pill tr-add-lesson-pill--half"
                  onClick={openDateTimePicker}
                >
                  {selectedTime ? (
                    <span className="tr-add-lesson-pill-value">{selectedTime.label}</span>
                  ) : (
                    <span className="tr-add-lesson-pill-placeholder">время</span>
                  )}
                  <ArrowDown />
                </button>
              </div>
            )}

            {/* ─── CREATE BUTTON ─── */}
            <div className="tr-add-lesson-footer">
              <button
                type="button"
                className="tr-add-lesson-btn"
                disabled={!canCreate || state === 'creating'}
                onClick={submit}
              >
                {state === 'creating' ? 'Создаём…' : 'Создать'}
              </button>
              {(state === 'error' || (state === 'filled' && errorMsg)) && errorMsg && (
                <div className="tr-add-lesson-error" role="alert">
                  {errorMsg}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
