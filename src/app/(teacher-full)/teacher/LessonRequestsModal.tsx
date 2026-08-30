"use client"

// ---------------------------------------------------------------------------
// LessonRequestsModal — очередь входящих запросов на урок.
//
// Дизайн: Figma YSwlSQF1n6QIpGTOohlMOd
//   • 2208:2435 — карточка запроса («Кристина Кирова запрашивает урок …»
//     + кнопки «Нет / Чат / Да»)
//   • 2208:2686 — success («В ваш календарь добавлен урок»)
//
// Открывается кнопкой «запрос на урок» из TeacherRawDashboard. Показывает
// carousel из pending-запросов: свайп/стрелки перелистывают. Кнопки:
//   • «Да»  → acceptLessonRequest → success-экран (checkmark + ФИО+дата)
//   • «Нет» → rejectLessonRequest → удаляет карточку из списка
//   • «Чат» → пока просто закрывает модалку и подсвечивает студента в чате
//     (TODO: сфокусировать чат — см. handleChat).
//
// Локальный state — оптимистично удаляем обработанную карточку из списка.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  acceptLessonRequest,
  rejectLessonRequest,
  type LessonRequestRow,
} from './request-actions'

interface LessonRequestsModalProps {
  requests: LessonRequestRow[]
  onClose: () => void
  onOpenChat?: (studentId: string) => void
}

// -----------------------------------------------------------------------------
// helpers: русская форма даты «2 апреля» + время «8:30».
// Не тащим intl-пакеты — Intl хватает.
// -----------------------------------------------------------------------------

