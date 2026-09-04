"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowIcon } from "@/components/icons/ArrowIcon"
import { CheckIcon } from "@/components/icons/CheckIcon"

// Fallback-моки вопросов если у заявки нет testAnswers (маловероятно —
// fetchTrialApplicationsForAdmin фильтрует по test=true).
const SAMPLE_QUESTIONS_ADMIN = [
  { text: ["When I got to work", "I remembered that ___", "my mobile at home."], options: ["a) I'd leave", "b) I was leaving", "c) I'd left", "d) I left"], correct: 2, chosen: 2 },
  { text: ["My father ___", "be a builder."], options: ["a) used to", "b) was", "c) use to", "d) did use to"], correct: 0, chosen: 1 },
  { text: ["___ I worked hard,", "I didn't pass the test."], options: ["a) Although", "b) So", "c) Because", "d) But"], correct: 0, chosen: 0 },
]
const Q_PER_PAGE_ADMIN = 3
import Link from "next/link"
import SiteFooter from "@/components/dashboard/SiteFooter"
import { HwPillList } from "@/components/dashboard/HwPillList"
import { ApplicationRow } from "@/components/dashboard/ApplicationRow"
import ChatModal from "@/components/dashboard/ChatModal"
import { FilesModal, type FileItem } from "@/components/dashboard/FilesModal"
import type { ChatListItem } from "@/lib/chat/list"
import AdminAddLessonModal from "./AdminAddLessonModal"
import AdminAddLectureModal from "./AdminAddLectureModal"
import AdminStudentModal from "./AdminStudentModal"
import {
  ArrowDown as AlmArrowDown,
  ArrowLeftLime as AlmArrowLeftLime,
  CloseIcon as AlmCloseIcon,
  type AddLessonStudent,
} from "@/app/(teacher-full)/teacher/AddLessonModal"

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
  return <ArrowIcon direction="right" size={size} />
}

// Круглая стрелка ← 79×79 (лаймовая заливка + белая обводка), точно
// по SVG из макета — используется в carousel учителей и в модалке.
function CarouselArrow() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="79" height="79" viewBox="0 0 79 79" fill="none" aria-hidden>
      <circle cx="39.5" cy="39.5" r="37.5" transform="rotate(-180 39.5 39.5)" fill="#DFED8C" stroke="white" strokeWidth="4"/>
      <path d="M56 41.5C57.3807 41.5 58.5 40.3807 58.5 39C58.5 37.6193 57.3807 36.5 56 36.5L56 39L56 41.5ZM22.2322 37.2322C21.2559 38.2085 21.2559 39.7915 22.2322 40.7678L38.1421 56.6777C39.1184 57.654 40.7014 57.654 41.6777 56.6777C42.654 55.7014 42.654 54.1184 41.6777 53.1421L27.5355 39L41.6777 24.8579C42.654 23.8816 42.654 22.2986 41.6777 21.3223C40.7014 20.346 39.1184 20.346 38.1421 21.3223L22.2322 37.2322ZM56 39L56 36.5L24 36.5L24 39L24 41.5L56 41.5L56 39Z" fill="#1E1E1E"/>
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

function pluralize(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

interface AdminRawDashboardProps {
  adminUserId?: string
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
    createdAt?: string
    testAnswers?: Array<{
      text: string
      options: string[]
      chosen: number
      correct: number
      lvl?: 1 | 2 | 3 | 4
    }>
  }>
  upcomingLessons?: Array<{
    id: string
    scheduledAt: string
    title: string
    studentName?: string | null
    teacherName?: string | null
    teacherUserId?: string | null
    studentId?: string | null
  }>
  initialChats?: ChatListItem[]
}

