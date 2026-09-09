"use client"

// ---------------------------------------------------------------------------
// AdminAddLectureModal — «Другое событие» у админа.
// UI полностью в стиле AddLessonModal (те же .tr-add-lesson-* классы):
//   • Название, ФИО спикера — text-input pill'ы
//   • Организатор, тип, дата + время — списки PickerList (Figma 2522:504: 217 = шапка 68 + список 149)
//   • Описание — textarea
// Отправляет POST /api/lectures (multipart), затем router.refresh().
// ---------------------------------------------------------------------------

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteLecture } from './admin-actions'
import {
  buildDateOptions,
  buildTimeOptions,
  ArrowDown,
  ArrowLeftLime,
  ArrowLeftRed,
  CheckIcon,
  CloseIcon,
  PickerList,
} from '@/app/(teacher-full)/teacher/AddLessonModal'

interface Props {
  onClose: () => void
}

type State = 'empty' | 'picking-datetime' | 'picking-tag' | 'picking-host' | 'filled' | 'creating' | 'success' | 'error'

// Категории событий (Figma 2522:10819 «Тип события»). Значение сохраняем в
// lectures.tag и рендерим как пилюлю на карточке лектория у ученика.
const TAG_OPTIONS = [
  { key: 'Marketing', label: 'Marketing' },
  { key: 'CV', label: 'CV' },
  { key: 'Travel', label: 'Travel' },
  { key: 'Tecnolodgy', label: 'Tecnolodgy' },
] as const

