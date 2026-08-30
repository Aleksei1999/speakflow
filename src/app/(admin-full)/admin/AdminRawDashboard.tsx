"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import SiteFooter from "@/components/dashboard/SiteFooter"

/* ============================================================
   Admin Dashboard — Raw English
   Pixel-perfect implementation of Figma «Администратор RAW english»
   (file YSwlSQF1n6QIpGTOohlMOd, node 2208:1206).
   Реальные данные — из page.tsx (профили из БД); чаты и содержимое
   заявок — placeholder, строго под макет.
   Scope: `.ad`
   ============================================================ */

const NAV = [
  { href: "#schedule", label: "Занятия и расписание" },
  { href: "#library", label: "Библиотека" },
  { href: "#leads", label: "Лиды" },
  { href: "#chats", label: "Звонки" },
  { href: "#teachers", label: "Учителя" },
  { href: "#students", label: "Ученики" },
]

/* Placeholder-заявки — если реальных из trial_requests нет, чтобы
   визуально секция соответствовала Figma. */
const APPLICATIONS_MOCK = [
  { id: "a1", name: "Вадим Думович", level: "A1", test: false },
  { id: "a2", name: "Кристина Кирова", level: "A2", test: true },
  { id: "a3", name: "Вадим Думович", level: "A1", test: true },
  { id: "a4", name: "Мария Петрова", level: "A2", test: true },
  { id: "a5", name: "Алексей Смирнов", level: "A1", test: false },
]
const APPLICATIONS_VISIBLE = 3

const STUDENTS_MOCK = [
  { id: "s1", name: "Вадим Думович", level: "A1", avatar: null },
  { id: "s2", name: "Кристина Кирова", level: "A2", avatar: null },
  { id: "s3", name: "Вадим Думович", level: "A1", avatar: null },
  { id: "s4", name: "Кристина Кирова", level: "A2", avatar: null },
  { id: "s5", name: "Вадим Думович", level: "A1", avatar: null },
  { id: "s6", name: "Вадим Думович", level: "A1", avatar: null },
]

const TEACHERS_MOCK = [
  { id: "t1", name: "Ксения Фролова", avatar: null },
  { id: "t2", name: "Евгений Акцентов", avatar: null },
  { id: "t3", name: "Варвара Кистина", avatar: null },
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
    avatar: null,
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
    avatar: null,
    group: true,
    from: "Вы: ",
  },
]

const SORT_OPTIONS = [
  { id: "az", label: "От А до Я" },
  { id: "time", label: "По времени добавления" },
  { id: "default", label: "По уровню" },
] as const

function useClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function levelLabel(lvl: string) {
  if (lvl === "A1") return "А1"
  if (lvl === "A2") return "А2"
  return lvl
}

function ArrowRight({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 18"
      fill="none"
      aria-hidden
      width={size}
      height={(size * 18) / 32}
    >
      <path
        d="M2 9h27M22 2l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const AVATAR_PALETTE = [
  "#b63f37",
  "#8f5a2b",
  "#5e6b3a",
  "#3d5566",
  "#7a3a54",
  "#b58f2a",
]
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?"
}
function paletteFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}
function Avatar({
  name,
  src,
  className = "",
}: {
  name: string
  src?: string | null
  className?: string
}) {
  const [failed, setFailed] = useState(!src)
  if (!src || failed) {
    return (
      <div
        className={`ad-avatar-fb ${className}`}
        style={{ background: paletteFor(name) }}
        aria-hidden
      >
        {initialsOf(name)}
      </div>
    )
  }
  return (
    <img
      className={className}
      src={src}
      alt=""
      onError={() => setFailed(true)}
    />
  )
}

interface AdminRawDashboardProps {
  teachers?: Array<{ id: string; name: string; avatar: string | null }>
  students?: Array<{
    id: string
    name: string
    level: string
    avatar: string | null
  }>
  applications?: Array<{
    id: string
    name: string
    level: string
    test: boolean
  }>
  upcomingLessons?: Array<{
    id: string
    scheduledAt: string
    title: string
  }>
}

