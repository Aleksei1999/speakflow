"use client"

// ---------------------------------------------------------------------------
// EditLessonModal — редактирование даты/времени существующего урока.
// Та же модалка, что «Добавить урок» (Figma 2522:2506 / 2522:696 / 2522:2546):
// пилюля урока (read-only), пилюли «дата» и «время», списки-пикеры в двух
// колонках без кнопки, «Сохранить» 200×68. Переиспользует PickerList и
// иконки из AddLessonModal. Prefill: текущая дата/время урока.
// Сабмит → rescheduleLesson (server action), затем router.refresh() и закрытие.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  ArrowDown,
  ArrowLeftLime,
  CloseIcon,
  MONTHS_RU_GEN,
  PickerList,
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

type ModalState = 'idle' | 'picking' | 'saving'

// Диапазон дат для переноса: сегодня .. +60 дней (прошедшие слоты скрываем, как в «Добавить урок»).
function buildEditDateOptions(): DateOption[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const out: DateOption[] = []
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getTime() + i * 86_400_000)
    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const label = i === 0 ? 'сегодня' : i === 1 ? 'завтра' : `${day} ${MONTHS_RU_GEN[m]}`
    out.push({ key, label, y, m, d: day })
  }
  return out
}

export default function EditLessonModal({ lesson, onClose }: EditLessonModalProps) {
  const router = useRouter()

  const allDateOptions = useMemo(() => buildEditDateOptions(), [])
  const allTimeOptions = useMemo(() => buildTimeOptions(), [])

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

  const [state, setState] = useState<ModalState>('idle')
  const [dateKey, setDateKey] = useState<string>(initial.dateKey)
  const [timeKey, setTimeKey] = useState<string>(initial.timeKey)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Прошедшие слоты не показываем (как в «Добавить урок»): для «сегодня» — только времена позже текущего.
  const [nowMs] = useState(() => Date.now()) // фиксируем на время жизни модалки: чистый рендер
  const slotMs = (d: DateOption, t: TimeOption) => new Date(d.y, d.m, d.d, t.h, t.min, 0, 0).getTime()
  const dateOptions = allDateOptions.filter((d) => allTimeOptions.some((t) => slotMs(d, t) > nowMs))
  const selectedDate = dateOptions.find((d) => d.key === dateKey) ?? null
  const timeOptions = selectedDate ? allTimeOptions.filter((t) => slotMs(selectedDate, t) > nowMs) : allTimeOptions
  // Если исходное время урока не попадает в шаг 30 мин или ушло в прошлое — первое доступное.
  const effectiveTimeKey = timeOptions.some((t) => t.key === timeKey) ? timeKey : timeOptions[0]?.key ?? null
  const selectedTime = effectiveTimeKey ? timeOptions.find((t) => t.key === effectiveTimeKey) ?? null : null

  const changed = dateKey !== initial.dateKey || effectiveTimeKey !== initial.timeKey
  const canSave = !!selectedDate && !!selectedTime && changed && state !== 'saving'
  const isPicking = state === 'picking'

  // ESC + body scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (state === 'picking') {
        setState('idle')
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [state, onClose])

  function openPicker() {
    setErrorMsg(null)
    if (!selectedDate) setDateKey(dateOptions[0]?.key ?? '')
    setState('picking')
  }

  async function submit() {
    if (!selectedDate || !selectedTime) return
    setErrorMsg(null)
    setState('saving')
    const dt = new Date(selectedDate.y, selectedDate.m, selectedDate.d, selectedTime.h, selectedTime.min, 0, 0)
    try {
      const res = await rescheduleLesson({ lessonId: lesson.id, scheduledAt: dt.toISOString() })
      if (res.ok) {
        router.refresh()
        onClose()
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
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`tr-add-lesson${isPicking ? ' tr-add-lesson--picking' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tr-edit-lesson-title"
      >
        <button type="button" className="tr-add-lesson-close" aria-label="Закрыть" onClick={onClose}>
          <CloseIcon />
        </button>

        <h2 id="tr-edit-lesson-title" className="tr-add-lesson-title">
          Изменить урок
        </h2>

        {/* Лейбл урока — read-only, чтобы было понятно, что редактируем. */}
        <div className="tr-add-lesson-pill tr-add-lesson-pill--full tr-add-lesson-pill--static">
          <span className="tr-add-lesson-pill-value">{lesson.label}</span>
        </div>

        {/* DATE + TIME: как в 2522:696 — обе колонки списками, «Сохранить» скрыта */}
        {isPicking ? (
          <div className="tr-add-lesson-row tr-add-lesson-row--picker">
            <div className="tr-add-lesson-half tr-add-lesson-half--picker">
              <div className="tr-add-lesson-picker-head">
                <span className="tr-add-lesson-pill-placeholder">дата</span>
                <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть выбор даты" onClick={() => setState('idle')}>
                  <ArrowLeftLime />
                </button>
              </div>
              <PickerList items={dateOptions} value={dateKey} onChange={setDateKey} ariaLabel="Дата урока" />
            </div>
            <div className="tr-add-lesson-half tr-add-lesson-half--picker">
              <div className="tr-add-lesson-picker-head">
                <span className="tr-add-lesson-pill-placeholder">время</span>
                <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть выбор времени" onClick={() => setState('idle')}>
                  <ArrowLeftLime />
                </button>
              </div>
              <PickerList items={timeOptions} value={effectiveTimeKey ?? ''} onChange={setTimeKey} ariaLabel="Время урока" />
            </div>
          </div>
        ) : (
          <div className="tr-add-lesson-row">
            <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--half" onClick={openPicker}>
              {selectedDate ? (
                <span className="tr-add-lesson-pill-value">{selectedDate.label}</span>
              ) : (
                <span className="tr-add-lesson-pill-placeholder">дата</span>
              )}
              <ArrowDown />
            </button>
            <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--half" onClick={openPicker}>
              {selectedTime ? (
                <span className="tr-add-lesson-pill-value">{selectedTime.label}</span>
              ) : (
                <span className="tr-add-lesson-pill-placeholder">время</span>
              )}
              <ArrowDown />
            </button>
          </div>
        )}

        {isPicking ? null : (
          <div className="tr-add-lesson-footer">
            {/* busy: чёрная с лаймовым текстом, подпись не меняется */}
            <button
              type="button"
              className={`tr-add-lesson-btn${state === 'saving' ? ' busy' : ''}`}
              onClick={submit}
              disabled={!canSave}
            >
              Сохранить
            </button>
            {errorMsg && (
              <div className="tr-add-lesson-error" role="alert">
                {errorMsg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