export default function AdminAddLectureModal({ onClose }: Props) {
  const router = useRouter()
  const dateOptions = useMemo(buildDateOptions, [])
  const timeOptions = useMemo(buildTimeOptions, [])

  const [state, setState] = useState<State>('empty')
  const [title, setTitle] = useState('')
  // host — имя выбранного преподавателя (сохраняется в lectures.host_name).
  const [host, setHost] = useState('')
  const [teachers, setTeachers] = useState<Array<{ key: string; label: string }>>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/booking/teachers', { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        if (cancelled) return
        const rows = ((j.teachers ?? []) as any[])
          .map((t) => ({ key: String(t.name ?? '').trim(), label: String(t.name ?? '').trim() }))
          .filter((t) => t.key.length > 0)
        setTeachers(rows)
      } catch (e) { console.error('[lecture modal] teachers', e) }
    })()
    return () => { cancelled = true }
  }, [])
  const [desc, setDesc] = useState('')
  // Figma 2522:560: короткое описание стоит по центру поля 139, длинное (2522:504) — от верха с отступом 12.
  const descRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = descRef.current
    if (!el) return
    el.style.paddingTop = '0px'
    el.style.paddingBottom = '0px'
    el.style.height = '0px' // scrollHeight при нулевой высоте = высота контента
    const content = el.scrollHeight
    el.style.height = ''
    const pad = Math.max(12, (139 - content) / 2)
    el.style.paddingTop = `${pad}px`
    el.style.paddingBottom = '12px'
  }, [desc, state])
  const [dateKey, setDateKey] = useState<string | null>(null)
  const [timeKey, setTimeKey] = useState<string | null>(null)
  const [tagKey, setTagKey] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successRemaining, setSuccessRemaining] = useState(59)
  // id созданной лекции — для отмены кнопкой ← в окне успеха (пока идёт таймер 0:59)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [reverting, setReverting] = useState(false)

  const selectedDate = dateKey ? dateOptions.find((d) => d.key === dateKey) ?? null : null
  const selectedTime = timeKey ? timeOptions.find((t) => t.key === timeKey) ?? null : null
  const canCreate = title.trim().length > 0 && !!selectedDate && !!selectedTime

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (state === 'picking-datetime' || state === 'picking-tag' || state === 'picking-host') setState(canCreate ? 'filled' : 'empty')
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
    setSuccessRemaining(59)
    const id = window.setInterval(() => {
      setSuccessRemaining((r) => (r <= 1 ? (window.clearInterval(id), 0) : r - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [state])

  useEffect(() => {
    if (['creating', 'success', 'error', 'picking-datetime', 'picking-tag', 'picking-host'].includes(state)) return
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
      if (tagKey) fd.append('tag', tagKey)
      if (price) fd.append('price', price)
      const res = await fetch('/api/lectures', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErrorMsg(j.error || 'Не удалось создать лекцию'); setState('error'); return }
      setCreatedId(typeof j.id === 'string' ? j.id : (j.lecture?.id ?? null))
      setState('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось создать лекцию')
      setState('error')
    }
  }

  async function revertToFilled() {
    if (!createdId || successRemaining <= 0 || reverting) return
    setReverting(true)
    try {
      const r = await deleteLecture({ lectureId: createdId })
      if (!r.ok) setErrorMsg(r.error)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось отменить событие')
    } finally {
      setCreatedId(null)
      setReverting(false)
      setState('filled')
    }
  }

  const isSuccess = state === 'success'
  const timerLabel = `0:${String(successRemaining).padStart(2, '0')}`

  return (
    <div className="tr"><div className="tr-add-lesson-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div className={`tr-add-lesson ad-lecture-modal${isSuccess ? ' tr-add-lesson--success' : ''}`} role="dialog" aria-modal="true">
        {isSuccess && <div className="tr-add-lesson-timer">{timerLabel}</div>}
        <button type="button" className="tr-add-lesson-close" aria-label="Закрыть" onClick={handleClose}>
          <CloseIcon />
        </button>

        {isSuccess ? (
          <>
            {/* Figma 2522:2603 «Событие добавлено в календарь»: 503×500, заголовок 86, галочка 189, подпись 275, имя 295, дата 339, ← 412 */}
            <div className="tr-add-lesson-success-title">В календарь<br />добавлено событие</div>
            <div className="tr-add-lesson-success-check">
              <CheckIcon />
            </div>
            <div className="ad-lecture-success-sub">{tagKey ? `${tagKey} - ${title}` : title}</div>
            <div className="tr-add-lesson-success-name">{host || title}</div>
            <div className="tr-add-lesson-success-when">{selectedDate?.label}, {selectedTime?.label}</div>
            <button
              type="button"
              className="tr-add-lesson-success-back"
              aria-label={successRemaining > 0 ? 'Отменить и вернуться к редактированию' : 'Отмена больше недоступна — таймер истёк'}
              onClick={revertToFilled}
              disabled={successRemaining <= 0 || reverting || !createdId}
              style={successRemaining <= 0 || !createdId ? { opacity: 0.4, cursor: 'default' } : undefined}
            >
              <ArrowLeftRed />
            </button>
          </>
        ) : (
          <>
            <h2 className="tr-add-lesson-title">Добавить новое событие</h2>

            {/* Название */}
            <div className="tr-add-lesson-pill tr-add-lesson-pill--full tr-add-lesson-pill--input">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="введите название события"
              />
            </div>

            {/* Преподаватель — picker из существующих учителей (сохраняем имя
                в lectures.host_name, как раньше). */}
            {state === 'picking-host' ? (
              /* Figma 2522:504: открытый выбор — 578×217 (шапка 68 + список 149, ряды 72+1, трек 107) */
              <div className="tr-add-lesson-half tr-add-lesson-half--picker ad-lecture-picker--full">
                <div className="tr-add-lesson-picker-head">
                  {host
                    ? <span className="tr-add-lesson-pill-value">{host}</span>
                    : <span className="tr-add-lesson-pill-placeholder">выберите организатора</span>}
                  <button
                    type="button"
                    className="tr-add-lesson-picker-back"
                    aria-label="Свернуть"
                    onClick={() => setState(canCreate ? 'filled' : 'empty')}
                  >
                    <ArrowLeftLime />
                  </button>
                </div>
                {teachers.length > 0 ? (
                  <PickerList
                    items={teachers}
                    value={host}
                    onChange={(k) => { setHost(k); setState(canCreate ? 'filled' : 'empty') }}
                    ariaLabel="Организатор"
                  />
                ) : (
                  <div className="ad-lecture-picker-empty">Загружаем список преподавателей…</div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="tr-add-lesson-pill tr-add-lesson-pill--full"
                onClick={() => setState('picking-host')}
              >
                {host
                  ? <span className="tr-add-lesson-pill-value">{host}</span>
                  : <span className="tr-add-lesson-pill-placeholder">выберите организатора</span>}
                <ArrowDown />
              </button>
            )}

            {/* Тип события (Figma 2522:10819) — WheelPicker с фиксированным
                списком категорий, сохраняется в lectures.tag. */}
            {state === 'picking-tag' ? (
              <div className="tr-add-lesson-half tr-add-lesson-half--picker ad-lecture-picker--full">
                <div className="tr-add-lesson-picker-head">
                  {tagKey
                    ? <span className="tr-add-lesson-pill-value">{tagKey}</span>
                    : <span className="tr-add-lesson-pill-placeholder">Тип события</span>}
                  <button
                    type="button"
                    className="tr-add-lesson-picker-back"
                    aria-label="Свернуть"
                    onClick={() => setState(canCreate ? 'filled' : 'empty')}
                  >
                    <ArrowLeftLime />
                  </button>
                </div>
                <PickerList
                  items={TAG_OPTIONS as unknown as { key: string; label: string }[]}
                  value={tagKey ?? ''}
                  onChange={(k) => { setTagKey(k); setState(canCreate ? 'filled' : 'empty') }}
                  ariaLabel="Тип события"
                />
              </div>
            ) : (
              <button
                type="button"
                className="tr-add-lesson-pill tr-add-lesson-pill--full"
                onClick={() => setState('picking-tag')}
              >
                {tagKey
                  ? <span className="tr-add-lesson-pill-value">{tagKey}</span>
                  : <span className="tr-add-lesson-pill-placeholder">Тип события</span>}
                <ArrowDown />
              </button>
            )}

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
                  <PickerList items={dateOptions} value={dateKey ?? dateOptions[0].key} onChange={setDateKey} ariaLabel="Дата" />
                </div>
                <div className="tr-add-lesson-half tr-add-lesson-half--picker">
                  <div className="tr-add-lesson-picker-head">
                    <span className="tr-add-lesson-pill-placeholder">время</span>
                    <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть"
                      onClick={() => setState(canCreate ? 'filled' : 'empty')}>
                      <ArrowLeftLime />
                    </button>
                  </div>
                  <PickerList items={timeOptions} value={timeKey ?? timeOptions[0].key} onChange={setTimeKey} ariaLabel="Время" />
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
            {/* Описание (Figma 2522:322): заголовок 32/500 на 593, поле 578×139 на 651, счётчик 0/500 на 802 */}
            <div className="ad-lecture-desc-label">Опишите событие</div>
            <textarea
              ref={descRef}
              className="ad-lecture-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, 500))}
              maxLength={500}
              aria-label="Описание события"
            />
            <div className={`ad-lecture-counter${desc.length >= 500 ? ' is-max' : ''}`}>{desc.length}/500</div>
            {/* Стоимость участия — пилюля 578×68 на 842 */}
            <div className={`tr-add-lesson-pill tr-add-lesson-pill--full tr-add-lesson-pill--input ad-lecture-price${price ? ' ad-lecture-price--filled' : ''}`}>
              <input
                value={price ? `${price.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₽` : ''}
                onChange={(e) => setPrice(e.target.value.replace(/\D+/g, '').slice(0, 8))}
                placeholder="введите стоимость участия"
                inputMode="numeric"
                aria-label="Стоимость участия"
              />
            </div>

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