export default function AdminRawDashboard({
  teachers,
  students,
  applications,
  upcomingLessons,
}: AdminRawDashboardProps = {}) {
  const now = useClock()
  const timeStr = now
    ? now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
    : "16:24"
  const dateStr = now
    ? now.toLocaleDateString("ru", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "26.06.2026"

  const [sortOpen, setSortOpen] = useState(false)
  const [sortId, setSortId] = useState<typeof SORT_OPTIONS[number]["id"]>(
    "default",
  )

  // Fall back to mock if no real data (preview mode).
  const teachersData =
    teachers && teachers.length > 0 ? teachers : TEACHERS_MOCK
  const studentsData =
    students && students.length > 0 ? students : STUDENTS_MOCK
  const appsData =
    applications && applications.length > 0 ? applications : APPLICATIONS_MOCK

  const sortedStudents = useMemo(() => {
    const arr = [...studentsData]
    if (sortId === "az") arr.sort((a, b) => a.name.localeCompare(b.name, "ru"))
    else if (sortId === "time") arr.reverse()
    else arr.sort((a, b) => a.level.localeCompare(b.level))
    return arr
  }, [sortId, studentsData])

  const [appsExpanded, setAppsExpanded] = useState(false)
  const visibleApps = appsExpanded
    ? appsData
    : appsData.slice(0, APPLICATIONS_VISIBLE)
  const remainingApps = appsData.length - visibleApps.length

  useEffect(() => {
    if (!sortOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest?.(".ad-sort-wrap")) setSortOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [sortOpen])

  // Render schedule from real lessons if provided; otherwise placeholder line.
  const scheduleView = (upcomingLessons ?? []).slice(0, 6).map((l) => {
    const d = new Date(l.scheduledAt)
    const time = d.toLocaleTimeString("ru", {
      hour: "2-digit",
      minute: "2-digit",
    })
    const date = d.toLocaleDateString("ru", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    })
    return { id: l.id, time, date, label: l.title }
  })

  return (
    <div className="ad">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="/dashboard/raw-admin.css?v=20260823-2"
      />

      {/* ================== HERO: nav + dark card holding SCHEDULE ================== */}
      <div className="ad-hero">
        <nav className="ad-nav">
          <Link href="/admin" className="ad-brand" aria-label="Raw English">
            <img
              src="/landing/raw2/logo-raw-word-white.svg"
              alt="Raw English"
            />
          </Link>
          <ul className="ad-nav-links">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href}>{n.label}</a>
              </li>
            ))}
          </ul>
          <div className="ad-clock">
            <div className="time">{timeStr}</div>
            <div className="date">{dateStr}</div>
          </div>
        </nav>

        <section id="schedule" className="ad-hero-inner">
          <div className="ad-badge-wrap">
            <span className="ad-badge on-dark">
              ЗАНЯТИЯ И <span className="c-lime">РАСПИСАНИЕ</span>
            </span>
          </div>
          <div className="ad-panel">
            {scheduleView.length === 0 ? (
              <div className="ad-schedule-empty">
                Тут попозже будет календарь
              </div>
            ) : (
              <div className="ad-schedule">
                {scheduleView.map((l) => (
                  <div className="ad-lesson" key={l.id}>
                    <div className="ad-lesson-time">
                      <div className="hh">{l.time}</div>
                      <div className="dd">{l.date}</div>
                    </div>
                    <div className="ad-lesson-label">{l.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="ad-hero-cta">
            <button type="button" className="ad-create-btn">
              Добавить урок или событие
              <span className="ad-arrow-btn" aria-hidden>
                <ArrowRight size={28} />
              </span>
            </button>
          </div>
        </section>
      </div>

      {/* ================== HOMEWORK & LIBRARY ================== */}
      <section id="library" className="ad-section">
        <div className="ad-badge-wrap">
          <span className="ad-badge">
            ДОМАШНИЕ ЗАДАНИЯ И <span className="c-red">БИБЛИОТЕКА</span>
          </span>
        </div>
        <div className="ad-hw-list">
          <button type="button" className="ad-hw-pill">
            Домашние задания
            <span className="ad-arrow-btn" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </button>
          <button type="button" className="ad-hw-pill">
            Библиотека <span className="raw">Raw English</span>
            <span className="ad-arrow-btn" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </button>
          <button type="button" className="ad-hw-pill">
            История занятий
            <span className="ad-arrow-btn" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </button>
        </div>
      </section>

      {/* ================== CHATS (dark bg) ================== */}
      <section id="chats" className="ad-section ad-section-dark">
        <div className="ad-inner">
          <div className="ad-badge-wrap">
            <span className="ad-badge on-dark">ЧАТЫ</span>
          </div>
          <div className="ad-chats">
            {CHATS.map((c) => (
              <div
                className={`ad-chat ${c.unread ? "unread" : ""} ${
                  c.group ? "group" : ""
                }`}
                key={c.id}
              >
                <div className="ad-chat-avatar">
                  <Avatar name={c.name} src={c.avatar} />
                  {c.group && (
                    <span className="mini" aria-hidden>
                      <Avatar name="V K" />
                    </span>
                  )}
                </div>
                <div className="ad-chat-body">
                  <div className="ad-chat-name">{c.name}</div>
                  <div className="ad-chat-preview">
                    {c.group && c.from ? <b>{c.from}</b> : null}
                    {c.preview}
                  </div>
                </div>
                {c.unread && (
                  <span className="ad-chat-badge">1 новое сообщение</span>
                )}
                {c.group && <span className="ad-chat-count-badge">9</span>}
                <span className="ad-arrow-btn sm ad-chat-arrow" aria-hidden>
                  <ArrowRight size={28} />
                </span>
              </div>
            ))}
          </div>
          <div className="ad-chats-footer">
            <button type="button" className="ad-create-btn">
              Создать группу
              <span className="ad-arrow-btn" aria-hidden>
                <ArrowRight size={28} />
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ================== TEACHERS ================== */}
      <section id="teachers" className="ad-section">
        <div className="ad-badge-wrap">
          <span className="ad-badge">
            СПИСОК <span className="c-red">УЧИТЕЛЕЙ</span>
          </span>
        </div>
        <div className="ad-teachers">
          {teachersData.slice(0, 3).map((t) => (
            <div className="ad-teacher" key={t.id}>
              <div className="ad-teacher-photo">
                <Avatar name={t.name} src={t.avatar} />
              </div>
              <div className="ad-teacher-body">
                <div className="ad-teacher-name">
                  {t.name.split(/\s+/).map((part, i) => (
                    <span key={i}>{part}</span>
                  ))}
                </div>
                <div className="ad-teacher-meta">о преподавателе</div>
                <div className="ad-teacher-desc">
                  Сколько учеников,<br />
                  какой доход, какая маржа,<br />
                  сколько уроков...
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================== STUDENTS (dark bg) ================== */}
      <section id="students" className="ad-section ad-section-dark">
        <div className="ad-inner">
          <div className="ad-badge-wrap">
            <span className="ad-badge on-dark">
              СПИСОК <span className="c-lime">УЧЕНИКОВ</span>
            </span>
          </div>
          <div className="ad-panel ad-panel-students">
            <div className="ad-sort-wrap">
              <button
                type="button"
                className="ad-sort"
                aria-expanded={sortOpen}
                aria-haspopup="listbox"
                onClick={() => setSortOpen((v) => !v)}
              >
                Сортировать
              </button>
              {sortOpen && (
                <div className="ad-sort-pop" role="listbox">
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={sortId === o.id}
                      className={`ad-sort-opt ${sortId === o.id ? "on" : ""}`}
                      onClick={() => {
                        setSortId(o.id)
                        setSortOpen(false)
                      }}
                    >
                      <span className="dot" aria-hidden />
                      <span className="lbl">{o.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="ad-students-scroll">
              <div className="ad-students-grid">
                {sortedStudents.map((s) => (
                  <div className="ad-stu" key={s.id}>
                    <div className="ad-stu-avatar">
                      <Avatar name={s.name} src={s.avatar} />
                    </div>
                    <div className="ad-stu-name">
                      {s.name.split(/\s+/).map((part, i) => (
                        <span key={i} className="ad-stu-name-line">
                          {part}
                        </span>
                      ))}
                    </div>
                    <span className="ad-stu-lvl">{levelLabel(s.level)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ad-panel-footer">
              <button type="button" className="ad-create-btn">
                Создать группу
                <span className="ad-arrow-btn" aria-hidden>
                  <ArrowRight size={28} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================== INCOMING APPLICATIONS ================== */}
      <section id="leads" className="ad-section">
        <div className="ad-badge-wrap">
          <span className="ad-badge">
            ВХОДЯЩИЕ ЗАЯВКИ <span className="c-red">УЧЕНИКОВ</span>
          </span>
        </div>
        <p className="ad-sub">
          Ученики, с которыми нужно назначить пробное занятие.
        </p>
        <div className="ad-apps">
          <div className="ad-apps-list">
            {visibleApps.map((a) => (
              <div className="ad-app" key={a.id}>
                <span className="ad-app-name">{a.name}</span>
                <span
                  className={`ad-app-tag ${
                    a.test ? "ad-app-tag--ok" : "ad-app-tag--no"
                  }`}
                >
                  {a.test ? "тест пройден" : "тест не пройден"}
                </span>
                <div className="ad-app-cap" aria-hidden />
                <span className="ad-app-lvl">{levelLabel(a.level)}</span>
                <button
                  type="button"
                  className="ad-app-arrow"
                  aria-label={`Открыть заявку ${a.name}`}
                >
                  <svg
                    viewBox="0 0 32 18"
                    width="32"
                    height="18"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M30 9H3M10 2L3 9l7 7"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {(remainingApps > 0 || appsExpanded) && (
            <div className="ad-apps-footer">
              <button
                type="button"
                className={`ad-apps-expand ${appsExpanded ? "is-open" : ""}`}
                aria-label={appsExpanded ? "Свернуть" : "Показать больше"}
                aria-expanded={appsExpanded}
                onClick={() => setAppsExpanded((v) => !v)}
              >
                <svg
                  viewBox="0 0 32 16"
                  width="32"
                  height="16"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M4 4l12 10L28 4"
                    stroke="#1E1E1E"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {remainingApps > 0 && (
                <button
                  type="button"
                  className="ad-apps-more"
                  onClick={() => setAppsExpanded(true)}
                >
                  и еще {remainingApps}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ================== FOOTER ================== */}
      <SiteFooter supportHref="/support" />
    </div>
  )
}
