'use client'

/**
 * «Создать группу» из блока «Чаты» — Figma 2522:592: 686×649 лайм, r 29.5; заголовок 32/500 на 79;
 * «введите название чата» 578×68 на (54,202); «выберите преподавателей» на (54,294) и «выберите учеников» на (54,386)
 * со стрелкой 35×36 у правого края; «Создать» 200×68 на (243,519); крестик 13.34 на (639,34).
 * Раскрытые списки (2522:450): шапка 68 + список 149, оба могут быть открыты сразу; в рядах чекбокс 25 на x 83,
 * выбранный ряд 36/700; у учителя выбор один, у учеников несколько.
 */

import { useEffect, useRef } from 'react'
import CustomScroll from '@/components/dashboard/CustomScroll'
import { ArrowDown, ArrowLeftLime, CloseIcon } from '@/app/(teacher-full)/teacher/AddLessonModal'
import { useState } from 'react'

const ROW_H = 73

/** Figma 2522:450: список с чекбоксами 25 на x 83 (29 от края пилюли); выбранный — 36/700, как в PickerList */
function CheckPickerList({ items, selected, onToggle, ariaLabel, multi }: {
  items: Array<{ key: string; label: string }>
  selected: Set<string>
  onToggle: (key: string) => void
  ariaLabel: string
  multi: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.max(0, items.findIndex((i) => selected.has(i.key)))
    el.scrollTop = Math.max(0, (idx - 1) * ROW_H)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <CustomScroll className="tr-al-dlist" scrollRef={scrollRef} track={107} ariaLabel={ariaLabel} role="listbox" aria-multiselectable={multi}>
      {items.map((it) => {
        const on = selected.has(it.key)
        return (
          <button
            key={it.key}
            type="button"
            role="option"
            aria-selected={on}
            className={`tr-al-dlist-item ad-group-item${on ? ' is-selected' : ''}`}
            onClick={() => onToggle(it.key)}
          >
            <span className="ad-group-check" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ad-group-check-circle" src={on ? '/dashboard/picker-check-on.svg' : '/dashboard/picker-check-off.svg'} alt="" width={25} height={25} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {on && <img className="ad-group-check-mark" src="/dashboard/picker-check-mark.svg" alt="" width={13} height={11} />}
            </span>
            {it.label}
          </button>
        )
      })}
    </CustomScroll>
  )
}

interface Props {
  teachers: Array<{ id: string; name: string }>
  students: Array<{ id: string; name: string }>
  groupName: string
  setGroupName: (v: string) => void
  groupTeacherId: string
  setGroupTeacherId: (v: string) => void
  groupStudentSel: Set<string>
  toggleStudent: (id: string) => void
  submitting: boolean
  error: string | null
  onSubmit: () => void
  onClose: () => void
}

export default function AdminCreateGroupModal({
  teachers, students, groupName, setGroupName, groupTeacherId, setGroupTeacherId, groupStudentSel, toggleStudent,
  submitting, error, onSubmit, onClose,
}: Props) {
  // Figma 2522:450: оба списка могут быть раскрыты одновременно
  const [teacherOpen, setTeacherOpen] = useState(false)
  const [studentsOpen, setStudentsOpen] = useState(false)
  const selectedTeacher = teachers.find((t) => t.id === groupTeacherId)
  const selectedStudents = students.filter((s) => groupStudentSel.has(s.id)).map((s) => s.name).join(', ')
  const canCreate = !!groupName.trim() && !!groupTeacherId && groupStudentSel.size > 0 && !submitting

  return (
    <div className="tr">
      <div className="tr-add-lesson-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}>
        <div className="tr-add-lesson ad-group-modal" role="dialog" aria-modal="true" aria-label="Создать группу">
          <button type="button" className="tr-add-lesson-close" aria-label="Закрыть" onClick={onClose}>
            <CloseIcon />
          </button>
          <h2 className="tr-add-lesson-title">Создать группу</h2>

          <div className="tr-add-lesson-pill tr-add-lesson-pill--full tr-add-lesson-pill--input">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="введите название чата"
              aria-label="Название чата"
              autoFocus
            />
          </div>

          {teacherOpen ? (
            <div className="tr-add-lesson-half tr-add-lesson-half--picker ad-lecture-picker--full">
              <div className="tr-add-lesson-picker-head">
                {selectedTeacher
                  ? <span className="tr-add-lesson-pill-value">{selectedTeacher.name}</span>
                  : <span className="tr-add-lesson-pill-placeholder">выберите преподавателей</span>}
                <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть" onClick={() => setTeacherOpen(false)}>
                  <ArrowLeftLime />
                </button>
              </div>
              {teachers.length === 0 ? (
                <div className="ad-lecture-picker-empty">Загружаем список учителей…</div>
              ) : (
                <CheckPickerList
                  items={teachers.map((t) => ({ key: t.id, label: t.name }))}
                  selected={new Set(groupTeacherId ? [groupTeacherId] : [])}
                  onToggle={(k) => setGroupTeacherId(groupTeacherId === k ? '' : k)}
                  ariaLabel="Преподаватель группы"
                  multi={false}
                />
              )}
            </div>
          ) : (
            <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--full" onClick={() => setTeacherOpen(true)} aria-haspopup="listbox">
              {selectedTeacher
                ? <span className="tr-add-lesson-pill-value">{selectedTeacher.name}</span>
                : <span className="tr-add-lesson-pill-placeholder">выберите преподавателей</span>}
              <ArrowDown />
            </button>
          )}

          {studentsOpen ? (
            <div className="tr-add-lesson-half tr-add-lesson-half--picker ad-lecture-picker--full">
              <div className="tr-add-lesson-picker-head">
                {groupStudentSel.size > 0
                  ? <span className="tr-add-lesson-pill-value ad-group-modal-names">{selectedStudents}</span>
                  : <span className="tr-add-lesson-pill-placeholder">выберите учеников</span>}
                <button type="button" className="tr-add-lesson-picker-back" aria-label="Свернуть" onClick={() => setStudentsOpen(false)}>
                  <ArrowLeftLime />
                </button>
              </div>
              {students.length === 0 ? (
                <div className="ad-lecture-picker-empty">Учеников пока нет</div>
              ) : (
                <CheckPickerList
                  items={students.map((s) => ({ key: s.id, label: s.name }))}
                  selected={groupStudentSel}
                  onToggle={toggleStudent}
                  ariaLabel="Ученики группы"
                  multi
                />
              )}
            </div>
          ) : (
            <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--full" onClick={() => setStudentsOpen(true)} aria-haspopup="listbox">
              {groupStudentSel.size > 0
                ? <span className="tr-add-lesson-pill-value ad-group-modal-names">{selectedStudents}</span>
                : <span className="tr-add-lesson-pill-placeholder">выберите учеников</span>}
              <ArrowDown />
            </button>
          )}

          <div className="tr-add-lesson-footer">
            <button
              type="button"
              className={`tr-add-lesson-btn${submitting ? ' busy' : ''}`}
              disabled={!canCreate}
              onClick={onSubmit}
            >
              Создать
            </button>
            {error && <div className="tr-add-lesson-error" role="alert">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
