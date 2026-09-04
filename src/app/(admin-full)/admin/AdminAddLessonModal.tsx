"use client"

// ---------------------------------------------------------------------------
// AdminAddLessonModal — переиспользует UI/CSS из teacher AddLessonModal
// (класс .tr-add-lesson-*, тот же дизайн Figma 2208:2449/2699/2489/685/2509).
// Отличия от teacher-версии:
//   • Добавлен teacher-picker в начале (админ выбирает препода).
//   • Вместо server-action createLesson() зовём /api/admin/lessons (POST).
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
  type AddLessonStudent,
} from '@/app/(teacher-full)/teacher/AddLessonModal'

export interface AdminAddLessonTeacher {
  id: string       // teacher_profiles.id
  name: string
}

interface Props {
  /** Опционально: если пусто — модалка сама подтянет с /api/booking/teachers */
  teachers?: AdminAddLessonTeacher[]
  students: AddLessonStudent[]
  onClose: () => void
}

type State =
  | 'empty'
  | 'picking-teacher'
  | 'picking-student'
  | 'picking-datetime'
  | 'filled'
  | 'creating'
  | 'success'
  | 'error'

export default function AdminAddLessonModal({ teachers: teachersProp, students, onClose }: Props) {
  const router = useRouter()
  const dateOptions = useMemo(buildDateOptions, [])
  const timeOptions = useMemo(buildTimeOptions, [])

  // Тянем учителей если пропс пустой — критично, иначе dropdown будет пустым.
  const [teachers, setTeachers] = useState<AdminAddLessonTeacher[]>(teachersProp ?? [])
  useEffect(() => {
    if ((teachersProp && teachersProp.length > 0) || teachers.length > 0) {
      if (teachersProp && teachersProp.length > 0) setTeachers(teachersProp)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/booking/teachers', { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) {
          setTeachers((j.teachers ?? []).map((t: any) => ({ id: t.teacherProfileId, name: t.name })))
        }
      } catch (e) { console.error('[AdminAddLessonModal] teachers fetch', e) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teachersProp])

  const [state, setState] = useState<State>('empty')
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [dateKey, setDateKey] = useState<string | null>(null)
  const [timeKey, setTimeKey] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ name: string; dateLabel: string; timeLabel: string } | null>(null)
  const [successRemaining, setSuccessRemaining] = useState(60)

  const selectedTeacher = teachers.find((t) => t.id === teacherId) ?? null
  const selectedStudent = students.find((s) => s.id === studentId) ?? null
  const selectedDate = dateKey ? dateOptions.find((d) => d.key === dateKey) ?? null : null
  const selectedTime = timeKey ? timeOptions.find((t) => t.key === timeKey) ?? null : null
  const canCreate = !!selectedTeacher && !!selectedStudent && !!selectedDate && !!selectedTime

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (state === 'picking-teacher' || state === 'picking-student' || state === 'picking-datetime') {
        setState(canCreate ? 'filled' : 'empty')
      } else {
        handleClose()
      }
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
      setSuccessRemaining((r) => {
        if (r <= 1) { window.clearInterval(id); return 0 }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [state])

  useEffect(() => {
    if (['creating', 'success', 'error', 'picking-teacher', 'picking-student', 'picking-datetime'].includes(state)) return
    setState(canCreate ? 'filled' : 'empty')
  }, [canCreate, state])

  function handleClose() {
    if (state === 'success') router.refresh()
    onClose()
  }

  async function submit() {
    if (!selectedTeacher || !selectedStudent || !selectedDate || !selectedTime) return
    setErrorMsg(null)
    setState('creating')
    const dt = new Date(selectedDate.y, selectedDate.m, selectedDate.d, selectedTime.h, selectedTime.min, 0, 0)
    try {
      const res = await fetch('/api/admin/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: selectedTeacher.id,
          student_id: selectedStudent.id,
          scheduled_at: dt.toISOString(),
          duration_minutes: 50,
          price: price ? Number.parseInt(price, 10) : undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErrorMsg(j.error || 'Не удалось создать урок'); setState('error'); return }
      setSuccessData({
        name: `${selectedStudent.name} → ${selectedTeacher.name}`,
        dateLabel: selectedDate.label,
        timeLabel: selectedTime.label,
      })
      setState('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось создать урок')
      setState('error')
    }
  }

  const isSuccess = state === 'success'
  const timerLabel = `0:${String(successRemaining).padStart(2, '0')}`

  return (
    <div className="tr"><div
      className="tr-add-lesson-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className={`tr-add-lesson${isSuccess ? ' tr-add-lesson--success' : ''}`}
        role="dialog" aria-modal="true"
      >
        {isSuccess && <div className="tr-add-lesson-timer">{timerLabel}</div>}

        <button type="button" className="tr-add-lesson-close" aria-label="Закрыть" onClick={handleClose}>
          <CloseIcon />
        </button>

        {isSuccess ? (
          <>
            <div className="tr-add-lesson-success-title">
              В календарь<br />добавлен урок
            </div>
            <div className="tr-add-lesson-success-check">
              <svg viewBox="0 0 69 69" width="69" height="69" fill="none" aria-hidden>
                <circle cx="34.5" cy="34.5" r="34.5" fill="#1E1E1E" />
                <path d="M20 35l10 10 20-22" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="tr-add-lesson-success-name">{successData?.name}</div>
            <div className="tr-add-lesson-success-when">{successData?.dateLabel}, {successData?.timeLabel}</div>
          </>
        ) : (
          <>
            <h2 className="tr-add-lesson-title">Добавить новый урок</h2>

            {/* ── TEACHER ROW (только у админа) ── */}
            {state === 'picking-teacher' ? (
              <div className="tr-add-lesson-dropdown">
                <button
                  type="button"
                  className="tr-add-lesson-pill tr-add-lesson-pill--full tr-add-lesson-pill--dropdown-head"
                  onClick={() => setState(canCreate ? 'filled' : 'empty')}
                >
                  <span className="tr-add-lesson-pill-placeholder">выберите преподавателя</span>
                  <ArrowLeftLime />
                </button>
                <div className="tr-add-lesson-dropdown-list" role="listbox">
                  {teachers.length === 0 ? (
                    <div className="tr-add-lesson-dropdown-empty">Преподавателей нет</div>
                  ) : (
                    teachers.map((t, i) => (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        aria-selected={teacherId === t.id}
                        className={`tr-add-lesson-dropdown-item${teacherId === t.id ? ' is-selected' : ''}${i > 0 ? ' has-divider' : ''}`}
                        onClick={() => { setTeacherId(t.id); setErrorMsg(null); setState(canCreate ? 'filled' : 'empty') }}
                      >
                        {t.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="tr-add-lesson-pill tr-add-lesson-pill--full"
                onClick={() => { setErrorMsg(null); setState('picking-teacher') }}
              >
                {selectedTeacher ? (
                  <span className="tr-add-lesson-pill-value">{selectedTeacher.name}</span>
                ) : (
                  <span className="tr-add-lesson-pill-placeholder">выберите преподавателя</span>
                )}
                <ArrowDown />
              </button>
            )}

            {/* ── STUDENT ROW ── */}
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
                        onClick={() => { setStudentId(s.id); setErrorMsg(null); setState(canCreate ? 'filled' : 'empty') }}
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
                onClick={() => { setErrorMsg(null); setState('picking-student') }}
              >
                {selectedStudent ? (
                  <span className="tr-add-lesson-pill-value">{selectedStudent.name}</span>
                ) : (
                  <span className="tr-add-lesson-pill-placeholder">выберите ученика</span>
                )}
                <ArrowDown />
              </button>
            )}

            {/* ── DATE + TIME ROW ── */}
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
                  <WheelPicker items={dateOptions} value={dateKey ?? dateOptions[0].key} onChange={setDateKey} ariaLabel="Дата урока" />
                </div>
                <div className="tr-add-lesson-half tr-add-lesson-half--picker">
                  <div className="tr-add-lesson-picker-head">
                    <span className="tr-add-lesson-pill-placeholder">время</span>
                    <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть"
                      onClick={() => setState(canCreate ? 'filled' : 'empty')}>
                      <ArrowLeftLime />
                    </button>
                  </div>
                  <WheelPicker items={timeOptions} value={timeKey ?? timeOptions[0].key} onChange={setTimeKey} ariaLabel="Время урока" />
                </div>
              </div>
            ) : (
              <div className="tr-add-lesson-row">
                <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--half"
                  onClick={() => {
                    setErrorMsg(null)
                    if (!dateKey) setDateKey(dateOptions[0]?.key ?? null)
                    if (!timeKey) setTimeKey(timeOptions[0]?.key ?? null)
                    setState('picking-datetime')
                  }}>
                  {selectedDate ? <span className="tr-add-lesson-pill-value">{selectedDate.label}</span>
                    : <span className="tr-add-lesson-pill-placeholder">дата</span>}
                  <ArrowDown />
                </button>
                <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--half"
                  onClick={() => {
                    setErrorMsg(null)
                    if (!dateKey) setDateKey(dateOptions[0]?.key ?? null)
                    if (!timeKey) setTimeKey(timeOptions[0]?.key ?? null)
                    setState('picking-datetime')
                  }}>
                  {selectedTime ? <span className="tr-add-lesson-pill-value">{selectedTime.label}</span>
                    : <span className="tr-add-lesson-pill-placeholder">время</span>}
                  <ArrowDown />
                </button>
              </div>
            )}

            {/* Стоимость участия — необязательно; если пусто, возьмётся hourly_rate учителя */}
            <div className="tr-add-lesson-pill tr-add-lesson-pill--full"
              style={{ padding: 0, background: '#FFF' }}>
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

            <div className="tr-add-lesson-footer">
              <button type="button" className="tr-add-lesson-btn" disabled={!canCreate || state === 'creating'} onClick={submit}>
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