export default function AdminRawDashboard({
  adminUserId,
  teachers,
  students,
  applications,
  upcomingLessons,
  initialChats,
}: AdminRawDashboardProps = {}) {
  const [chatPeer, setChatPeer] = useState<
    | { id: string; role: "teacher" | "student" | "admin"; name: string; avatar: string | null }
    | null
  >(null)
  const [chatUnreadOverride, setChatUnreadOverride] = useState<Record<string, number>>({})

  // Teacher-carousel: index первой видимой карточки (шаг 1 при клике на стрелку)
  const [teacherPage, setTeacherPage] = useState(0)
  const TEACHERS_PER_PAGE = 3
  const [teacherModal, setTeacherModal] = useState<{ id: string; name: string; avatar: string | null } | null>(null)

  // Библиотека и ДЗ — modals. Админ видит ВСЁ (через service_role, минуя RLS).
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [homeworkOpen, setHomeworkOpen] = useState(false)
  const [libraryFiles, setLibraryFiles] = useState<FileItem[]>([])
  const [homeworkFiles, setHomeworkFiles] = useState<FileItem[]>([])
  const [hwUploadTarget, setHwUploadTarget] = useState<string | null>(null)
  const [hwUploading, setHwUploading] = useState(false)
  const hwFileRef = useRef<HTMLInputElement | null>(null)
  const [homeworkVersion, setHomeworkVersion] = useState(0)
  const [libraryVersion, setLibraryVersion] = useState(0)
  const [libraryUploading, setLibraryUploading] = useState(false)

  async function handleAdminLibraryUpload(file: File) {
    if (file.size > 50 * 1024 * 1024) { alert("Файл больше 50 МБ"); return }
    setLibraryUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/library/upload", { method: "POST", body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      setLibraryVersion((v) => v + 1) // рефетч списка
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setLibraryUploading(false)
    }
  }

  // Добавить событие (урок или лекция)
  const [eventModalOpen, setEventModalOpen] = useState(false)

  // Создание группы
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupTeacherId, setGroupTeacherId] = useState<string>("")
  const [groupStudentSel, setGroupStudentSel] = useState<Set<string>>(new Set())
  const [groupSubmitting, setGroupSubmitting] = useState(false)
  const [groupError, setGroupError] = useState<string | null>(null)
  const [groupSuccess, setGroupSuccess] = useState(false)
  // Список teacher_profiles (id + user_id + full_name) — грузим при первом открытии.
  const [teacherProfiles, setTeacherProfiles] = useState<Array<{ id: string; name: string }>>([])
  useEffect(() => {
    if (!groupModalOpen || teacherProfiles.length > 0) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch("/api/booking/teachers", { cache: "no-store" })
        if (!r.ok) return
        const j = await r.json()
        if (cancelled) return
        setTeacherProfiles((j.teachers ?? []).map((t: any) => ({ id: t.teacherProfileId, name: t.name })))
      } catch (e) { console.error("[admin groups] teachers fetch", e) }
    })()
    return () => { cancelled = true }
  }, [groupModalOpen, teacherProfiles.length])

  async function submitCreateGroup() {
    const trimmed = groupName.trim()
    if (!trimmed || !groupTeacherId || groupStudentSel.size < 1 || groupSubmitting) return
    setGroupSubmitting(true); setGroupError(null)
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          teacher_id: groupTeacherId,
          student_ids: Array.from(groupStudentSel),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setGroupError(j.error || "Не удалось создать группу")
        return
      }
      setGroupSuccess(true)
      setTimeout(() => {
        setGroupModalOpen(false)
        setGroupSuccess(false)
        setGroupName("")
        setGroupTeacherId("")
        setGroupStudentSel(new Set())
      }, 2000)
    } catch (e) {
      setGroupError(e instanceof Error ? e.message : "Не удалось создать группу")
    } finally {
      setGroupSubmitting(false)
    }
  }

  useEffect(() => {
    if (!libraryOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/materials?limit=200", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setLibraryFiles(
          (data.materials ?? []).map((m: any) => {
            const isSigned = !!m.file_url && /\/storage\/v1\/object\/sign\//.test(m.file_url)
            const openUrl = m.signed_url || (isSigned ? null : m.file_url)
            return {
              id: m.id,
              name: m.title,
              status: "loaded" as const,
              onOpen: openUrl ? () => window.open(openUrl, "_blank") : undefined,
            }
          }),
        )
      } catch (e) { console.error("[admin library]", e) }
    })()
    return () => { cancelled = true }
  }, [libraryOpen, libraryVersion])

  useEffect(() => {
    if (!homeworkOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/homework?limit=200", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setHomeworkFiles(
          (data.materials ?? []).map((m: any) => ({
            id: m.id,
            name: `${m.title}${m.student_name ? ` → ${m.student_name}` : ""}`,
            status: "loaded" as const,
            onOpen: m.signed_url ? () => window.open(m.signed_url, "_blank") : undefined,
          })),
        )
      } catch (e) { console.error("[admin homework]", e) }
    })()
    return () => { cancelled = true }
  }, [homeworkOpen, homeworkVersion])

  async function handleAdminHwUpload(file: File) {
    if (!hwUploadTarget) {
      alert("Сначала выберите ученика")
      return
    }
    if (file.size > 25 * 1024 * 1024) { alert("Файл больше 25 МБ"); return }
    setHwUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("studentId", hwUploadTarget)
      const res = await fetch("/api/admin/homework/upload", { method: "POST", body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      setHomeworkVersion((v) => v + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setHwUploading(false)
    }
  }
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
  // Только реальные заявки — никаких моков (иначе кажется что бэк не работает).
  const appsData = applications ?? []

  const sortedStudents = useMemo(() => {
    const arr = [...studentsData]
    if (sortId === "az") arr.sort((a, b) => a.name.localeCompare(b.name, "ru"))
    else if (sortId === "time") arr.reverse()
    else arr.sort((a, b) => a.level.localeCompare(b.level))
    return arr
  }, [sortId, studentsData])

  const [appsExpanded, setAppsExpanded] = useState(false)
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null)
  const [qPage, setQPage] = useState(0)
  useEffect(() => { setQPage(0) }, [expandedAppId])

  // Инлайн-редактирование уровня в шапке заявки (Figma 2505:3532):
  // клик по иконке-карандашу заменяет имя+уровень на pill с A1..C2.
  const [editingLvlAppId, setEditingLvlAppId] = useState<string | null>(null)
  const [savingLvl, setSavingLvl] = useState(false)
  // Локальный оверрайд уровня — чтобы UI сразу отражал выбор до перезагрузки.
  const [levelOverride, setLevelOverride] = useState<Record<string, string>>({})

  // Модалка «Назначить учителя» (Figma 2505:264) + окно подтверждения (2505:2852).
  const [assignForApp, setAssignForApp] = useState<{ id: string; name: string } | null>(null)
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignPickedTeacherId, setAssignPickedTeacherId] = useState<string | null>(null)
  const [assignConfirm, setAssignConfirm] = useState<{ studentName: string; teacherName: string } | null>(null)
  useEffect(() => { if (!assignForApp) setAssignPickedTeacherId(null) }, [assignForApp])
  // После назначения заявка должна пропасть у админа (у учителя появится).
  const [hiddenAppIds, setHiddenAppIds] = useState<Set<string>>(new Set())
  // Автозакрытие подтверждения через 59с (как «0:59» в макете).
  const [assignConfirmSec, setAssignConfirmSec] = useState(59)
  useEffect(() => {
    if (!assignConfirm) return
    setAssignConfirmSec(59)
    const id = setInterval(() => {
      setAssignConfirmSec((s) => {
        if (s <= 1) { setAssignConfirm(null); return 59 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [assignConfirm])

  async function saveLevel(appId: string, cefr: string) {
    setSavingLvl(true)
    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(appId)}/level`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ level: cefr }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setLevelOverride((prev) => ({ ...prev, [appId]: cefr }))
      setEditingLvlAppId(null)
    } catch (e) {
      console.error('[admin] set level failed', e)
      alert('Не удалось сохранить уровень')
    } finally {
      setSavingLvl(false)
    }
  }

  async function assignTeacher(teacherId: string, teacherName: string) {
    if (!assignForApp) return
    setAssignSaving(true)
    try {
      const res = await fetch(`/api/admin/applications/${encodeURIComponent(assignForApp.id)}/assign`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teacherId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || String(res.status))
      }
      setAssignConfirm({ studentName: assignForApp.name, teacherName })
      // Удаляем эту заявку из UI — админ её обработал.
      setHiddenAppIds((prev) => { const next = new Set(prev); next.add(assignForApp.id); return next })
      if (expandedAppId === assignForApp.id) setExpandedAppId(null)
      setAssignForApp(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      alert(`Не удалось назначить учителя: ${msg}`)
    } finally {
      setAssignSaving(false)
    }
  }
  const expandedApp = expandedAppId
    ? (applications ?? []).find((a) => a.id === expandedAppId)
    : null
  type UiQ = { text: string[]; options: string[]; chosen: number; correct: number }
  const questions: UiQ[] = useMemo(() => {
    if (expandedApp?.testAnswers && expandedApp.testAnswers.length > 0) {
      return expandedApp.testAnswers.map((it) => ({
        text: [it.text], options: it.options, chosen: it.chosen, correct: it.correct,
      }))
    }
    return SAMPLE_QUESTIONS_ADMIN
  }, [expandedApp])
  const qTotalPages = Math.max(1, Math.ceil(questions.length / Q_PER_PAGE_ADMIN))
  const currentQuestions = questions.slice(qPage * Q_PER_PAGE_ADMIN, (qPage + 1) * Q_PER_PAGE_ADMIN)
  const [studentModal, setStudentModal] = useState<
    | { id: string; name: string; avatar: string | null; level: string }
    | null
  >(null)
  const visibleAppsPool = appsData.filter((a) => !hiddenAppIds.has(a.id))
  const visibleApps = appsExpanded
    ? visibleAppsPool
    : visibleAppsPool.slice(0, APPLICATIONS_VISIBLE)
  const remainingApps = visibleAppsPool.length - visibleApps.length

  useEffect(() => {
    if (!sortOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest?.(".ad-sort-wrap")) setSortOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [sortOpen])

  // Render schedule from real lessons — увеличили окно до 10 и добавили
  // имена учителя+ученика чтобы админ сразу видел кто с кем.
  const scheduleView = (upcomingLessons ?? []).slice(0, 10).map((l) => {
    const d = new Date(l.scheduledAt)
    const time = d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
    const date = d.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "2-digit" })
    const label = l.studentName && l.teacherName
      ? `${l.studentName} → ${l.teacherName}`
      : l.studentName ?? l.teacherName ?? l.title
    return { id: l.id, time, date, label, teacherUserId: l.teacherUserId ?? null, studentId: l.studentId ?? null }
  })

  return (
    <div className="ad">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="/dashboard/raw-admin.css?v=20260902-libgap"
      />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/shared-pills.css?v=1" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/files-modal.css?v=1" />
      {/* teacher-css нужен для .tr-add-lesson-* (модалка «Добавить событие»
          у админа переиспользует UI из teacher). */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/raw-teacher.css?v=20260903-checkinline" />

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
                {scheduleView.map((l) => {
                  const isLecture = String(l.id).startsWith("lec:")
                  const lectureId = isLecture ? String(l.id).slice(4) : null
                  const roomHref = isLecture ? `/lecture/${lectureId}` : `/lesson/${l.id}`
                  const canChat = !!l.studentId || !!l.teacherUserId
                  return (
                    <div className="ad-lesson" key={l.id}>
                      <div className="ad-lesson-time">
                        <div className="hh">{l.time}</div>
                        <div className="dd">{l.date}</div>
                      </div>
                      <div className="ad-lesson-label">{l.label}</div>
                      {canChat && (
                        <button
                          type="button"
                          className="ad-lesson-chat"
                          title="Открыть чат"
                          onClick={() => {
                            // Приоритет ученик > учитель — админ чаще пишет ученику.
                            if (l.studentId) {
                              setChatPeer({ id: l.studentId, role: "student", name: l.label, avatar: null })
                            } else if (l.teacherUserId) {
                              setChatPeer({ id: l.teacherUserId, role: "teacher", name: l.label, avatar: null })
                            }
                          }}
                        >
                          чат
                        </button>
                      )}
                      {roomHref && (
                        <a
                          className="ad-lesson-call"
                          href={roomHref}
                          title="Присоединиться к звонку (комната откроется за 5 мин до начала)"
                          aria-label="Начать звонок"
                        >
                          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
                            <path d="M4.5 5.5c0-.55.45-1 1-1h2.7c.44 0 .82.29.95.71l1.14 3.62c.13.42-.01.88-.36 1.16l-1.63 1.3c1.13 2.24 2.99 4.1 5.23 5.23l1.3-1.63c.28-.35.74-.49 1.16-.36l3.62 1.14c.42.13.71.51.71.95v2.7c0 .55-.45 1-1 1C10.1 20.32 3.68 13.9 3.68 5.5" fill="#fff" />
                          </svg>
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="ad-hero-cta">
            <button type="button" className="ad-create-btn" onClick={() => setEventModalOpen(true)}>
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
        <HwPillList
          items={[
            { label: "Домашние задания", onClick: () => setHomeworkOpen(true) },
            { label: <>Библиотека <span className="raw">Raw English</span></>, onClick: () => setLibraryOpen(true) },
            { label: "История занятий", href: "/admin/history" },
          ]}
        />
      </section>

      {/* ================== CHATS ==================
          Верстка 1:1 как у учителя — переиспользуем .tr-chats-* / .tr-chat-row-*.
          Обёрнуто в <div className="tr">, чтобы правила из raw-teacher.css
          применились. Групповые чаты рендерим тоже (админ входит в них как обычный
          участник). Кнопка «Создать группу» — под списком. */}
      <div className="tr">
      <section id="chats" className="tr-section">
        <div className="tr-chats-frame">
          <div className="tr-chats-badge">ЧАТЫ</div>

          <div className="tr-chats-card tr-chats-card--flow">
            {(!initialChats || initialChats.length === 0) && (
              <div className="tr-chats-empty">Пока нет ни одного чата.</div>
            )}

            {initialChats?.filter((c) => c.kind === "direct").length === 0 &&
              initialChats && initialChats.length > 0 && (
                <div className="tr-chats-empty">Пока нет 1:1 чатов.</div>
              )}
            {initialChats?.map((c) => {
              if (c.kind === "direct") {
                const cnt = chatUnreadOverride[c.peerId] ?? c.unreadCount
                return (
                  <div
                    key={`d:${c.peerId}`}
                    className={`tr-chat-row tr-chat-row--lime${cnt > 0 ? " tr-chat-row--unread" : ""}`}
                  >
                    {cnt > 0 && (
                      <div className="tr-chat-badge">
                        {cnt} {pluralize(cnt, "новое", "новых", "новых")}{" "}
                        {pluralize(cnt, "сообщение", "сообщения", "сообщений")}
                      </div>
                    )}
                    <div className="tr-chat-avatar-big">
                      {c.peerAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.peerAvatar} alt="" />
                      ) : (
                        <div className="tr-chat-avatar-fallback">
                          {c.peerName
                            .split(" ")
                            .filter(Boolean)
                            .map((p) => p[0]?.toUpperCase())
                            .join("")
                            .slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="tr-chat-name">{c.peerName}</div>
                    <div className="tr-chat-preview">
                      {c.lastSenderIsMe && <b>Вы: </b>}
                      {c.lastText || "Нет сообщений"}
                    </div>
                    <button
                      type="button"
                      className="tr-chat-arrow-btn tr-chat-arrow-btn--red"
                      aria-label={`Открыть чат с ${c.peerName}`}
                      onClick={() => {
                        setChatUnreadOverride((s) => ({ ...s, [c.peerId]: 0 }))
                        setChatPeer({
                          id: c.peerId,
                          role: c.peerRole,
                          name: c.peerName,
                          avatar: c.peerAvatar,
                        })
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/dashboard/chats/arrow-icon-white.svg" alt="" aria-hidden />
                    </button>
                  </div>
                )
              }
              return null
            })}
          </div>
        </div>

        {/* Кнопка «Создать группу» — под фреймом (tr-chats-frame имеет фикс. высоту
            1008px с абсолютно позиционированными badge/card, поэтому footer должен
            быть снаружи, иначе он «уезжает» в top-left). */}
        <div className="ad-chats-footer">
          <button type="button" className="ad-create-btn" onClick={() => setGroupModalOpen(true)}>
            Создать группу
            <span className="ad-arrow-btn" aria-hidden>
              <ArrowRight size={28} />
            </span>
          </button>
        </div>
      </section>
      </div>

      {/* ================== TEACHERS (Figma 2208-62 / 2208-1406 / 2208-1408) ================== */}
      <section id="teachers" className="ad-section">
        <div className="ad-badge-wrap">
          <span className="ad-badge">
            СПИСОК <span className="c-red">УЧИТЕЛЕЙ</span>
          </span>
        </div>
        <div className="ad-teachers-wrap">
          {teacherPage > 0 && (
            <button
              type="button"
              className="ad-teachers-arrow ad-teachers-arrow--left"
              onClick={() => setTeacherPage((p) => Math.max(0, p - 1))}
              aria-label="Предыдущие"
            >
              <CarouselArrow />
            </button>
          )}
          <div className="ad-teachers">
            {teachersData
              .slice(teacherPage, teacherPage + TEACHERS_PER_PAGE)
              .map((t) => (
                <div
                  className="ad-teacher"
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTeacherModal({ id: t.id, name: t.name, avatar: t.avatar })}
                >
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
                    <button
                      type="button"
                      className="ad-teacher-edit"
                      aria-label="Редактировать"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTeacherModal({ id: t.id, name: t.name, avatar: t.avatar })
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
                        <path d="M3 21h4l11-11-4-4L3 17v4z" stroke="#1E1E1E" strokeWidth="2" strokeLinejoin="round" fill="none" />
                        <path d="M14 6l4 4" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
          </div>
          {teacherPage + TEACHERS_PER_PAGE < teachersData.length && (
            <button
              type="button"
              className="ad-teachers-arrow ad-teachers-arrow--right"
              onClick={() => setTeacherPage((p) => Math.min(teachersData.length - TEACHERS_PER_PAGE, p + 1))}
              aria-label="Следующие"
            >
              <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}>
                <CarouselArrow />
              </span>
            </button>
          )}
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
                {sortedStudents.map((s) => {
                  // A1..C2 → 1..6 огоньков закрашено.
                  const CEFR = ["A1","A2","B1","B2","C1","C2"] as const
                  const cefr = String(s.level ?? "A1").toUpperCase()
                  const litCount = Math.max(0, Math.min(6, (CEFR as readonly string[]).indexOf(cefr) + 1))
                  return (
                  <div
                    className="ad-stu"
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                    onClick={() => setStudentModal({ id: s.id, name: s.name, avatar: s.avatar, level: s.level })}
                  >
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
                    <div className="ad-stu-flames" aria-label={`Уровень ${cefr}`}>
                      {[0,1,2,3,4,5].map((i) => (
                        <svg key={i} className={`ad-stu-flame${i < litCount ? " lit" : ""}`} viewBox="0 0 24 24" width="14" height="16" aria-hidden>
                          <path d="M12 2c1 3-2 4-2 7 0 2 1 3 2 4 2-2 5-5 5-9-1 1-2 1-3 0-1 1-1 2-2-2zm0 11c-3 0-6 3-6 6 0 3 3 5 6 5s6-2 6-5c0-3-3-6-6-6z" fill="currentColor"/>
                        </svg>
                      ))}
                    </div>
                    <span className="ad-stu-lvl">{levelLabel(s.level)}</span>
                  </div>
                )})}
              </div>
            </div>
            <div className="ad-panel-footer">
              <button type="button" className="ad-create-btn" onClick={() => setGroupModalOpen(true)}>
                Создать группу
                <span className="ad-arrow-btn" aria-hidden>
                  <ArrowRight size={28} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================== INCOMING APPLICATIONS (UI 1:1 как у учителя) ================== */}
      {/* Оборачиваем в .tr чтобы применились teacher CSS (.tr-section, .tr-badge-wrap,
          .tr-sub, .tr-apps, .tr-app*). Без .tr-обёртки .tr-*  селекторы не сработают. */}
      <div className="tr">
      <section id="leads" className="tr-section">
        <div className="tr-badge-wrap">
          <span className="tr-badge">
            ВХОДЯЩИЕ ЗАЯВКИ <span className="c-red">УЧЕНИКОВ</span>
          </span>
        </div>
        <p className="tr-sub">Ученики, с которыми нужно назначить пробное занятие.</p>
          {appsData.length === 0 ? (
            <div className="tr-apps-empty" role="status">
              <img
                className="tr-apps-empty-icon"
                src="/dashboard/empty-states/no-students.svg"
                alt=""
                aria-hidden
              />
              <div className="tr-apps-empty-title">На данный момент заявок нет.</div>
              <div className="tr-apps-empty-sub">
                Проверяйте страницу несколько раз в день,<br />
                чтобы не пропустить учеников.
              </div>
            </div>
          ) : (
            <div className="tr-apps">
              <div className="tr-apps-list">
                {visibleApps.map((a) => {
                  const isOpen = expandedAppId === a.id
                  const isEditingLvl = isOpen && editingLvlAppId === a.id
                  const displayLevel = levelOverride[a.id] ?? a.level
                  return (
                    <div className={`tr-app${isOpen ? " tr-app--open" : ""}${isEditingLvl ? " tr-app--edit-lvl" : ""}`} key={a.id}>
                      <span className="tr-app-name">{a.name}</span>
                      {!isOpen && (
                        <span className={`tr-app-tag ${a.test ? "tr-app-tag--ok" : "tr-app-tag--no"}`}>
                          {a.test ? "тест пройден" : "тест не пройден"}
                        </span>
                      )}
                      <div className="tr-app-cap" aria-hidden />
                      {isEditingLvl ? (
                        <div className="tr-app-lvl-pill" role="listbox" aria-label="Выберите уровень">
                          {(["A1","A2","B1","B2","C1","C2"] as const).map((lv) => (
                            <button
                              key={lv}
                              type="button"
                              className={`tr-app-lvl-pill-btn${lv === displayLevel ? " active" : ""}`}
                              disabled={savingLvl}
                              onClick={() => saveLevel(a.id, lv)}
                              aria-selected={lv === displayLevel}
                            >
                              {lv}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <>
                          {isOpen && (
                            <button
                              type="button"
                              className="tr-app-lvl-edit"
                              aria-label="Изменить уровень"
                              onClick={() => setEditingLvlAppId(a.id)}
                            >
                              <img src="/dashboard/icons/edit-level.svg" width={30} height={30} alt="" aria-hidden />
                            </button>
                          )}
                          <span className="tr-app-lvl">{levelLabel(displayLevel)}</span>
                        </>
                      )}
                      <button
                        type="button"
                        className="tr-app-arrow"
                        aria-label={isOpen ? "Свернуть" : `Открыть заявку ${a.name}`}
                        aria-expanded={isOpen}
                        onClick={() => { if (isEditingLvl) setEditingLvlAppId(null); setExpandedAppId(isOpen ? null : a.id) }}
                      >
                        {isOpen ? (
                          <svg viewBox="0 0 32 20" width="24" height="15" fill="none" aria-hidden>
                            <path d="M2 5l14 12L30 5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <ArrowIcon direction="left" size={32} style={{ color: "#1E1E1E" }} />
                        )}
                      </button>
                      {isOpen && (
                        <>
                          <div className="tr-app-questions">
                            {qTotalPages > 1 && (
                              <button type="button" className="tr-q-prev" aria-label="Предыдущие"
                                onClick={() => setQPage((p) => (p - 1 + qTotalPages) % qTotalPages)}>
                                <ArrowIcon direction="left" size={24} style={{ color: "#1E1E1E" }} />
                              </button>
                            )}
                            {currentQuestions.map((q, i) => (
                              <div className="tr-q" key={qPage * Q_PER_PAGE_ADMIN + i}>
                                <div className="tr-q-label">Вопрос {qPage * Q_PER_PAGE_ADMIN + i + 1}</div>
                                <div className="tr-q-text">
                                  {q.text.map((line, j) => (
                                    <span key={j} className="tr-q-line">{line}</span>
                                  ))}
                                </div>
                                <ul className="tr-q-opts">
                                  {q.options.map((opt, k) => {
                                    const isChosen = k === q.chosen
                                    const isCorrect = q.chosen === q.correct
                                    // Если в реальных данных option уже начинается с "a)/b)/c)/d)"
                                    // — не дублируем префикс, иначе добавляем.
                                    const hasPrefix = /^[a-dA-D][\)\.]/.test(opt.trim())
                                    const prefix = String.fromCharCode(97 + k) + ") "
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
                                        {hasPrefix ? opt : prefix + opt}
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            ))}
                            {qTotalPages > 1 && (
                              <button type="button" className="tr-q-next"
                                aria-label={`Следующие (${qPage + 1}/${qTotalPages})`}
                                onClick={() => setQPage((p) => (p + 1) % qTotalPages)}>
                                <ArrowIcon direction="right" size={24} style={{ color: "#1E1E1E" }} />
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            className="tr-app-assign"
                            onClick={() => setAssignForApp({ id: a.id, name: a.name })}
                          >
                            Назначить учителя
                          </button>
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
                    <button type="button" className="tr-apps-more"
                      onClick={() => setAppsExpanded(true)}>
                      и еще {remainingApps}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
      </section>
      </div>

      {/* ================== FOOTER ================== */}
      <SiteFooter supportHref="/admin/support" />

      {chatPeer && (
        <ChatModal
          peerId={chatPeer.id}
          peerRole={chatPeer.role}
          peerName={chatPeer.name}
          peerAvatar={chatPeer.avatar ?? undefined}
          currentUserId={adminUserId}
          currentRole="admin"
          onClose={() => setChatPeer(null)}
        />
      )}

      {libraryOpen && (
        <FilesModal
          title="Библиотека Raw English"
          files={libraryFiles}
          onClose={() => setLibraryOpen(false)}
          addLabel={libraryUploading ? "Загружаем…" : "Добавить файл"}
          onFilePicked={handleAdminLibraryUpload}
        />
      )}

      {homeworkOpen && !hwUploadTarget && (
        <FilesModal
          title="Домашние задания (все ученики)"
          files={homeworkFiles}
          onClose={() => setHomeworkOpen(false)}
          onFilePicked={() => {
            // Открываем picker: сначала выберите ученика
            setHomeworkOpen(false)
            setTimeout(() => (window as any).__openHwPicker?.(), 50)
          }}
          addLabel="Загрузить для ученика"
        />
      )}

      {hwUploadTarget && (
        <FilesModal
          title={`Загрузка ДЗ для: ${sortedStudents.find((s) => s.id === hwUploadTarget)?.name ?? "ученика"}`}
          files={homeworkFiles.filter((f) => f.name.includes(sortedStudents.find((s) => s.id === hwUploadTarget)?.name ?? "__none__"))}
          onClose={() => setHwUploadTarget(null)}
          onFilePicked={handleAdminHwUpload}
          addLabel={hwUploading ? "Загружаем…" : "Загрузить файл"}
        />
      )}

      {/* Модалка выбора ученика — открывается когда админ кликнул «Загрузить для ученика» */}
      <HwStudentPickerBridge
        students={sortedStudents}
        onPick={(id) => setHwUploadTarget(id)}
      />

      {/* Модалка карточки учителя (Figma 2208-62) — реальные данные + upload фото */}
      {teacherModal && (
        <TeacherDetailModal
          teacherId={teacherModal.id}
          fallbackName={teacherModal.name}
          fallbackAvatar={teacherModal.avatar}
          onClose={() => setTeacherModal(null)}
          onPrev={() => {
            const idx = teachersData.findIndex((t) => t.id === teacherModal.id)
            if (idx > 0) {
              const p = teachersData[idx - 1]
              setTeacherModal({ id: p.id, name: p.name, avatar: p.avatar })
            }
          }}
          onNext={() => {
            const idx = teachersData.findIndex((t) => t.id === teacherModal.id)
            if (idx >= 0 && idx < teachersData.length - 1) {
              const n = teachersData[idx + 1]
              setTeacherModal({ id: n.id, name: n.name, avatar: n.avatar })
            }
          }}
        />
      )}

      {/* «Назначить учителя» — модалка со списком учителей (Figma 2505:264).
          После клика по учителю патчим trial_lesson_requests.assigned_teacher_id
          и показываем окно подтверждения (Figma 2505:2852). */}
      {assignForApp && (
        <div className="tr-assign-overlay" onClick={() => setAssignForApp(null)}>
          <div className="tr-assign-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="tr-assign-title">
              <span>Список&nbsp;</span>
              <span className="tr-assign-title--red">учителей</span>
            </div>
            <button type="button" className="tr-assign-close" aria-label="Закрыть" onClick={() => setAssignForApp(null)}>×</button>
            <ul className="tr-assign-list">
              {(teachersData ?? []).slice(0, 3).map((t) => {
                const picked = assignPickedTeacherId === t.id
                return (
                  <li key={t.id} className={`tr-assign-slot${picked ? " picked" : ""}`}>
                    <div className="tr-assign-card">
                      <div className="tr-assign-photo">
                        <Avatar name={t.name} src={t.avatar} className="tr-assign-photo-img" />
                      </div>
                      <div className="tr-assign-body">
                        <div className="tr-assign-name">{t.name}</div>
                        <div className="tr-assign-sub">о преподавателе</div>
                        <div className="tr-assign-desc">Сколько учеников, какой доход, какая маржа, сколько уроков…</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`tr-assign-radio${picked ? " picked" : ""}`}
                      aria-label={picked ? `Учитель ${t.name} выбран` : `Выбрать учителя ${t.name}`}
                      aria-pressed={picked}
                      disabled={assignSaving}
                      onClick={() => {
                        setAssignPickedTeacherId(t.id)
                        assignTeacher(t.id, t.name)
                      }}
                    >
                      {picked && (
                        <CheckIcon size={26} className="tr-assign-radio-check" style={{ color: "#DFED8C" }} />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {assignConfirm && (
        <div className="tr-confirm-overlay" onClick={() => setAssignConfirm(null)}>
          <div className="tr-confirm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="tr-confirm-timer">{`0:${String(assignConfirmSec).padStart(2,'0')}`}</div>
            <button type="button" className="tr-confirm-close" aria-label="Закрыть" onClick={() => setAssignConfirm(null)}>×</button>
            <div className="tr-confirm-title">Преподаватель назначен</div>
            <div className="tr-confirm-check" aria-hidden>
              <CheckIcon size={30} style={{ color: "#DFED8C" }} />
            </div>
            <div className="tr-confirm-teacher">{assignConfirm.teacherName}</div>
            <div className="tr-confirm-student">для ученика {assignConfirm.studentName}</div>
          </div>
        </div>
      )}

      {/* Карточка ученика (админ) — по макету teacher-card.
          Данные тянет с /api/admin/students/[id]: bio (от учителя),
          баланс, streak, контакты, счётчик занятий за год. */}
      {studentModal && (
        <AdminStudentModal
          studentId={studentModal.id}
          seedName={studentModal.name}
          seedAvatar={studentModal.avatar}
          onClose={() => setStudentModal(null)}
          onOpenChat={(peer) => {
            setChatPeer({ id: peer.id, role: "student", name: peer.name, avatar: peer.avatar })
            setStudentModal(null)
          }}
          onOpenSchedule={() => {
            setStudentModal(null)
            const el = typeof document !== "undefined" ? document.getElementById("schedule") : null
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
          }}
        />
      )}

      {/* «Добавить событие» — сначала показываем picker (Урок / Другое),
          затем открываем нужную модалку (UI полностью как у учителя). */}
      {eventModalOpen && (
        <EventPickerAndForms
          students={sortedStudents.map((s) => ({
            id: s.id,
            name: s.name,
            level: s.level ?? "A1",
            avatar: s.avatar ?? null,
          }))}
          onClose={() => setEventModalOpen(false)}
        />
      )}

      {/* Создание группы — используем тот же UI как AddLessonModal
          (Figma 2208-463 / 599 / 2560). Классы .tr-add-lesson-* + .tr обёртка. */}
      {groupModalOpen && (
        <CreateGroupModal
          teachers={teacherProfiles}
          students={sortedStudents.map((s) => ({ id: s.id, name: s.name }))}
          groupName={groupName}
          setGroupName={setGroupName}
          groupTeacherId={groupTeacherId}
          setGroupTeacherId={setGroupTeacherId}
          groupStudentSel={groupStudentSel}
          setGroupStudentSel={setGroupStudentSel}
          submitting={groupSubmitting}
          error={groupError}
          success={groupSuccess}
          onSubmit={submitCreateGroup}
          onClose={() => setGroupModalOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Модалка карточки учителя (Figma 2208-62).
 * Тянет реальные данные /api/admin/teachers/[id]. Позволяет загрузить новое
 * фото (input type=file → Supabase Storage `avatars` → PATCH avatar_url).
 * Стрелки ← → переключают на соседнего учителя из carousel'а.
 */
function TeacherDetailModal({
  teacherId,
  fallbackName,
  fallbackAvatar,
  onClose,
  onPrev,
  onNext,
}: {
  teacherId: string
  fallbackName: string
  fallbackAvatar: string | null
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const [data, setData] = useState<{
    full_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
    bio: string | null
    lessons_this_month: number
    lessons_this_year: number
  } | null>(null)
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/admin/teachers/${teacherId}`, { cache: "no-store" })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setData(j)
      } catch (e) { console.error("[teacher modal]", e) }
    })()
    return () => { cancelled = true }
  }, [teacherId])

  async function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert("Файл больше 5 МБ"); return }
    setUploading(true)
    try {
      const { createClient: mkClient } = await import("@/lib/supabase/client")
      const supabase = mkClient()
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
      const path = `${teacherId}/avatar.${ext}`
      const up = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type,
      })
      if (up.error) throw up.error
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path)
      const url = `${pub.publicUrl}?t=${Date.now()}`
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAvatarOverride(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setUploading(false)
    }
  }

  const name = data?.full_name ?? fallbackName
  const avatar = avatarOverride ?? data?.avatar_url ?? fallbackAvatar

  return (
    <div
      className="files-modal-backdrop"
      onClick={onClose}
      style={{ zIndex: 230 }}
    >
      {/* Стрелка ← слева от модалки */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPrev() }}
        aria-label="Предыдущий преподаватель"
        style={{
          position: "absolute", top: "50%", left: "calc(50% - 470px)", transform: "translateY(-50%)",
          background: "transparent", border: 0, cursor: "pointer", zIndex: 4, padding: 0,
        }}
      >
        <CarouselArrow />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(880px, calc(100vw - 200px))",
          maxHeight: "calc(100vh - 60px)",
          // Glass-container: точно как задал пользователь (без синего свечения)
          background: "rgba(255, 255, 255, 0.2)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 29.5,
          padding: 40,
          overflow: "auto",
          position: "relative",
          color: "#fff",
          display: "grid",
          gridTemplateColumns: "366px 1fr",
          gap: 32,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          style={{
            position: "absolute", top: 20, right: 20, background: "transparent", border: 0,
            cursor: "pointer", color: "#fff", fontSize: 28, lineHeight: 1, padding: 6,
          }}
        >×</button>

        {/* ЛЕВАЯ КОЛОНКА: фото + контакты под ним */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ position: "relative", width: 366, height: 366, borderRadius: 29.5, overflow: "hidden", background: "#333" }}>
            <Avatar name={name} src={avatar} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label={uploading ? "Загружаем…" : "Заменить фото"}
              style={{
                position: "absolute", left: 16, bottom: 16, width: 54, height: 54, borderRadius: "50%",
                background: "#DFED8C", border: "3px solid #1E1E1E", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
              }}
            >
              <svg viewBox="0 0 30 24" width="26" height="22" fill="none" aria-hidden>
                <path d="M4 6h5l2-3h8l2 3h5v14H4V6z" stroke="#1E1E1E" strokeWidth="2.2" strokeLinejoin="round" />
                <circle cx="15" cy="13" r="4.5" stroke="#1E1E1E" strokeWidth="2.2" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePickPhoto} />
          </div>

          {/* Контакты — почта / телефон / пароль под фото */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 18 }}>
            <div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)" }}>почта</div>
              <div style={{ wordBreak: "break-all" }}>{data?.email || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)" }}>телефон</div>
              <div>{data?.phone || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)" }}>пароль</div>
              <div>••••••••</div>
            </div>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА: ФИО, описание, статы, кнопки (внизу) */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontFamily: "Inter", fontSize: 30, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1.05, margin: "0 0 24px" }}>
            {name}
          </h2>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>о преподавателе</div>
            <div style={{ fontSize: 20, lineHeight: 1.15 }}>
              {data?.bio || "Сколько учеников, какой доход, какая маржа, сколько уроков…"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 48, marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 0.9 }}>{data?.lessons_this_month ?? 0}</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginTop: 6, lineHeight: 1.1 }}>
                количество<br />уроков за месяц
              </div>
            </div>
            <div>
              <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 0.9 }}>{data?.lessons_this_year ?? 0}</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginTop: 6, lineHeight: 1.1 }}>
                количество<br />уроков за год
              </div>
            </div>
          </div>

          {/* Кнопки — прижаты к низу (marginTop:auto), чтобы совпасть по вертикали с блоком контактов слева */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" }}>
            <Link
              href={`/admin/teachers/${teacherId}`}
              style={{
                display: "block", background: "#DFED8C", color: "#1E1E1E", textAlign: "center",
                padding: "14px 40px", borderRadius: 34, fontFamily: "Inter", fontWeight: 500, fontSize: 20, textDecoration: "none",
              }}
            >
              Открыть расписание
            </Link>
            <button
              type="button"
              style={{
                background: "#CC3A3A", color: "#fff", border: 0, padding: "14px 40px",
                borderRadius: 34, fontFamily: "Inter", fontWeight: 700, fontSize: 20, cursor: "pointer",
              }}
              onClick={() => alert("Функция отключения будет добавлена")}
            >
              Отключить от платформы
            </button>
          </div>
        </div>
      </div>

      {/* Стрелка → справа от модалки */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onNext() }}
        aria-label="Следующий преподаватель"
        style={{
          position: "absolute", top: "50%", right: "calc(50% - 470px)", transform: "translateY(-50%)",
          background: "transparent", border: 0, cursor: "pointer", zIndex: 4, padding: 0,
        }}
      >
        <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}>
          <CarouselArrow />
        </span>
      </button>
    </div>
  )
}


