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
import CustomScroll from '@/components/dashboard/CustomScroll'

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

export const MONTHS_RU_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

export interface DateOption {
  /** YYYY-MM-DD (local) */
  key: string
  label: string
  y: number
  m: number // 0-11
  d: number // 1-31
}

export interface TimeOption {
  /** HH:MM */
  key: string
  label: string
  h: number
  min: number
}

export function buildDateOptions(): DateOption[] {
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

export function buildTimeOptions(): TimeOption[] {
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
// (В AddLessonModal заменён на PickerList по Figma 2522:696; пока используется
// в EditLessonModal и админских модалках.)
// -----------------------------------------------------------------------------

const ITEM_H = 68 // px, высота одного элемента в пикере

interface WheelPickerProps<T extends { key: string; label: string }> {
  items: T[]
  value: string
  onChange(key: string): void
  ariaLabel: string
}

export function WheelPicker<T extends { key: string; label: string }>({
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
// PickerList (дата / время). Figma 2522:696: список 281×149 под белой шапкой 68,
// ряд 72 + разделитель 1px (Line 4: 206 wide at x=83, black .26), обычный пункт
// Inter 500 32, выбранный Inter 700 36; скроллбар 7×107 at (310,376) — top 14 / right 18.
// -----------------------------------------------------------------------------

const ROW_H = 73 // 72 + 1px разделитель

interface PickerListProps<T extends { key: string; label: string }> {
  items: T[]
  value: string
  onChange(key: string): void
  ariaLabel: string
}

export function PickerList<T extends { key: string; label: string }>({
  items, value, onChange, ariaLabel,
}: PickerListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.max(0, items.findIndex((i) => i.key === value))
    // выбранный пункт — вторым видимым (в макете «2 апреля» на 451 при «1 апреля» на 380)
    el.scrollTop = Math.max(0, (idx - 1) * ROW_H)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <CustomScroll className="tr-al-dlist" scrollRef={scrollRef} track={107} ariaLabel={ariaLabel} role="listbox">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="option"
          aria-selected={value === it.key}
          className={`tr-al-dlist-item${value === it.key ? ' is-selected' : ''}`}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </CustomScroll>
  )
}

// -----------------------------------------------------------------------------
// Reusable UI-элементы
// -----------------------------------------------------------------------------

// Иконки — экспорты Figma (те же, что в модалке ученика 2522:2526): крестик Group 130, круг Ellipse 36 + стрелка Vector 42,
// лаймовый круг Ellipse 37 + тёмная стрелка Vector 43, красный круг Ellipse 40 + белая стрелка Vector 46, галочка Ellipse 35 + Vector 38.
export function CloseIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
}

export function ArrowDown() {
  return (
    <span className="tr-al-arrow" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tr-al-arrow-circle" src="/dashboard/ic-dd-circle.svg" alt="" width={35} height={36} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tr-al-arrow-glyph tr-al-arrow-glyph--down" src="/dashboard/ic-dd-arrow.svg" alt="" width={20} height={22.09} />
    </span>
  )
}

export function ArrowLeftLime() {
  return (
    <span className="tr-al-arrow" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tr-al-arrow-circle" src="/dashboard/ic-dd-circle-lime.svg" alt="" width={35} height={36} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tr-al-arrow-glyph tr-al-arrow-glyph--left" src="/dashboard/ic-dd-arrow-dark.svg" alt="" width={20} height={22.09} />
    </span>
  )
}

export function ArrowLeftRed() {
  return (
    <span className="tr-al-back-ic" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tr-al-back-ic-circle" src="/dashboard/ic-back-circle-red.svg" alt="" width={46} height={47} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tr-al-back-ic-glyph" src="/dashboard/ic-back-arrow-white.svg" alt="" width={25} height={22.09} />
    </span>
  )
}

export function CheckIcon() {
  return (
    <span className="tr-al-check-ic" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tr-al-check-ic-circle" src="/dashboard/ic-check-circle.svg" alt="" width={69} height={69} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tr-al-check-ic-mark" src="/dashboard/ic-check-mark.svg" alt="" width={35} height={29} />
    </span>
  )
}

// -----------------------------------------------------------------------------
// Основной компонент
// -----------------------------------------------------------------------------

export default function AddLessonModal({ students, onClose }: AddLessonModalProps) {
  const router = useRouter()

  const allDateOptions = useMemo(buildDateOptions, [])
  const allTimeOptions = useMemo(buildTimeOptions, [])

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
  const [successRemaining, setSuccessRemaining] = useState(59)

  const selectedStudent = students.find((s) => s.id === studentId) ?? null
  // Прошедшие слоты не показываем (как у ученика): для «сегодня» остаются только времена
  // позже текущего, а если на сегодня слотов не осталось — «сегодня» уходит из списка дат.
  const [nowMs] = useState(() => Date.now()) // фиксируем на время жизни модалки: чистый рендер
  const slotMs = (d: DateOption, t: TimeOption) => new Date(d.y, d.m, d.d, t.h, t.min, 0, 0).getTime()
  const dateOptions = allDateOptions.filter((d) => allTimeOptions.some((t) => slotMs(d, t) > nowMs))
  const selectedDate = dateKey ? dateOptions.find((d) => d.key === dateKey) ?? null : null
  const timeOptions = selectedDate ? allTimeOptions.filter((t) => slotMs(selectedDate, t) > nowMs) : allTimeOptions
  // Если выбранное время ушло в прошлое — берём первое доступное.
  const effectiveTimeKey = timeKey && timeOptions.some((t) => t.key === timeKey) ? timeKey : timeOptions[0]?.key ?? null
  const selectedTime = effectiveTimeKey ? timeOptions.find((t) => t.key === effectiveTimeKey) ?? null : null

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
    setSuccessRemaining(59)
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
  // Figma 2522:2756 «Выбор ученика» и 2522:696 «дата и время»: карточка 686×557 —
  // без кнопки «Создать» (возврат стрелкой в шапке пикера)
  const isPicking = state === 'picking-student' || state === 'picking-datetime'
  const isPickingStudent = state === 'picking-student'
  const timerLabel = `0:${String(successRemaining).padStart(2, '0')}`

  return (
    <div
      className="tr-add-lesson-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className={`tr-add-lesson${isSuccess ? ' tr-add-lesson--success' : ''}${isPicking ? ' tr-add-lesson--picking' : ''}`}
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
                {/* список 578×241 под шапкой; трек скролла 7×197 at (607,286), пункты 74 + линия 512 at x=75 */}
                <CustomScroll className="tr-al-plist" track={197} role="listbox" ariaLabel="Ученики">
                  {students.length === 0 ? (
                    <div className="tr-add-lesson-dropdown-empty">Учеников пока нет</div>
                  ) : (
                    students.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={studentId === s.id}
                        className={`tr-al-plist-item${studentId === s.id ? ' is-selected' : ''}`}
                        onClick={() => pickStudent(s.id)}
                      >
                        {s.name}
                      </button>
                    ))
                  )}
                </CustomScroll>
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
            {isPickingStudent ? null : state === 'picking-datetime' ? (
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
                  <PickerList
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
                  <PickerList
                    items={timeOptions}
                    value={effectiveTimeKey ?? ''}
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
            {isPicking ? null : (
            <div className="tr-add-lesson-footer">
              {/* при отправке — чёрная с лаймовым текстом, подпись не меняется */}
              <button
                type="button"
                className={`tr-add-lesson-btn${state === 'creating' ? ' busy' : ''}`}
                disabled={!canCreate || state === 'creating'}
                onClick={submit}
              >
                Создать
              </button>
              {(state === 'error' || (state === 'filled' && errorMsg)) && errorMsg && (
                <div className="tr-add-lesson-error" role="alert">
                  {errorMsg}
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