const MONTHS_RU_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS_RU_GEN[d.getMonth()]}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h}:${String(m).padStart(2, '0')}`
}

// -----------------------------------------------------------------------------
// SVG-и (в стиле AddLessonModal — inline, без сторонних иконок).
// -----------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
      <path
        d="M1 1l12 12M13 1L1 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 69 69" width="69" height="69" fill="none" aria-hidden>
      <circle cx="34.5" cy="34.5" r="34.5" fill="#1E1E1E" />
      <path
        d="M20 35l10 10 20-22"
        stroke="#FFFFFF"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ArrowLeftRed() {
  return (
    <svg viewBox="0 0 46 47" width="46" height="47" fill="none" aria-hidden>
      <ellipse cx="23" cy="23.5" rx="23" ry="23.5" fill="#CC3A3A" />
      <path
        d="M32 23.5H14m0 0l7-7m-7 7l7 7"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// -----------------------------------------------------------------------------
// Компонент
// -----------------------------------------------------------------------------

type ModalState = 'list' | 'processing' | 'success' | 'empty'

interface AcceptedState {
  studentName: string
  dateLabel: string
  timeLabel: string
}

export default function LessonRequestsModal({
  requests,
  onClose,
  onOpenChat,
}: LessonRequestsModalProps) {
  const router = useRouter()

  // Локальная очередь — оптимистично убираем обработанные.
  const [queue, setQueue] = useState<LessonRequestRow[]>(requests)
  const [index, setIndex] = useState(0)
  const [state, setState] = useState<ModalState>(
    requests.length === 0 ? 'empty' : 'list',
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<AcceptedState | null>(null)
  const [dirty, setDirty] = useState(false)

  const current = queue[index] ?? null

  // Успех-таймер (60→0). Просто UI, авто-закрытия нет.
  const [successRemaining, setSuccessRemaining] = useState(60)
  useEffect(() => {
    if (state !== 'success') return
    setSuccessRemaining(60)
    const id = window.setInterval(() => {
      setSuccessRemaining((r) => (r <= 1 ? 0 : r - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [state])

  // ESC + scroll lock. Refresh только когда закрываемся с dirty=true.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleClose() {
    if (dirty) router.refresh()
    onClose()
  }

  // Продвижение по очереди после accept/reject.
  function advance() {
    setQueue((prev) => {
      const next = prev.filter((_, i) => i !== index)
      // Если удалили последний — держим индекс на новом последнем.
      setIndex((idx) => Math.min(idx, Math.max(0, next.length - 1)))
      if (next.length === 0) setState('empty')
      return next
    })
  }

  // ---- Handlers ----

  async function handleAccept() {
    if (!current) return
    setErrorMsg(null)
    setState('processing')
    try {
      const res = await acceptLessonRequest({ requestId: current.id })
      if (res.ok) {
        setDirty(true)
        setAccepted({
          studentName: current.studentName,
          dateLabel: formatDate(current.requestedAt),
          timeLabel: formatTime(current.requestedAt),
        })
        // Убираем из очереди «в фоне» — success-экран покажет своё.
        setQueue((prev) => prev.filter((_, i) => i !== index))
        setIndex((idx) =>
          Math.min(idx, Math.max(0, queue.length - 2)),
        )
        setState('success')
      } else {
        setErrorMsg(res.error || 'Не удалось принять запрос')
        setState('list')
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось принять запрос')
      setState('list')
    }
  }

  async function handleReject() {
    if (!current) return
    setErrorMsg(null)
    setState('processing')
    try {
      const res = await rejectLessonRequest({ requestId: current.id })
      if (res.ok) {
        setDirty(true)
        advance()
        setState((s) => (s === 'processing' ? 'list' : s))
      } else {
        setErrorMsg(res.error || 'Не удалось отклонить')
        setState('list')
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось отклонить')
      setState('list')
    }
  }

  function handleChat() {
    if (!current) return
    // Пробрасываем наверх; сам dashboard откроет чат с этим студентом.
    onOpenChat?.(current.studentId)
    handleClose()
  }

  function handleBackFromSuccess() {
    setAccepted(null)
    if (queue.length === 0) {
      setState('empty')
    } else {
      setState('list')
    }
  }

  // ---- UI ----

  const isSuccess = state === 'success'
  const isEmpty = state === 'empty' || (state !== 'success' && !current)
  const timerLabel = `0:${String(successRemaining).padStart(2, '0')}`

  const dateLabel = useMemo(
    () => (current ? formatDate(current.requestedAt) : ''),
    [current],
  )
  const timeLabel = useMemo(
    () => (current ? formatTime(current.requestedAt) : ''),
    [current],
  )

  return (
    <div
      className="tr-lr-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className={`tr-lr-modal${isSuccess ? ' tr-lr-modal--success' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tr-lr-title"
      >
        {isSuccess && (
          <div className="tr-lr-timer" aria-live="polite">
            {timerLabel}
          </div>
        )}

        <button
          type="button"
          className="tr-lr-close"
          aria-label="Закрыть"
          onClick={handleClose}
        >
          <CloseIcon />
        </button>

        {isSuccess && accepted ? (
          <>
            <div className="tr-lr-success-title" id="tr-lr-title">
              В ваш календарь<br />добавлен урок
            </div>
            <div className="tr-lr-success-check">
              <CheckIcon />
            </div>
            <div className="tr-lr-success-name">{accepted.studentName}</div>
            <div className="tr-lr-success-when">
              {accepted.dateLabel}, {accepted.timeLabel}
            </div>
            <button
              type="button"
              className="tr-lr-success-back"
              aria-label="Вернуться к списку"
              onClick={handleBackFromSuccess}
            >
              <ArrowLeftRed />
            </button>
          </>
        ) : isEmpty ? (
          <>
            <h2 id="tr-lr-title" className="tr-lr-empty-title">
              Новых запросов нет
            </h2>
            <p className="tr-lr-empty-sub">
              Когда ученик отправит запрос на урок — он появится здесь.
            </p>
          </>
        ) : current ? (
          <>
            {queue.length > 1 && (
              <div className="tr-lr-counter" aria-live="polite">
                {index + 1} / {queue.length}
              </div>
            )}
            <p id="tr-lr-title" className="tr-lr-headline">
              <b>{current.studentName}</b>
              {' запрашивает урок '}
              <b>{dateLabel}</b>
              {' в '}
              <b>{timeLabel}</b>
            </p>

            <div className="tr-lr-duration">
              <span className="tr-lr-duration-label">Длительности урока:</span>
              <br />
              <b>1 час 30 минут</b>
            </div>

            {current.message && (
              <div className="tr-lr-message" title="Сообщение от ученика">
                {current.message}
              </div>
            )}

            <div className="tr-lr-question">Принимаете урок?</div>

            <div className="tr-lr-actions">
              <button
                type="button"
                className="tr-lr-btn tr-lr-btn--outline"
                disabled={state === 'processing'}
                onClick={handleReject}
              >
                Нет
              </button>
              <button
                type="button"
                className="tr-lr-btn tr-lr-btn--red"
                disabled={state === 'processing'}
                onClick={handleChat}
              >
                Чат
              </button>
              <button
                type="button"
                className="tr-lr-btn tr-lr-btn--outline"
                disabled={state === 'processing'}
                onClick={handleAccept}
              >
                Да
              </button>
            </div>

            {errorMsg && (
              <div className="tr-lr-error" role="alert">
                {errorMsg}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
