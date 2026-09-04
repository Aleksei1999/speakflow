"use client"

// ---------------------------------------------------------------------------
// AdminAddLectureModal — «Другое событие» у админа.
// UI полностью в стиле AddLessonModal (те же .tr-add-lesson-* классы):
//   • Название, ФИО спикера — text-input pill'ы
//   • Дата + время — WheelPicker'ы (сегодня жирным)
//   • Описание — textarea
// Отправляет POST /api/lectures (multipart), затем router.refresh().
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  buildDateOptions,
  buildTimeOptions,
  ArrowDown,
  ArrowLeftLime,
  CloseIcon,
  WheelPicker,
} from '@/app/(teacher-full)/teacher/AddLessonModal'

interface Props {
  onClose: () => void
}

type State = 'empty' | 'picking-datetime' | 'filled' | 'creating' | 'success' | 'error'

export default function AdminAddLectureModal({ onClose }: Props) {
  const router = useRouter()
  const dateOptions = useMemo(buildDateOptions, [])
  const timeOptions = useMemo(buildTimeOptions, [])

  const [state, setState] = useState<State>('empty')
  const [title, setTitle] = useState('')
  const [host, setHost] = useState('')
  const [desc, setDesc] = useState('')
  const [dateKey, setDateKey] = useState<string | null>(null)
  const [timeKey, setTimeKey] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successRemaining, setSuccessRemaining] = useState(60)

  const selectedDate = dateKey ? dateOptions.find((d) => d.key === dateKey) ?? null : null
  const selectedTime = timeKey ? timeOptions.find((t) => t.key === timeKey) ?? null : null
  const canCreate = title.trim().length > 0 && !!selectedDate && !!selectedTime

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (state === 'picking-datetime') setState(canCreate ? 'filled' : 'empty')
      else handleClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, canCreate])

  useEffect(() => {
    if (state !== 'success') return
    setSuccessRemaining(60)
    const id = window.setInterval(() => {
      setSuccessRemaining((r) => (r <= 1 ? (window.clearInterval(id), 0) : r - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [state])

  useEffect(() => {
    if (['creating', 'success', 'error', 'picking-datetime'].includes(state)) return
    setState(canCreate ? 'filled' : 'empty')
  }, [canCreate, state])

  function handleClose() {
    if (state === 'success') router.refresh()
    onClose()
  }

  async function submit() {
    if (!canCreate || !selectedDate || !selectedTime) return
    setErrorMsg(null)
    setState('creating')
    const dt = new Date(selectedDate.y, selectedDate.m, selectedDate.d, selectedTime.h, selectedTime.min, 0, 0)
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      if (host.trim()) fd.append('host_name', host.trim())
      if (desc.trim()) fd.append('description', desc.trim())
      fd.append('scheduled_at', dt.toISOString())
      fd.append('slot', 'small')
      fd.append('duration_minutes', '60')
      if (price) fd.append('price', price)
      const res = await fetch('/api/lectures', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErrorMsg(j.error || 'Не удалось создать лекцию'); setState('error'); return }
      setState('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось создать лекцию')
      setState('error')
    }
  }

  const isSuccess = state === 'success'
  const timerLabel = `0:${String(successRemaining).padStart(2, '0')}`

  return (
    <div className="tr"><div className="tr-add-lesson-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div className={`tr-add-lesson${isSuccess ? ' tr-add-lesson--success' : ''}`} role="dialog" aria-modal="true">
        {isSuccess && <div className="tr-add-lesson-timer">{timerLabel}</div>}
        <button type="button" className="tr-add-lesson-close" aria-label="Закрыть" onClick={handleClose}>
          <CloseIcon />
        </button>

        {isSuccess ? (
          <>
            <div className="tr-add-lesson-success-title">В календарь<br />добавлено событие</div>
            <div className="tr-add-lesson-success-check">
              <svg viewBox="0 0 69 69" width="69" height="69" fill="none" aria-hidden>
                <circle cx="34.5" cy="34.5" r="34.5" fill="#1E1E1E" />
                <path d="M20 35l10 10 20-22" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="tr-add-lesson-success-name">{title}</div>
            <div className="tr-add-lesson-success-when">{selectedDate?.label}, {selectedTime?.label}</div>
          </>
        ) : (
          <>
            <h2 className="tr-add-lesson-title">Добавить новое событие</h2>

            {/* Название */}
            <div className="tr-add-lesson-pill tr-add-lesson-pill--full"
              style={{ padding: 0, background: '#FFF' }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="введите название события"
                style={{
                  width: '100%', height: '100%', border: 0, outline: 0, background: 'transparent',
                  padding: '0 40px', textAlign: 'center',
                  fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 24,
                  letterSpacing: '-1.2px', color: '#1E1E1E',
                }}
              />
            </div>

            {/* ФИО организатора */}
            <div className="tr-add-lesson-pill tr-add-lesson-pill--full"
              style={{ padding: 0, background: '#FFF' }}>
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="введите ФИО организатора"
                style={{
                  width: '100%', height: '100%', border: 0, outline: 0, background: 'transparent',
                  padding: '0 40px', textAlign: 'center',
                  fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 24,
                  letterSpacing: '-1.2px', color: '#1E1E1E',
                }}
              />
            </div>

            {/* Дата + Время */}
            {state === 'picking-datetime' ? (
              <div className="tr-add-lesson-row tr-add-lesson-row--picker">
                <div className="tr-add-lesson-half tr-add-lesson-half--picker">
                  <div className="tr-add-lesson-picker-head">
                    <span className="tr-add-lesson-pill-placeholder">дата</span>
                    <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть"
                      onClick={() => setState(canCreate ? 'filled' : 'empty')}>
                      <ArrowLeftLime />
                    </button>
                  </div>
                  <WheelPicker items={dateOptions} value={dateKey ?? dateOptions[0].key} onChange={setDateKey} ariaLabel="Дата" />
                </div>
                <div className="tr-add-lesson-half tr-add-lesson-half--picker">
                  <div className="tr-add-lesson-picker-head">
                    <span className="tr-add-lesson-pill-placeholder">время</span>
                    <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть"
                      onClick={() => setState(canCreate ? 'filled' : 'empty')}>
                      <ArrowLeftLime />
                    </button>
                  </div>
                  <WheelPicker items={timeOptions} value={timeKey ?? timeOptions[0].key} onChange={setTimeKey} ariaLabel="Время" />
                </div>
              </div>
            ) : (
              <div className="tr-add-lesson-row">
                <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--half"
                  onClick={() => {
                    if (!dateKey) setDateKey(dateOptions[0]?.key ?? null)
                    if (!timeKey) setTimeKey(timeOptions[0]?.key ?? null)
                    setState('picking-datetime')
                  }}>
                  {selectedDate
                    ? <span className="tr-add-lesson-pill-value">{selectedDate.label}</span>
                    : <span className="tr-add-lesson-pill-placeholder">дата</span>}
                  <ArrowDown />
                </button>
                <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--half"
                  onClick={() => {
                    if (!dateKey) setDateKey(dateOptions[0]?.key ?? null)
                    if (!timeKey) setTimeKey(timeOptions[0]?.key ?? null)
                    setState('picking-datetime')
                  }}>
                  {selectedTime
                    ? <span className="tr-add-lesson-pill-value">{selectedTime.label}</span>
                    : <span className="tr-add-lesson-pill-placeholder">время</span>}
                  <ArrowDown />
                </button>
              </div>
            )}

            {/* Описание */}
            <div style={{
              marginTop: 24, marginBottom: 12,
              textAlign: 'center', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 32,
              letterSpacing: '-1.6px', color: '#1E1E1E',
            }}>
              Опишите событие
            </div>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, 500))}
              maxLength={500}
              style={{
                display: 'block', width: '100%', height: 139, borderRadius: 29.5,
                background: '#FFF', border: 0, outline: 0,
                padding: '18px 40px', textAlign: 'center', resize: 'none',
                fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 20,
                letterSpacing: '-1.2px', color: '#1E1E1E', lineHeight: 1.2,
              }}
            />
            {/* Стоимость участия (Figma 2208-342 / 2208-517) */}
            <div className="tr-add-lesson-pill tr-add-lesson-pill--full"
              style={{ padding: 0, background: '#FFF', marginTop: 16 }}>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D+/g, '').slice(0, 8))}
                placeholder="введите стоимость участия"
                inputMode="numeric"
                style={{
                  width: '100%', height: '100%', border: 0, outline: 0, background: 'transparent',
                  padding: '0 40px', textAlign: 'center',
                  fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 24,
                  letterSpacing: '-1.2px', color: '#1E1E1E',
                }}
              />
            </div>
            <div style={{
              textAlign: 'right', marginTop: 6, marginRight: 4,
              fontFamily: 'Inter, sans-serif', fontSize: 14,
              color: desc.length >= 500 ? '#CC3A3A' : 'rgba(30,30,30,0.7)',
            }}>{desc.length}/500</div>

            <div className="tr-add-lesson-footer">
              <button type="button" className="tr-add-lesson-btn"
                disabled={!canCreate || state === 'creating'} onClick={submit}>
                {state === 'creating' ? 'Создаём…' : 'Создать'}
              </button>
              {errorMsg && <div className="tr-add-lesson-error" role="alert">{errorMsg}</div>}
            </div>
          </>
        )}
      </div>
    </div></div>
  )
}
