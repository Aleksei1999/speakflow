"use client"

// ---------------------------------------------------------------------------
// EditLessonModal — редактирование даты/времени существующего урока.
// Переиспользует WheelPicker + helpers из AddLessonModal (визуальный паритет
// с «Добавить новый урок»). Prefill: текущая дата/время урока.
// Сабмит → rescheduleLesson (server action). Success — короткое уведомление
// и router.refresh(); ошибка — inline.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  ArrowDown,
  ArrowLeftLime,
  CloseIcon,
  MONTHS_RU_GEN,
  WheelPicker,
  buildTimeOptions,
  type DateOption,
  type TimeOption,
} from './AddLessonModal'
import { rescheduleLesson } from './lesson-actions'

interface EditLessonModalProps {
  lesson: {
    /** UUID урока (без "lesson:" префикса). */
    id: string
    label: string
    /** Текущий scheduled_at в ISO — для предзаполнения пикеров. */
    scheduledAtISO: string
  }
  onClose: () => void
}

type ModalState =
  | 'idle'
  | 'picking-date'
  | 'picking-time'
  | 'saving'
  | 'success'

// Диапазон дат для редактирования: -1 день (на случай если сегодня утром
// правят вчерашнее по каким-то причинам) .. +60 дней. Прошлые лимитируем,
// иначе список необъятный.
function buildEditDateOptions(): DateOption[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const out: DateOption[] = []
  for (let i = -1; i < 60; i++) {
    const d = new Date(now.getTime() + i * 86_400_000)
    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    let label: string
    if (i === 0) label = 'сегодня'
    else if (i === -1) label = 'вчера'
    else if (i === 1) label = 'завтра'
    else label = `${day} ${MONTHS_RU_GEN[m]}`
    out.push({ key, label, y, m, d: day })
  }
  return out
}