/**
 * «Добавить событие» — многоступенчатый флоу по Figma:
 *   1) initial (2208-2656) — зелёная модалка «Добавить новое событие»
 *      с полями «выберите событие / дата / время». Клик по «выберите событие»
 *      → открывает picker.
 *   2) picker (2208-2676) — тёмная модалка «Урок / Другое событие».
 *   3) По выбору — AdminAddLessonModal / AdminAddLectureModal
 *      (те же .tr-add-lesson-* классы что у учителя).
 */
function EventPickerAndForms({
  students,
  onClose,
}: {
  students: AddLessonStudent[]
  onClose: () => void
}) {
  const [stage, setStage] = useState<'initial' | 'picker' | 'lesson' | 'lecture'>('initial')

  if (stage === 'lesson') {
    return <AdminAddLessonModal students={students} onClose={onClose} />
  }
  if (stage === 'lecture') {
    return <AdminAddLectureModal onClose={onClose} />
  }
  if (stage === 'picker') {
    // Тёмный picker (Figma 2208-2676)
    return (
      <div className="tr"><div className="tr-add-lesson-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="tr-add-lesson" role="dialog" aria-modal="true"
          style={{
            background: '#1E1E1E', width: 472, maxWidth: 'calc(100vw - 40px)',
            padding: '79px 37px 54px', display: 'block',
          }}
        >
          <button type="button" className="tr-add-lesson-close" aria-label="Закрыть"
            onClick={onClose} style={{ color: '#DFED8C' }}>
            <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <h2 style={{
            margin: '0 0 60px', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 32,
            letterSpacing: '-1.6px', color: '#DFED8C', textAlign: 'center', lineHeight: 0.975,
          }}>
            Добавить новое событие
          </h2>
          <button type="button" onClick={() => setStage('lesson')}
            style={{
              display: 'block', width: '100%', height: 68, marginBottom: 25,
              borderRadius: 34, border: 0, cursor: 'pointer',
              background: 'rgba(204,58,58,0.5)', color: 'rgba(255,255,255,0.85)',
              fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, letterSpacing: '-1.2px',
            }}>Урок</button>
          <button type="button" onClick={() => setStage('lecture')}
            style={{
              display: 'block', width: '100%', height: 68,
              borderRadius: 34, border: 0, cursor: 'pointer',
              background: '#DFED8C', color: '#1E1E1E',
              fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, letterSpacing: '-1.2px',
            }}>Другое событие</button>
        </div>
      </div></div>
    )
  }

  // initial — зелёная модалка (Figma 2208-2656)
  return (
    <div className="tr"><div className="tr-add-lesson-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tr-add-lesson" role="dialog" aria-modal="true"
        style={{ display: 'block', padding: '79px 54px 40px' }}>
        <button type="button" className="tr-add-lesson-close" aria-label="Закрыть" onClick={onClose}>
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
            <path d="M1 1l12 12M13 1L1 13" stroke="#1E1E1E" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <h2 style={{
          margin: '0 0 42px', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 32,
          letterSpacing: '-1.6px', color: '#1E1E1E', textAlign: 'center', lineHeight: 0.975,
        }}>
          Добавить новое событие
        </h2>
        {/* «выберите событие» — клик открывает picker */}
        <button type="button" onClick={() => setStage('picker')}
          style={{
            display: 'block', width: '100%', height: 68, marginBottom: 24,
            borderRadius: 34, border: 0, cursor: 'pointer', background: '#FFF',
            color: 'rgba(30,30,30,0.7)', fontFamily: 'Inter, sans-serif',
            fontWeight: 500, fontSize: 24, letterSpacing: '-1.2px', textAlign: 'center',
          }}>
          выберите событие
        </button>
        {/* дата + время (visual placeholder — станут активны после выбора события,
            но по-макету на этом шаге они выключены). */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 38 }}>
          <div style={{
            height: 68, borderRadius: 34, background: '#FFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(30,30,30,0.7)', fontFamily: 'Inter, sans-serif',
            fontWeight: 500, fontSize: 24, letterSpacing: '-1.2px', opacity: 0.7,
          }}>дата</div>
          <div style={{
            height: 68, borderRadius: 34, background: '#FFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(30,30,30,0.7)', fontFamily: 'Inter, sans-serif',
            fontWeight: 500, fontSize: 24, letterSpacing: '-1.2px', opacity: 0.7,
          }}>время</div>
        </div>
        {/* «Создать» — disabled на этом шаге */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button type="button" disabled
            style={{
              width: 200, height: 68, borderRadius: 34, border: 0,
              background: '#CC3A3A', color: '#FFF',
              fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32,
              letterSpacing: '-1.6px', opacity: 0.5, cursor: 'default',
            }}>
            Создать
          </button>
        </div>
      </div>
    </div></div>
  )
}

