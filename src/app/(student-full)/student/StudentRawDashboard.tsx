"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import SiteFooter from "@/components/dashboard/SiteFooter"

/* ============================================================
   Student Dashboard — Raw English
   Pixel-perfect implementation of Figma «Ученик RAW english»
   (file YSwlSQF1n6QIpGTOohlMOd, node 2208:1427).
   Реальные данные из page.tsx (getCachedStudentDashboard),
   недостающие поля (баланс, чаты, лекторий) — placeholder,
   строго под макет.
   ============================================================ */

const NAV = [
  { href: "#schedule", label: "Расписание и календарь" },
  { href: "#homework", label: "Домашние задания" },
  { href: "#library", label: "Библиотека" },
  { href: "#chats", label: "Чаты" },
  { href: "#calls", label: "Звонки" },
]

/* Placeholder-чаты — реального loader-а в снапшоте пока нет.
   Оставляем моки, чтобы визуально секция соответствовала Figma. */
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

/* Placeholder-лекции — курсы/лекторий пока не завязаны на БД. */
const LECTORY_MAIN = {
  title: "Как составить резюме",
  author: "от Валерии Кратковской",
  desc: "Инструкция, как сделать так, чтобы было вот так, а не так, ведь важно, чтобы было именно вот так и никак иначе. Инструкция, как сделать так, чтобы было вот. Инструкция, как сделать так, чтобы было вот так, а не так, ведь важно, чтобы было именно вот так и никак иначе.",
  time: "16:24",
  date: "26.06.2026",
  tag: "CV",
}
const LECTORY_TALL = {
  title: "От Натальи Орейро",
  author: "от Ксении Фроловой",
  desc: "Путешествие — это целый мир, иногда, когда тебя спросят «A fork in the eye or once up the ass», лучше знать правильный ответ, находясь за границей. На этом курсе наш трэвел-блогер Ксения научит тебя путешествовать.",
  time: "16:24",
  date: "26.06.2026",
  tag: "Travel",
}
const LECTORY_LEFT = {
  title: "От Артура Гринина",
  desc: "Как говорится, так говорится, текста тут мало, ведь много и не поместится.",
  time: "12:20",
  date: "07.07.2026",
  tag: "Marketing",
}
const LECTORY_RIGHT = {
  title: "От Натальи Орейро",
  desc: "Как говорится, так говорится, текста тут мало, ведь много и не поместится.",
  time: "12:20",
  date: "07.07.2026",
  tag: "Tecnolodgy",
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function ArrowRight({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 18" fill="none" aria-hidden width={size} height={(size * 18) / 32}>
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
function Avatar({ name, src, className = "" }: { name: string; src?: string | null; className?: string }) {
  const [failed, setFailed] = useState(!src)
  if (!src || failed) {
    return (
      <div
        className={className}
        style={{
          background: paletteFor(name),
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "-0.02em",
        }}
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
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      onError={() => setFailed(true)}
    />
  )
}

interface StudentRawDashboardProps {
  studentId?: string
  firstName?: string
  lastName?: string
  avatarUrl?: string | null
  englishLevel?: string
  balance?: number
  lessonsThisYear?: number
  initialLessons?: Array<{
    id: string
    scheduledAt: string
    durationMinutes: number
    status: string
    teacherName: string | null
    teacherAvatar: string | null
    meetingUrl: string | null
  }>
}

export default function StudentRawDashboard({
  firstName = "Вадим",
  lastName = "Думович",
  avatarUrl,
  englishLevel = "Rare",
  balance = 14500,
  lessonsThisYear = 25,
  initialLessons = [],
}: StudentRawDashboardProps = {}) {
  const now = useClock()
  const timeStr = now
    ? now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
    : "16:24"
  const dateStr = now
    ? now.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "26.06.2026"

  const scheduleView = initialLessons.length > 0
    ? initialLessons.slice(0, 10).map((l) => {
        const d = new Date(l.scheduledAt)
        return {
          id: l.id,
          time: d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
          date: d.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "2-digit" }),
          label: l.teacherName ? `урок с ${l.teacherName}` : "Урок",
          callHref: l.meetingUrl,
        }
      })
    : [
        { id: "l1", time: "12:00", date: "29.09.26", label: "урок с Татьяной Владимировной", callHref: null },
        { id: "l2", time: "13:00", date: "29.09.26", label: "Лекция по заправке постели на английском", callHref: null },
        { id: "l3", time: "14:00", date: "29.09.26", label: "Винный вечер", callHref: null },
      ]

  const [topupAmount, setTopupAmount] = useState("")
  const [topupPhone, setTopupPhone] = useState("")

  return (
    <div className="st">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/raw-student.css?v=20260823-7" />

      {/* ================== HERO: nav + SCHEDULE ================== */}
      <div className="st-hero">
        <nav className="st-nav">
          <Link href="/student" className="st-brand" aria-label="Raw English">
            <img src="/landing/raw2/logo-raw-word-white.svg" alt="Raw English" />
          </Link>
          <ul className="st-nav-links">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href}>{n.label}</a>
              </li>
            ))}
          </ul>
          <div className="st-nav-right">
            <div className="st-nav-avatar">
              <Avatar name={`${firstName} ${lastName}`} src={avatarUrl} />
            </div>
            <div className="st-clock">
              <div className="time">{timeStr}</div>
              <div className="date">{dateStr}</div>
            </div>
          </div>
        </nav>

        <section id="schedule" className="st-schedule-wrap">
          <div className="st-badge-wrap">
            <span className="st-badge on-dark">
              <span className="c-lime">РАСПИСАНИЕ</span> И КАЛЕНДАРЬ
            </span>
          </div>
          <div className="st-schedule-list">
            {scheduleView.length === 0 ? (
              <div className="st-lesson-empty">На ближайшие 14 дней уроков нет</div>
            ) : (
              scheduleView.map((l) => (
                <div className="st-lesson" key={l.id}>
                  <div className="st-lesson-time">
                    <span className="hh">{l.time}</span>
                    <span className="dd">{l.date}</span>
                  </div>
                  <div className="st-lesson-label">{l.label}</div>
                  {l.callHref ? (
                    <a href={l.callHref} target="_blank" rel="noreferrer" className="st-lesson-call">
                      чат
                    </a>
                  ) : (
                    <button type="button" className="st-lesson-call">
                      чат
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="st-schedule-actions">
            <Link href="/student/schedule" className="st-sched-btn lime">
              открыть календарь
            </Link>
            <Link href="/student/schedule" className="st-sched-btn red">
              добавить урок
            </Link>
          </div>
        </section>
      </div>

      {/* ================== HOMEWORK + LIBRARY + HISTORY (lime bars) ================== */}
      <section id="homework" className="st-bars-section">
        <div className="st-badge-wrap">
          <span className="st-badge on-light-dark-outline">
            ДОМАШНИЕ ЗАДАНИЯ И <span className="c-red">БИБЛИОТЕКА</span>
          </span>
        </div>
        <div className="st-bars">
          <Link href="/student/homework" className="st-bar">
            Домашние задания
            <span className="st-bar-arrow" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </Link>
          <Link href="/student/materials" className="st-bar" id="library">
            Библиотека <span className="c-red">Raw English</span>
            <span className="st-bar-arrow" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </Link>
          <Link href="/student/summaries" className="st-bar">
            История занятий
            <span className="st-bar-arrow" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </Link>
        </div>
      </section>

      {/* ================== CHATS ================== */}
      <section id="chats" className="st-chats-section">
        <div className="st-badge-wrap">
          <span className="st-badge on-dark">ЧАТЫ</span>
        </div>
        <div className="st-chats">
          {CHATS.map((c) => (
            <div key={c.id} className={`st-chat ${c.group ? "group" : ""}`}>
              {c.unread && <div className="st-chat-badge">1 новое сообщение</div>}
              <div className="st-chat-avatar">
                <Avatar name={c.name} src={c.avatar} />
              </div>
              <div className="st-chat-body">
                <div className="st-chat-name">{c.name}</div>
                <div className="st-chat-preview">
                  {c.group && (c as any).from && <b>{(c as any).from}</b>}
                  {c.preview}
                </div>
              </div>
              <button type="button" className="st-chat-arrow" aria-label="Открыть чат">
                <ArrowRight size={26} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ================== LECTORY (lime) ================== */}
      <section id="calls" className="st-lectory-section">
        <div className="st-badge-wrap">
          <span className="st-badge on-light-dark-outline">
            РАСПИСАНИЕ <span className="c-red">ЛЕКТОРИЯ</span>
          </span>
        </div>
        <div className="st-lectory-grid">
          <div className="st-lect-card">
            <div className="st-lect-title">{LECTORY_MAIN.title}</div>
            <div className="st-lect-author">{LECTORY_MAIN.author}</div>
            <p className="st-lect-desc">{LECTORY_MAIN.desc}</p>
            <div className="st-lect-badges">
              <span className="st-lect-tag">{LECTORY_MAIN.tag}</span>
              <span className="st-lect-time">{LECTORY_MAIN.time}</span>
              <span className="st-lect-tag">{LECTORY_MAIN.date}</span>
            </div>
          </div>

          <div className="st-lect-card red tall">
            <div className="st-lect-title">{LECTORY_TALL.author}</div>
            <p className="st-lect-desc">{LECTORY_TALL.desc}</p>
            <div className="st-lect-badges">
              <span className="st-lect-tag">{LECTORY_TALL.tag}</span>
              <span className="st-lect-time">{LECTORY_TALL.time}</span>
              <span className="st-lect-tag">{LECTORY_TALL.date}</span>
            </div>
          </div>

          <div className="st-lect-card red">
            <div className="st-lect-title">{LECTORY_LEFT.title}</div>
            <p className="st-lect-desc">{LECTORY_LEFT.desc}</p>
            <div className="st-lect-badges">
              <span className="st-lect-tag">{LECTORY_LEFT.tag}</span>
              <span className="st-lect-time">{LECTORY_LEFT.time}</span>
              <span className="st-lect-tag">{LECTORY_LEFT.date}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================== BALANCE + STATS ================== */}
      <section id="balance" className="st-balance-section">
        <div className="st-balance-grid">
          <div className="st-balance-card">
            <div className="st-bal-head">
              <div className="st-bal-avatar">
                <Avatar name={`${firstName} ${lastName}`} src={avatarUrl} />
              </div>
              <div>
                <div className="st-bal-caption">ваш баланс</div>
                <div className="st-bal-name">
                  <span>{firstName}</span>
                  {lastName && <span>{lastName}</span>}
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "center" }}>
                <div className="st-bal-value">
                  {balance.toLocaleString("ru-RU")}
                  <small>рублей</small>
                </div>
              </div>
            </div>

            <div className="st-bal-stats">
              <div className="st-bal-stat">
                <div className="st-bal-stat-label">
                  Количество занятий с начала года
                </div>
                <div className="st-bal-stat-value">{lessonsThisYear}</div>
              </div>
              <div className="st-bal-stat">
                <div className="st-bal-stat-label">Количество лекций</div>
                <div className="st-bal-stat-value">3</div>
              </div>
              <div className="st-bal-stat">
                <div className="st-bal-stat-label">Участие в клубах по интересам</div>
                <div className="st-bal-stat-value">2</div>
              </div>
            </div>

            <Link href="/student/balance" className="st-bal-topup">
              ПОПОЛНИТЬ БАЛАНС
            </Link>
          </div>

          <div className="st-bal-side">
            <div className="st-topup-card">
              <h3>Пополнение баланса</h3>
              <input
                type="tel"
                className="st-topup-input"
                placeholder="введите сумму"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
              />
              <input
                type="tel"
                className="st-topup-input"
                placeholder="номер телефона"
                value={topupPhone}
                onChange={(e) => setTopupPhone(e.target.value)}
              />
              <button type="button" className="st-topup-btn">
                Оплатить
              </button>
              <p className="st-topup-hint">
                Соглашаясь отправить, вы даёте согласие на обработку персональных данных.
              </p>
            </div>

            <div className="st-level-card">
              <h3>Ваш уровень</h3>
              <div className="st-level-badge">{englishLevel}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================== FOOTER ================== */}
      <SiteFooter supportHref="/student/support" />
    </div>
  )
}