export default function EditLessonModal({ lesson, onClose }: EditLessonModalProps) {
  const router = useRouter()

  const dateOptions = useMemo(buildEditDateOptions, [])
  const timeOptions = useMemo(buildTimeOptions, [])

  // Предзаполняем текущим временем урока (в локальной таймзоне).
  const initial = useMemo(() => {
    const d = new Date(lesson.scheduledAtISO)
    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const h = d.getHours()
    const min = d.getMinutes()
    return {
      dateKey: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      timeKey: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    }
  }, [lesson.scheduledAtISO])

  // Если исходное время урока не попадает в шаг 30 мин (например 10:15), пикер
  // не найдёт этот ключ — сфолбэчимся на ближайший доступный.
  const initialDateKey = dateOptions.some((d) => d.key === initial.dateKey)
    ? initial.dateKey
    : dateOptions[0]!.key
  const initialTimeKey = timeOptions.some((t) => t.key === initial.timeKey)
    ? initial.timeKey
    : timeOptions[0]!.key

  const [state, setState] = useState<ModalState>('idle')
  const [dateKey, setDateKey] = useState<string>(initialDateKey)
  const [timeKey, setTimeKey] = useState<string>(initialTimeKey)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const selectedDate = dateOptions.find((d) => d.key === dateKey) ?? null
  const selectedTime = timeOptions.find((t) => t.key === timeKey) ?? null

  const changed =
    dateKey !== initial.dateKey || timeKey !== initial.timeKey
  const canSave = !!selectedDate && !!selectedTime && changed && state !== 'saving'

  // ESC + body scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (state === 'picking-date' || state === 'picking-time') {
        setState('idle')
        return
      }
      handleClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function handleClose() {
    if (state === 'success') router.refresh()
    onClose()
  }

  async function submit() {
    if (!selectedDate || !selectedTime) return
    setErrorMsg(null)
    setState('saving')
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
      const res = await rescheduleLesson({
        lessonId: lesson.id,
        scheduledAt: dt.toISOString(),
      })
      if (res.ok) {
        setState('success')
        // Даём пользователю увидеть success, потом закрываем и рефрешим.
        setTimeout(() => {
          router.refresh()
          onClose()
        }, 900)
      } else {
        setErrorMsg(res.error || 'Не удалось изменить урок')
        setState('idle')
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось изменить урок')
      setState('idle')
    }
  }

  return (
    <div
      className="tr-add-lesson-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className="tr-add-lesson"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tr-edit-lesson-title"
      >
        <button
          type="button"
          className="tr-add-lesson-close"
          aria-label="Закрыть"
          onClick={handleClose}
        >
          <CloseIcon />
        </button>

        <h2 id="tr-edit-lesson-title" className="tr-add-lesson-title">
          Изменить урок
        </h2>

        {/* Лейбл урока — read-only, чтобы пользователь понимал что редактирует. */}
        <div className="tr-add-lesson-pill tr-add-lesson-pill--full" aria-disabled>
          <span className="tr-add-lesson-pill-value">{lesson.label}</span>
        </div>

        {/* DATE + TIME */}
        {state === 'picking-date' ? (
          <div className="tr-add-lesson-row tr-add-lesson-row--picker">
            <div className="tr-add-lesson-half tr-add-lesson-half--picker">
              <div className="tr-add-lesson-picker-head">
                <span className="tr-add-lesson-pill-placeholder">дата</span>
                <button
                  type="button"
                  className="tr-add-lesson-picker-back"
                  aria-label="Свернуть выбор даты"
                  onClick={() => setState('idle')}
                >
                  <ArrowLeftLime />
                </button>
              </div>
              <WheelPicker
                items={dateOptions}
                value={dateKey}
                onChange={(k) => setDateKey(k)}
                ariaLabel="Дата урока"
              />
            </div>
            <button
              type="button"
              className="tr-add-lesson-pill tr-add-lesson-pill--half"
              onClick={() => setState('picking-time')}
            >
              <span className="tr-add-lesson-pill-value">{selectedTime?.label ?? '--:--'}</span>
              <ArrowDown />
            </button>
          </div>
        ) : state === 'picking-time' ? (
          <div className="tr-add-lesson-row tr-add-lesson-row--picker">
            <button
              type="button"
              className="tr-add-lesson-pill tr-add-lesson-pill--half"
              onClick={() => setState('picking-date')}
            >
              <span className="tr-add-lesson-pill-value">{selectedDate?.label ?? '--'}</span>
              <ArrowDown />
            </button>
            <div className="tr-add-lesson-half tr-add-lesson-half--picker">
              <div className="tr-add-lesson-picker-head">
                <span className="tr-add-lesson-pill-placeholder">время</span>
                <button
                  type="button"
                  className="tr-add-lesson-picker-back"
                  aria-label="Свернуть выбор времени"
                  onClick={() => setState('idle')}
                >
                  <ArrowLeftLime />
                </button>
              </div>
              <WheelPicker
                items={timeOptions}
                value={timeKey}
                onChange={(k) => setTimeKey(k)}
                ariaLabel="Время урока"
              />
            </div>
          </div>
        ) : (
          <div className="tr-add-lesson-row">
            <button
              type="button"
              className="tr-add-lesson-pill tr-add-lesson-pill--half"
              onClick={() => setState('picking-date')}
            >
              <span className="tr-add-lesson-pill-value">{selectedDate?.label ?? '--'}</span>
              <ArrowDown />
            </button>
            <button
              type="button"
              className="tr-add-lesson-pill tr-add-lesson-pill--half"
              onClick={() => setState('picking-time')}
            >
              <span className="tr-add-lesson-pill-value">{selectedTime?.label ?? '--:--'}</span>
              <ArrowDown />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="tr-add-lesson-error" role="alert">
            {errorMsg}
          </div>
        )}

        {state === 'success' ? (
          <div className="tr-add-lesson-footer">
            <div className="tr-add-lesson-success-when" style={{ textAlign: 'center', color: '#2e5b1e' }}>
              Время урока обновлено
            </div>
          </div>
        ) : (
          <div className="tr-add-lesson-footer">
            <button
              type="button"
              className="tr-add-lesson-btn"
              onClick={submit}
              disabled={!canSave}
            >
              {state === 'saving' ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
