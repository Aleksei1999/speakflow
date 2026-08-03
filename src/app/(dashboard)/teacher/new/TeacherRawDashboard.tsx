"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import StudentChat from "./StudentChat"

/* ============================================================
   Teacher Dashboard — Raw English
   Pixel-perfect implementation of Figma «Учитель RAW english»
   (file YSwlSQF1n6QIpGTOohlMOd, node 2208:955).
   Placeholder data preserved; JSX + CSS rebuilt to match Figma.
   ============================================================ */

const STUDENTS = [
  { id: "1", name: "Вадим Думович", level: "A1", addedAt: 6, nextLessonMin: 120, avatar: "/dashboard/avatar-male.jpg" },
  { id: "2", name: "Кристина Кирова", level: "A2", addedAt: 5, nextLessonMin: 45, avatar: "/avatars/placeholder-female.jpg" },
  { id: "3", name: "Артём Соловьёв", level: "A1", addedAt: 4, nextLessonMin: 320, avatar: "/dashboard/avatar-male.jpg" },
  { id: "4", name: "Егор Мельник", level: "A1", addedAt: 3, nextLessonMin: 15, avatar: "/dashboard/avatar-male.jpg" },
  { id: "5", name: "Ольга Ким", level: "A2", addedAt: 2, nextLessonMin: 200, avatar: "/avatars/placeholder-female.jpg" },
  { id: "6", name: "Даниил Гроза", level: "A1", addedAt: 1, nextLessonMin: 80, avatar: "/dashboard/avatar-male.jpg" },
  { id: "7", name: "София Ветрова", level: "A2", addedAt: 7, nextLessonMin: 60, avatar: "/avatars/placeholder-female.jpg" },
  { id: "8", name: "Максим Пирог", level: "A1", addedAt: 8, nextLessonMin: 240, avatar: "/dashboard/avatar-male.jpg" },
]

/* Заявки из формы на лендинге. `test` — результат теста,
   который ученик проходит после сабмита заявки. */
const APPLICATIONS = [
  { id: "a1", name: "Вадим Думович", level: "A1", test: false },
  { id: "a2", name: "Кристина Кирова", level: "A2", test: true },
  { id: "a3", name: "Вадим Думович", level: "A1", test: true },
  { id: "a4", name: "Мария Петрова", level: "A2", test: true },
  { id: "a5", name: "Алексей Смирнов", level: "A1", test: false },
  { id: "a6", name: "Ольга Иванова", level: "A2", test: true },
  { id: "a7", name: "Никита Кузнецов", level: "A1", test: true },
  { id: "a8", name: "Дарья Волкова", level: "A2", test: false },
]
const APPLICATIONS_VISIBLE = 3

/* Мок других учителей — куда можно передать ученика.
   В проде — fetch учителей из БД (кроме текущего). */
const TEACHERS = [
  { id: "t1", name: "Анна Иванова" },
  { id: "t2", name: "Мария Петрова" },
  { id: "t3", name: "Ольга Кузнецова" },
  { id: "t4", name: "Елена Сидорова" },
  { id: "t5", name: "Наталья Морозова" },
]

/* Мок ответов на тест с лендинга. Реально придёт из БД
   по каждой заявке (question, chosen index, correct index). */
const SAMPLE_QUESTIONS = [
  {
    text: ["When I got to work", "I remembered that ___", "my mobile at home."],
    options: ["a) I'd leave", "b) I was leaving", "c) I'd left", "d) I left"],
    correct: 2, chosen: 2,
  },
  {
    text: ["My father ___", "be a builder."],
    options: ["a) used to", "b) was", "c) use to", "d) did use to"],
    correct: 0, chosen: 1,
  },
  {
    text: ["___ I worked hard,", "I didn't pass the test."],
    options: ["a) Although", "b) So", "c) Because", "d) But"],
    correct: 0, chosen: 0,
  },
  {
    text: ["The book ___", "on the table yesterday."],
    options: ["a) is", "b) was", "c) were", "d) are"],
    correct: 1, chosen: 1,
  },
  {
    text: ["She ___ in London", "since 2010."],
    options: ["a) live", "b) lives", "c) has lived", "d) had lived"],
    correct: 2, chosen: 3,
  },
  {
    text: ["___ you like", "some tea?"],
    options: ["a) Do", "b) Would", "c) Are", "d) Will"],
    correct: 1, chosen: 1,
  },
]
const Q_PER_PAGE = 3