/**
 * Мостик через window-callback: FilesModal-onFilePicked закрывает модалку,
 * затем открывается StudentPicker. Проще, чем поднимать sib-state.
 */
function HwStudentPickerBridge({
  students,
  onPick,
}: {
  students: Array<{ id: string; name: string; avatar?: string | null }>
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    ;(window as any).__openHwPicker = () => setOpen(true)
    return () => { delete (window as any).__openHwPicker }
  }, [])
  if (!open) return null
  return (
    <div
      className="files-modal-backdrop"
      onClick={() => setOpen(false)}
      style={{ zIndex: 250 }}
    >
      <div
        className="files-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 600, height: "auto", padding: 40 }}
      >
        <h3 style={{ margin: "0 0 20px", fontFamily: "Inter", fontWeight: 700, fontSize: 24 }}>
          Выберите ученика
        </h3>
        <div style={{ maxHeight: 400, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {students.map((s) => (
            <button
              key={s.id}
              type="button"
              className="files-modal-btn"
              onClick={() => {
                onPick(s.id)
                setOpen(false)
              }}
              style={{ textAlign: "left" }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Модалка «Создать группу» — те же .tr-add-lesson-* классы что у AddLessonModal.
 * Поля: название чата (input), teacher-picker (dropdown), students multiselect
 * (список pill'ов с чекбоксом слева), кнопка «Создать».
 */
function CreateGroupModal({
  teachers,
  students,
  groupName,
  setGroupName,
  groupTeacherId,
  setGroupTeacherId,
  groupStudentSel,
  setGroupStudentSel,
  submitting,
  error,
  success,
  onSubmit,
  onClose,
}: {
  teachers: Array<{ id: string; name: string }>
  students: Array<{ id: string; name: string }>
  groupName: string
  setGroupName: (v: string) => void
  groupTeacherId: string
  setGroupTeacherId: (v: string) => void
  groupStudentSel: Set<string>
  setGroupStudentSel: React.Dispatch<React.SetStateAction<Set<string>>>
  submitting: boolean
  error: string | null
  success: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState<'teacher' | 'students' | null>(null)
  const selectedTeacher = teachers.find((t) => t.id === groupTeacherId)
  const selectedStudentsLabel = groupStudentSel.size === 0
    ? null
    : students.filter((s) => groupStudentSel.has(s.id)).map((s) => s.name).join(', ')

  return (
    <div className="tr"><div className="tr-add-lesson-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}>
      <div className="tr-add-lesson" role="dialog" aria-modal="true">
        <button type="button" className="tr-add-lesson-close" aria-label="Закрыть" onClick={onClose}>
          <AlmCloseIcon />
        </button>

        {success ? (
          <>
            <div className="tr-add-lesson-success-title">Группа добавлена<br />в чаты</div>
            <div className="tr-add-lesson-success-check">
              <svg viewBox="0 0 69 69" width="69" height="69" fill="none" aria-hidden>
                <circle cx="34.5" cy="34.5" r="34.5" fill="#1E1E1E" />
                <path d="M20 35l10 10 20-22" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="tr-add-lesson-success-name">«{groupName}»</div>
          </>
        ) : (
          <>
            <h2 className="tr-add-lesson-title">Создать группу</h2>

            {/* Название чата */}
            <div className="tr-add-lesson-pill tr-add-lesson-pill--full"
              style={{ padding: 0, background: '#FFF' }}>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="введите название чата"
                style={{
                  width: '100%', height: '100%', border: 0, outline: 0, background: 'transparent',
                  padding: '0 40px', textAlign: 'center',
                  fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 24,
                  letterSpacing: '-1.2px', color: '#1E1E1E',
                }}
              />
            </div>

            {/* Teacher-picker */}
            {pickerOpen === 'teacher' ? (
              <div className="tr-add-lesson-dropdown">
                <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--full tr-add-lesson-pill--dropdown-head"
                  onClick={() => setPickerOpen(null)}>
                  <span className="tr-add-lesson-pill-placeholder">выберите преподавателя</span>
                  <AlmArrowLeftLime />
                </button>
                <div className="tr-add-lesson-dropdown-list" role="listbox">
                  {teachers.length === 0 ? (
                    <div className="tr-add-lesson-dropdown-empty">Преподавателей нет</div>
                  ) : (
                    teachers.map((t, i) => (
                      <button key={t.id} type="button" role="option"
                        aria-selected={groupTeacherId === t.id}
                        className={`tr-add-lesson-dropdown-item${groupTeacherId === t.id ? ' is-selected' : ''}${i > 0 ? ' has-divider' : ''}`}
                        onClick={() => { setGroupTeacherId(t.id); setPickerOpen(null) }}>
                        {t.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--full"
                onClick={() => setPickerOpen('teacher')}>
                {selectedTeacher
                  ? <span className="tr-add-lesson-pill-value">{selectedTeacher.name}</span>
                  : <span className="tr-add-lesson-pill-placeholder">выберите преподавателя</span>}
                <AlmArrowDown />
              </button>
            )}

            {/* Students multi-picker */}
            {pickerOpen === 'students' ? (
              <div className="tr-add-lesson-dropdown">
                <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--full tr-add-lesson-pill--dropdown-head"
                  onClick={() => setPickerOpen(null)}>
                  <span className="tr-add-lesson-pill-placeholder">
                    выберите учеников ({groupStudentSel.size} выбрано)
                  </span>
                  <AlmArrowLeftLime />
                </button>
                <div className="tr-add-lesson-dropdown-list" role="listbox">
                  {students.length === 0 ? (
                    <div className="tr-add-lesson-dropdown-empty">Учеников нет</div>
                  ) : (
                    students.map((s, i) => {
                      const sel = groupStudentSel.has(s.id)
                      return (
                        <button key={s.id} type="button" role="option" aria-selected={sel}
                          className={`tr-add-lesson-dropdown-item${sel ? ' is-selected' : ''}${i > 0 ? ' has-divider' : ''}`}
                          onClick={() => {
                            setGroupStudentSel((prev) => {
                              const next = new Set(prev)
                              if (next.has(s.id)) next.delete(s.id); else next.add(s.id)
                              return next
                            })
                          }}>
                          {sel ? '✓ ' : ''}{s.name}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--full"
                onClick={() => setPickerOpen('students')}>
                {selectedStudentsLabel
                  ? <span className="tr-add-lesson-pill-value" style={{
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 460,
                    }}>{selectedStudentsLabel}</span>
                  : <span className="tr-add-lesson-pill-placeholder">выберите учеников</span>}
                <AlmArrowDown />
              </button>
            )}

            <div className="tr-add-lesson-footer">
              <button type="button" className="tr-add-lesson-btn"
                disabled={!groupName.trim() || !groupTeacherId || groupStudentSel.size === 0 || submitting}
                onClick={onSubmit}>
                {submitting ? 'Создаём…' : 'Создать'}
              </button>
              {error && <div className="tr-add-lesson-error" role="alert">{error}</div>}
            </div>
          </>
        )}
      </div>
    </div></div>
  )
}
