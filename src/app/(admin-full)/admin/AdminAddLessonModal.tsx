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
import { cancelLesson } from '@/app/(teacher-full)/teacher/lesson-actions'
import {
  buildDateOptions,
  buildTimeOptions,
  ArrowDown,
  ArrowLeftLime,
  ArrowLeftRed,
  CheckIcon,
  CloseIcon,
  PickerList,
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ name: string; dateLabel: string; timeLabel: string } | null>(null)
  const [successRemaining, setSuccessRemaining] = useState(59)
  // id созданного урока — для отмены кнопкой ← в окне успеха, пока идёт таймер 0:59 (Figma 2522:2590)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [reverting, setReverting] = useState(false)

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
    setSuccessRemaining(59)
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
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErrorMsg(j.error || 'Не удалось создать урок'); setState('error'); return }
      setCreatedId(typeof j.id === 'string' ? j.id : null)
      setSuccessData({
        name: selectedStudent.name,
        dateLabel: selectedDate.label,
        timeLabel: selectedTime.label,
      })
      setState('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось создать урок')
      setState('error')
    }
  }

  async function revertToFilled() {
    if (!createdId || successRemaining <= 0 || reverting) return
    setReverting(true)
    try {
      const r = await cancelLesson({ lessonId: createdId })
      if (!r.ok) setErrorMsg(r.error)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось отменить урок')
    } finally {
      setCreatedId(null)
      setReverting(false)
      setState('filled')
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
        className={`tr-add-lesson ad-lesson-modal${isSuccess ? ' tr-add-lesson--success' : ''}`}
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
            {/* Figma 2522:2590: галочка 69 на 189, имя ученика 36/700 на 271, дата 36/500 на 315, ← 46×47 на 387 */}
            <div className="tr-add-lesson-success-check">
              <CheckIcon />
            </div>
            <div className="tr-add-lesson-success-name">{successData?.name}</div>
            <div className="tr-add-lesson-success-when">{successData?.dateLabel}, {successData?.timeLabel}</div>
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
            <h2 className="tr-add-lesson-title">Добавить новый урок</h2>

            {/* ── TEACHER ROW (только у админа) ── */}
            {state === 'picking-teacher' ? (
              /* Figma 2522:402: открытый список 578×217 (шапка 68 + список 149, ряды 72+1, трек 7×107) */
              <div className="tr-add-lesson-half tr-add-lesson-half--picker ad-lecture-picker--full">
                <div className="tr-add-lesson-picker-head">
                  {selectedTeacher
                    ? <span className="tr-add-lesson-pill-value">{selectedTeacher.name}</span>
                    : <span className="tr-add-lesson-pill-placeholder">выберите учителя</span>}
                  <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть"
                    onClick={() => setState(canCreate ? 'filled' : 'empty')}>
                    <ArrowLeftLime />
                  </button>
                </div>
                {teachers.length === 0 ? (
                  <div className="ad-lecture-picker-empty">Загружаем список учителей…</div>
                ) : (
                  <PickerList
                    items={teachers.map((t) => ({ key: t.id, label: t.name }))}
                    value={teacherId ?? ''}
                    onChange={(k) => { setTeacherId(k); setErrorMsg(null); setState(canCreate ? 'filled' : 'empty') }}
                    ariaLabel="Учитель"
                  />
                )}
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
                  <span className="tr-add-lesson-pill-placeholder">выберите учителя</span>
                )}
                <ArrowDown />
              </button>
            )}

            {/* ── STUDENT ROW ── */}
            {state === 'picking-student' ? (
              <div className="tr-add-lesson-half tr-add-lesson-half--picker ad-lecture-picker--full">
                <div className="tr-add-lesson-picker-head">
                  {selectedStudent
                    ? <span className="tr-add-lesson-pill-value">{selectedStudent.name}</span>
                    : <span className="tr-add-lesson-pill-placeholder">выберите ученика</span>}
                  <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть"
                    onClick={() => setState(canCreate ? 'filled' : 'empty')}>
                    <ArrowLeftLime />
                  </button>
                </div>
                {students.length === 0 ? (
                  <div className="ad-lecture-picker-empty">Учеников пока нет</div>
                ) : (
                  <PickerList
                    items={students.map((st) => ({ key: st.id, label: st.name }))}
                    value={studentId ?? ''}
                    onChange={(k) => { setStudentId(k); setErrorMsg(null); setState(canCreate ? 'filled' : 'empty') }}
                    ariaLabel="Ученик"
                  />
                )}
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
                  <PickerList items={dateOptions} value={dateKey ?? dateOptions[0].key} onChange={setDateKey} ariaLabel="Дата урока" />
                </div>
                <div className="tr-add-lesson-half tr-add-lesson-half--picker">
                  <div className="tr-add-lesson-picker-head">
                    <span className="tr-add-lesson-pill-placeholder">время</span>
                    <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть"
                      onClick={() => setState(canCreate ? 'filled' : 'empty')}>
                      <ArrowLeftLime />
                    </button>
                  </div>
                  <PickerList items={timeOptions} value={timeKey ?? timeOptions[0].key} onChange={setTimeKey} ariaLabel="Время урока" />
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

            {/* Figma 2522:354: стоимости в форме нет — берётся hourly_rate учителя */}

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