const LESSONS = [
  { id: "l1", time: "12:00", date: "29.09.26", label: "Урок с учеником 1" },
  { id: "l2", time: "13:00", date: "29.09.26", label: "Урок с учеником 2" },
  { id: "l3", time: "14:00", date: "29.09.26", label: "Урок с учеником 3" },
]

const CHATS = [
  {
    id: "c1",
    name: "Вадим Думович",
    preview: "Текст последнего сообщения от ученика, которое еще не прочитано",
    unread: true,
    avatar: "/dashboard/avatar-male.jpg",
    group: false,
  },
  {
    id: "c2",
    name: "Кристина Кирова",
    preview: "Текст последнего сообщения от ученика, которое еще не прочитано",
    unread: true,
    avatar: "/avatars/placeholder-female.jpg",
    group: false,
  },
  {
    id: "c3",
    name: "Вадим Думович",
    preview: "Текст последнего сообщения от ученика, которое прочитано",
    unread: false,
    avatar: "/dashboard/avatar-male.jpg",
    group: false,
  },
  {
    id: "c4",
    name: "Группа 1",
    preview: "Текст последнего сообщения, которое прочитано",
    unread: false,
    avatar: "/avatars/placeholder-female.jpg",
    group: true,
    from: "Вы: ",
  },
]

const SORT_OPTIONS = [
  { id: "az", label: "От А до Я" },
  { id: "time", label: "По времени добавления" },
  { id: "default", label: "По умолчанию\n(время до занятия)" },
] as const

const NAV = [
  { href: "#students", label: "Ученики" },
  { href: "#applications", label: "Входящие заявки" },
  { href: "#schedule", label: "Звонки" },
  { href: "#income", label: "Доход" },
  { href: "#calendar", label: "Календарь" },
]

function useClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Кириллизирует А (латинская → русская) для уровней A1/A2, остальные (B1/B2/C1/C2) — как есть */
function levelLabel(lvl: string) {
  if (lvl === "A1") return "А1"
  if (lvl === "A2") return "А2"
  return lvl
}

function ArrowRight({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 18" fill="none" aria-hidden width={size} height={(size * 18) / 32}>
      <path d="M2 9h27M22 2l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden width="20" height="20">
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden width="28" height="28">
      <path d="M4 6h9c2 0 3 1 3 3v19c0-2-1-3-3-3H4V6zM28 6h-9c-2 0-3 1-3 3v19c0-2 1-3 3-3h9V6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden width="28" height="28">
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" />
      <path d="M13 20V12h5a2.5 2.5 0 010 5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const AVATAR_PALETTE = ["#b63f37", "#8f5a2b", "#5e6b3a", "#3d5566", "#7a3a54", "#b58f2a"]
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?"
}
function paletteFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}
function Avatar({ name, src, className = "" }: { name: string; src?: string; className?: string }) {
  const [failed, setFailed] = useState(!src)
  if (!src || failed) {
    return (
      <div className={`tr-avatar-fb ${className}`} style={{ background: paletteFor(name) }} aria-hidden>
        {initialsOf(name)}
      </div>
    )
  }
  return <img className={className} src={src} alt="" onError={() => setFailed(true)} />
}

interface TeacherRawDashboardProps {
  /** Реальные ученики учителя (из page.tsx). Если пусто — падаем на mock STUDENTS
   *  чтобы дизайн-превью работало без БД. */
  initialStudents?: Array<{
    id: string
    name: string
    level: string
    avatar: string | null
    addedAt: number
    nextLessonMin: number | null
  }>
  /** profiles.id (auth.uid) текущего учителя — нужен для чата. */
  teacherId?: string
}

export default function TeacherRawDashboard({ initialStudents, teacherId }: TeacherRawDashboardProps = {}) {
  const now = useClock()
  const timeStr = now ? now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "16:24"
  const dateStr = now ? now.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "numeric" }) : "26.06.2026"
  const [sortOpen, setSortOpen] = useState(false)
  const [sortId, setSortId] = useState<typeof SORT_OPTIONS[number]["id"]>("default")
  // Реальные ученики если есть, иначе mock для дизайн-превью.
  const initial = initialStudents && initialStudents.length > 0
    ? initialStudents.map(s => ({
        id: s.id,
        name: s.name,
        level: s.level,
        addedAt: s.addedAt,
        nextLessonMin: s.nextLessonMin ?? 999_999,
        avatar: s.avatar ?? "/dashboard/avatar-male.jpg",
      }))
    : STUDENTS
  const [studentsState, setStudentsState] = useState(initial)
  const sortedStudents = useMemo(() => {
    const arr = [...studentsState]
    if (sortId === "az") arr.sort((a, b) => a.name.localeCompare(b.name, "ru"))
    else if (sortId === "time") arr.sort((a, b) => a.addedAt - b.addedAt)
    else arr.sort((a, b) => a.nextLessonMin - b.nextLessonMin)
    return arr
  }, [sortId, studentsState])
  const [appsExpanded, setAppsExpanded] = useState(false)
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null)
  const [qPage, setQPage] = useState(0)
  const [studentModalId, setStudentModalId] = useState<string | null>(null)
  const [levelPickerOpen, setLevelPickerOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [chatStudentId, setChatStudentId] = useState<string | null>(null)
  const chatStudentData = chatStudentId ? studentsState.find(s => s.id === chatStudentId) : null
  const [transferTeacher, setTransferTeacher] = useState("")
  const [transferReason, setTransferReason] = useState("")
  const studentModalData = studentModalId ? studentsState.find(s => s.id === studentModalId) : null
  useEffect(() => {
    if (!studentModalId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (levelPickerOpen) setLevelPickerOpen(false)
      else setStudentModalId(null)
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [studentModalId, levelPickerOpen])
  useEffect(() => { if (!studentModalId) setLevelPickerOpen(false) }, [studentModalId])
  useEffect(() => {
    if (!transferOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTransferOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [transferOpen])
  function submitTransfer() {
    if (!studentModalData || !transferTeacher || !transferReason.trim()) return
    const t = TEACHERS.find(x => x.id === transferTeacher)
    // eslint-disable-next-line no-console
    console.log(`[MOCK TRANSFER] ${studentModalData.name} → ${t?.name}. Причина: ${transferReason}`)
    setStudentsState(prev => prev.filter(s => s.id !== studentModalData.id))
    setTransferOpen(false)
    setStudentModalId(null)
    setTransferTeacher("")
    setTransferReason("")
  }
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const
  function changeStudentLevel(newLevel: string) {
    if (!studentModalData) return
    setStudentsState(prev => prev.map(s => s.id === studentModalData.id ? { ...s, level: newLevel } : s))
    setLevelPickerOpen(false)
    // Через 60 сек — послать ученику уведомление в личный кабинет.
    // В preview просто консоль; в проде — insert в notifications БД.
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log(`[MOCK NOTIFY] "${studentModalData.name}": ваш уровень изменён на ${newLevel}`)
    }, 60_000)
  }
  const visibleApps = appsExpanded ? APPLICATIONS : APPLICATIONS.slice(0, APPLICATIONS_VISIBLE)
  const remainingApps = APPLICATIONS.length - visibleApps.length
  const qTotalPages = Math.ceil(SAMPLE_QUESTIONS.length / Q_PER_PAGE)
  const currentQuestions = SAMPLE_QUESTIONS.slice(qPage * Q_PER_PAGE, (qPage + 1) * Q_PER_PAGE)
  useEffect(() => { setQPage(0) }, [expandedAppId])
  const [groupStep, setGroupStep] = useState<null | "participants" | "name" | "success">(null)
  const [groupSel, setGroupSel] = useState<Set<string>>(new Set())
  const [groupName, setGroupName] = useState("")
  const [backEnabled, setBackEnabled] = useState(false)
  const groupOpen = groupStep !== null
  useEffect(() => {
    if (groupStep !== "success") { setBackEnabled(false); return }
    setBackEnabled(true)
    const t = setTimeout(() => setBackEnabled(false), 60_000)
    return () => clearTimeout(t)
  }, [groupStep])
  useEffect(() => {
    if (!groupOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setGroupStep(null) }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [groupOpen])
  function toggleGroupSel(id: string) {
    setGroupSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function closeGroupModal() {
    setGroupStep(null)
    setGroupSel(new Set())
    setGroupName("")
  }
  useEffect(() => {
    if (!sortOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest?.(".tr-sort-wrap")) setSortOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [sortOpen])

  return (
    <div className="tr">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/raw-teacher.css?v=20260803-16" />

      {/* ================== HERO: nav + dark backdrop that hosts STUDENTS ================== */}
      <div className="tr-hero">
        <nav className="tr-nav">
          <Link href="/teacher" className="tr-brand" aria-label="Raw English">
            <img src="/landing/raw2/logo-raw-word.svg" alt="Raw English" />
          </Link>
          <ul className="tr-nav-links">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href}>{n.label}</a>
              </li>
            ))}
          </ul>
          <div className="tr-clock">
            <div className="time">{timeStr}</div>
            <div className="date">{dateStr}</div>
          </div>
        </nav>

        {/* STUDENTS (inside hero dark card) */}
        <section id="students" className="tr-students">
          <div className="tr-badge-wrap">
            <span className="tr-badge on-dark">
              СПИСОК <span className="c-lime">УЧЕНИКОВ</span>
            </span>
          </div>
          <div className="tr-panel">
            <div className="tr-sort-wrap">
              <button
                type="button"
                className="tr-sort"
                aria-expanded={sortOpen}
                aria-haspopup="listbox"
                onClick={() => setSortOpen((v) => !v)}
              >
                Сортировать
              </button>
              {sortOpen && (
                <div className="tr-sort-pop" role="listbox">
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={sortId === o.id}
                      className={`tr-sort-opt ${sortId === o.id ? "on" : ""}`}
                      onClick={() => { setSortId(o.id); setSortOpen(false) }}
                    >
                      <span className="dot" aria-hidden />
                      <span className="lbl">{o.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="tr-students-scroll">
              <div className="tr-students-grid">
                {sortedStudents.map((s) => (
                  <div
                    className="tr-stu"
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setStudentModalId(s.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setStudentModalId(s.id)}
                  >
                    <div className="tr-stu-avatar">
                      <Avatar name={s.name} src={s.avatar} />
                    </div>
                    <div className="tr-stu-name">
                      {s.name.split(" ").map((part, i) => (
                        <span key={i} className="tr-stu-name-line">{part}</span>
                      ))}
                    </div>
                    <span className="tr-stu-lvl">{levelLabel(s.level)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="tr-panel-footer">
              <button type="button" className="tr-create-group" onClick={() => setGroupStep("participants")}>
                Создать группу
                <span className="arrow-btn sm" aria-hidden>
                  <ArrowRight size={28} />
                </span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {groupOpen && (
        <div className="tr-modal-backdrop" onClick={closeGroupModal}>
          {groupStep === "participants" && (
            <div className="tr-modal" role="dialog" aria-modal="true" aria-labelledby="tr-modal-title" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="tr-modal-close" aria-label="Закрыть" onClick={closeGroupModal}>
                <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <h2 id="tr-modal-title" className="tr-modal-title">Выберите участников группы</h2>
              <div className="tr-modal-list">
                {sortedStudents.map((s) => {
                  const on = groupSel.has(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`tr-modal-row ${on ? "on" : ""}`}
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleGroupSel(s.id)}
                    >
                      <span className={`tr-modal-check ${on ? "on" : ""}`} aria-hidden>
                        {on && (
                          <svg viewBox="0 0 16 13" width="16" height="13" fill="none">
                            <path d="M2 7l4 4 8-9" stroke="#DFED8C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <div className="tr-stu tr-stu--modal">
                        <div className="tr-stu-avatar">
                          <Avatar name={s.name} src={s.avatar} />
                        </div>
                        <div className="tr-stu-name">
                          {s.name.split(/\s+/).map((part, i) => (
                            <span key={i} className="tr-stu-name-line">{part}</span>
                          ))}
                        </div>
                        <span className="tr-stu-lvl">{levelLabel(s.level)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="tr-modal-footer">
                <button
                  type="button"
                  className="tr-create-group tr-create-group--modal"
                  onClick={() => setGroupStep("name")}
                  disabled={groupSel.size < 2}
                >
                  Создать группу
                </button>
              </div>
            </div>
          )}

          {groupStep === "name" && (
            <div className="tr-modal tr-modal--name" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="tr-modal-close tr-modal-close--dark" aria-label="Закрыть" onClick={closeGroupModal}>
                <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <h2 className="tr-modal-title tr-modal-title--dark">Введите название группы</h2>
              <input
                type="text"
                className="tr-modal-input"
                placeholder="название группы"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
              />
              <div className="tr-modal-footer">
                <button
                  type="button"
                  className="tr-modal-done"
                  onClick={() => setGroupStep("success")}
                  disabled={!groupName.trim()}
                >
                  Готово
                </button>
              </div>
            </div>
          )}

          {groupStep === "success" && (
            <div className="tr-modal tr-modal--success" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="tr-modal-close tr-modal-close--dark" aria-label="Закрыть" onClick={closeGroupModal}>
                <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <p className="tr-modal-success-title">
                Группа создана
                <br />
                и появится у вас в чатах
              </p>
              <div className="tr-modal-success-check" aria-hidden>
                <svg viewBox="0 0 32 26" width="32" height="26" fill="none">
                  <path d="M4 14l8 8 16-18" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="tr-modal-success-name">{groupName || "Группа"}</h3>
              <button
                type="button"
                className="tr-modal-success-back"
                aria-label={backEnabled ? "Вернуться к вводу названия" : "Отменить нельзя — прошло 60 сек"}
                title={backEnabled ? "Вернуться" : "Отмена больше недоступна — группа уже сохранена"}
                onClick={() => setGroupStep("name")}
                disabled={!backEnabled}
              >
                <svg viewBox="0 0 22 18" width="22" height="18" fill="none" aria-hidden>
                  <path d="M20 9H3M10 2L2 9l8 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================== STUDENT MODAL (клик по ученику из списка) ================== */}
      {studentModalData && (
        <div className="tr-modal-backdrop" onClick={() => setStudentModalId(null)}>
          <div
            className={`tr-modal tr-modal--student${levelPickerOpen ? " tr-modal--student-picker" : ""}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tr-modal-close tr-modal-close--dark"
              aria-label="Закрыть"
              onClick={() => setStudentModalId(null)}
            >
              <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            {levelPickerOpen ? (
              <>
                <div className="tr-stu-picker-title">Выберите уровень ученика</div>
                <div className="tr-stu-picker-row" role="radiogroup" aria-label="Уровень ученика">
                  <div className="tr-stu-picker-pill" />
                  <div className="tr-stu-picker-cap" />
                  <div className="tr-stu-picker-buttons">
                    {LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        className="tr-stu-picker-lvl"
                        onClick={() => changeStudentLevel(lvl)}
                        role="radio"
                        aria-checked={studentModalData.level === lvl}
                      >
                        {levelLabel(lvl)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="tr-stu-modal-lvl"
                  aria-label={`Изменить уровень (сейчас ${studentModalData.level})`}
                  onClick={() => setLevelPickerOpen(true)}
                >
                  {levelLabel(studentModalData.level)}
                </button>

                <header className="tr-stu-modal-head">
                  <div className="tr-stu-modal-avatar">
                    <Avatar name={studentModalData.name} src={studentModalData.avatar} />
                  </div>
                  <h2 className="tr-stu-modal-name">{studentModalData.name}</h2>
                </header>
              </>
            )}

            <div className="tr-stu-modal-section">
              <div className="tr-stu-modal-title">Об ученике</div>
              <div className="tr-stu-modal-card">Интересуется баснями и поэзией</div>
              <div className="tr-stu-modal-count">27/500</div>
            </div>

            <div className="tr-stu-modal-section">
              <div className="tr-stu-modal-title">О последнем уроке</div>
              <div className="tr-stu-modal-card">
                <span>Плохо запомнил времена,</span>
                <span>нужно повторить</span>
              </div>
              <div className="tr-stu-modal-count">35/500</div>
            </div>

            <div className="tr-stu-modal-actions">
              <button
                type="button"
                className="tr-stu-modal-chat"
                onClick={() => {
                  const id = studentModalData.id
                  setStudentModalId(null)
                  setChatStudentId(id)
                }}
              >
                Открыть чат
              </button>
              <button type="button" className="tr-stu-modal-pass" onClick={() => setTransferOpen(true)}>Передать ученика</button>
            </div>
          </div>
        </div>
      )}

      {/* ================== TRANSFER MODAL (передача ученика другому учителю) ================== */}
      {transferOpen && studentModalData && (
        <div className="tr-modal-backdrop tr-modal-backdrop--top" onClick={() => setTransferOpen(false)}>
          <div className="tr-modal tr-modal--transfer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="tr-modal-close tr-modal-close--dark"
              aria-label="Закрыть"
              onClick={() => setTransferOpen(false)}
            >
              <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <h2 className="tr-tr-modal-title">Передача ученика<br />другому учителю</h2>
            <select
              className="tr-tr-modal-select"
              value={transferTeacher}
              onChange={(e) => setTransferTeacher(e.target.value)}
              required
            >
              <option value="" disabled>выберите учителя</option>
              {TEACHERS.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <textarea
              className="tr-tr-modal-reason"
              placeholder="причина передачи ученика"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
            />
            <button
              type="button"
              className="tr-tr-modal-submit"
              disabled={!transferTeacher || !transferReason.trim()}
              onClick={submitTransfer}
            >
              Передать
            </button>
          </div>
        </div>
      )}

      {/* ================== STUDENT CHAT (клик по «Открыть чат» в модалке ученика) ================== */}
      {chatStudentData && (
        <StudentChat
          studentId={chatStudentData.id}
          studentName={chatStudentData.name}
          studentLevel={chatStudentData.level}
          studentAvatar={chatStudentData.avatar}
          teacherId={teacherId}
          onClose={() => setChatStudentId(null)}
        />
      )}

      {/* ================== APPLICATIONS ================== */}
      <section id="applications" className="tr-section">
        <div className="tr-badge-wrap">
          <span className="tr-badge">
            ВХОДЯЩИЕ ЗАЯВКИ <span className="c-red">УЧЕНИКОВ</span>
          </span>
        </div>
        <p className="tr-sub">Ученики, с которыми нужно назначить пробное занятие.</p>
        <div className="tr-apps">
          <div className="tr-apps-list">
          {visibleApps.map((a) => {
            const isOpen = expandedAppId === a.id
            return (
              <div className={`tr-app${isOpen ? " tr-app--open" : ""}`} key={a.id}>
                <span className="tr-app-name">{a.name}</span>
                {!isOpen && (
                  <span className={`tr-app-tag ${a.test ? "tr-app-tag--ok" : "tr-app-tag--no"}`}>
                    {a.test ? "тест пройден" : "тест не пройден"}
                  </span>
                )}
                <div className="tr-app-cap" aria-hidden />
                <span className="tr-app-lvl">{levelLabel(a.level)}</span>
                <button
                  type="button"
                  className="tr-app-arrow"
                  aria-label={isOpen ? "Свернуть" : `Открыть заявку ${a.name}`}
                  aria-expanded={isOpen}
                  onClick={() => setExpandedAppId(isOpen ? null : a.id)}
                >
                  {isOpen ? (
                    <svg viewBox="0 0 32 20" width="24" height="15" fill="none" aria-hidden>
                      <path d="M2 5l14 12L30 5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 32 18" width="32" height="18" fill="none" aria-hidden>
                      <path d="M30 9H3M10 2L3 9l7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {isOpen && (
                  <>
                    <div className="tr-app-questions">
                      {qTotalPages > 1 && (
                        <button
                          type="button"
                          className="tr-q-prev"
                          aria-label="Предыдущие вопросы"
                          onClick={() => setQPage((p) => (p - 1 + qTotalPages) % qTotalPages)}
                        >
                          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
                            <path d="M13 8H4M8 3L3 8l5 5" stroke="#DFED8C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                      {currentQuestions.map((q, i) => (
                        <div className="tr-q" key={qPage * Q_PER_PAGE + i}>
                          <div className="tr-q-label">Вопрос {qPage * Q_PER_PAGE + i + 1}</div>
                          <div className="tr-q-text">
                            {q.text.map((line, j) => (
                              <span key={j} className="tr-q-line">{line}</span>
                            ))}
                          </div>
                          <ul className="tr-q-opts">
                            {q.options.map((opt, k) => {
                              const isChosen = k === q.chosen
                              const isCorrect = q.chosen === q.correct
                              return (
                                <li key={k} className={isChosen ? (isCorrect ? "chosen ok" : "chosen no") : ""}>
                                  {isChosen && (
                                    isCorrect ? (
                                      <svg className="tr-q-icon tr-q-icon--ok" viewBox="0 0 20 20" aria-hidden>
                                        <circle cx="10" cy="10" r="10" fill="#DFED8C" />
                                        <path d="M5.5 10.5l3 3 6.5-7.5" stroke="#1E1E1E" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    ) : (
                                      <svg className="tr-q-icon tr-q-icon--no" viewBox="0 0 20 20" aria-hidden>
                                        <circle cx="10" cy="10" r="10" fill="#CC3A3A" />
                                        <path d="M6 6l8 8M14 6l-8 8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                                      </svg>
                                    )
                                  )}
                                  {opt}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                      {qTotalPages > 1 && (
                        <button
                          type="button"
                          className="tr-q-next"
                          aria-label={`Следующие вопросы (${qPage + 1} из ${qTotalPages})`}
                          onClick={() => setQPage((p) => (p + 1) % qTotalPages)}
                        >
                          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
                            <path d="M3 8h9M8 3l5 5-5 5" stroke="#DFED8C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="tr-app-actions">
                      <button type="button" className="tr-app-accept">Взять ученика</button>
                      <button type="button" className="tr-app-decline">Не могу взять</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
          </div>
          {(remainingApps > 0 || appsExpanded) && (
            <div className="tr-apps-footer">
              <button
                type="button"
                className={`tr-apps-expand ${appsExpanded ? "is-open" : ""}`}
                aria-label={appsExpanded ? "Свернуть" : "Показать больше"}
                aria-expanded={appsExpanded}
                onClick={() => setAppsExpanded((v) => !v)}
              >
                <svg viewBox="0 0 32 16" width="32" height="16" fill="none" aria-hidden>
                  <path d="M4 4l12 10L28 4" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {remainingApps > 0 && (
                <button
                  type="button"
                  className="tr-apps-more"
                  onClick={() => setAppsExpanded(true)}
                >
                  и еще {remainingApps}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ================== SCHEDULE (dark) ================== */}
      <section id="schedule" className="tr-section tr-section-dark">
        <div className="tr-inner">
          <div className="tr-badge-wrap">
            <span className="tr-badge on-dark">
              <span className="c-lime">РАСПИСАНИЕ</span> И КАЛЕНДАРЬ
            </span>
          </div>
          <div className="tr-schedule">
            {LESSONS.map((l) => (
              <div className="tr-lesson" key={l.id}>
                <div className="tr-lesson-time">
                  <div className="hh">{l.time}</div>
                  <div className="dd">{l.date}</div>
                </div>
                <div className="tr-lesson-label">{l.label}</div>
                <button type="button" className="tr-lesson-edit" aria-label="Изменить">
                  <EditIcon />
                </button>
                <button type="button" className="tr-lesson-call">
                  начать звонок
                </button>
              </div>
            ))}
          </div>
          <div className="tr-schedule-actions">
            <button type="button" className="tr-sched-btn lime">открыть календарь</button>
            <button type="button" className="tr-sched-btn lime">добавить урок</button>
            <button type="button" className="tr-sched-btn red">запрос на урок</button>
          </div>
        </div>
      </section>

      {/* ================== INCOME (red) ================== */}
      <section id="income" className="tr-section tr-section-red">
        <div className="tr-inner">
          <div className="tr-income-card">
            <div className="tr-income-left">
              <div className="tr-income-title">
                Ваш доход
                <br />
                <span className="c-red">на платформе</span>
              </div>
              <button type="button" className="tr-income-cta">КАК СЧИТАЕТСЯ ДОХОД?</button>
            </div>
            <div className="tr-income-metric">
              <BookIcon />
              <div className="stack">
                <span className="caption">за август</span>
                <div className="value">5</div>
                <span className="label">
                  уроков
                  <br />
                  проведено
                </span>
              </div>
            </div>
            <div className="tr-income-metric">
              <CoinIcon />
              <div className="stack">
                <span className="caption red">за август</span>
                <div className="value">55.400</div>
                <span className="label">рублей</span>
              </div>
              <div className="stack">
                <span className="caption mut">с начала года</span>
                <div className="value">346.000</div>
                <span className="label">рублей</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================== CHATS ================== */}
      <section id="chats" className="tr-section">
        <div className="tr-badge-wrap">
          <span className="tr-badge">
            ЧАТ С <span className="c-red">УЧЕНИКАМИ</span>
          </span>
        </div>
        <div className="tr-chats">
          {CHATS.map((c) => (
            <div className={`tr-chat ${c.unread ? "unread" : ""} ${c.group ? "group" : ""}`} key={c.id}>
              <div className="tr-chat-avatar">
                <Avatar name={c.name} src={c.avatar} />
                {c.group && (
                  <span className="mini" aria-hidden>
                    <Avatar name="V K" />
                  </span>
                )}
              </div>
              <div className="tr-chat-body">
                <div className="tr-chat-name">{c.name}</div>
                <div className="tr-chat-preview">
                  {c.group && c.from ? <b>{c.from}</b> : null}
                  {c.preview}
                </div>
              </div>
              {c.unread && <span className="tr-chat-badge">1 новое сообщение</span>}
              {c.group && <span className="tr-chat-count-badge">9</span>}
              <span className="arrow-btn sm tr-chat-arrow" aria-hidden>
                <ArrowRight size={28} />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ================== HOMEWORK ================== */}
      <section id="homework" className="tr-section">
        <div className="tr-badge-wrap">
          <span className="tr-badge">
            ДОМАШНИЕ ЗАДАНИЯ И <span className="c-red">БИБЛИОТЕКА</span>
          </span>
        </div>
        <div className="tr-hw-list">
          <button type="button" className="tr-hw-pill">
            Домашние задания
            <span className="arrow-btn sm" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </button>
          <button type="button" className="tr-hw-pill">
            Библиотека <span className="raw">Raw English</span>
            <span className="arrow-btn sm" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </button>
          <button type="button" className="tr-hw-pill">
            История занятий
            <span className="arrow-btn sm" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </button>
        </div>
      </section>

      {/* ================== FOOTER ================== */}
      <footer className="tr-footer">
        <div className="tr-footer-inner">
          <div className="tr-footer-links">
            <a href="https://t.me/" target="_blank" rel="noreferrer">Telegram</a>
            <a className="mut" href="#">Связаться</a>
            <Link className="mut" href="/oferta">Договор-оферта</Link>
            <Link className="mut" href="/privacy">Политика конфиденциальности</Link>
          </div>
          <div className="tr-footer-center">
            <button type="button" className="tr-footer-support">Написать в поддержку</button>
            <p className="tr-footer-copy">By V. Kratkovskaya © 2026</p>
          </div>
          <div className="tr-footer-legal">
            <b>ИП Кратковская</b>
            <br />
            Валерия Витальевна
            <br />
            ОГРНИП: 325619600134369
            <br />
            ИНН: 616485783606
          </div>
        </div>
      </footer>
    </div>
  )
}
