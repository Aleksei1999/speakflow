"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowIcon } from "@/components/icons/ArrowIcon"

const Q_PER_PAGE_ADMIN = 3
import Link from "next/link"
import CustomScroll from "@/components/dashboard/CustomScroll"
import SiteFooter from "@/components/dashboard/SiteFooter"
import { HwPillList } from "@/components/dashboard/HwPillList"
import { ApplicationRow } from "@/components/dashboard/ApplicationRow"
import ChatModal from "@/components/dashboard/ChatModal"
import GroupChatModal from "@/components/dashboard/GroupChatModal"
import { nb } from "@/lib/ru/typo"
import { FilesModal, type FileItem, type FolderItem } from "@/components/dashboard/FilesModal"
import { listFolders, createFolder, renameFolder, deleteFolders } from "@/lib/materials/folders"
import type { ChatListItem } from "@/lib/chat/list"
import AdminAddLessonModal from "./AdminAddLessonModal"
import AdminAddLectureModal from "./AdminAddLectureModal"
import AdminStudentModal from "./AdminStudentModal"
import EditLessonModal from "@/app/(teacher-full)/teacher/EditLessonModal"
import { rescheduleLecture } from "./admin-actions"
import { ArrowDown as AlmArrowDown, ArrowLeftLime as AlmArrowLeftLime, CloseIcon as AlmCloseIcon, type AddLessonStudent, ArrowDown, CloseIcon } from "@/app/(teacher-full)/teacher/AddLessonModal"

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

// Макет админки нарисован под 1441px. На экранах шире масштабируем страницу пропорционально
// (zoom = ширина / 1441, потолок 1.4) — так же, как у учителя, ученика и на лендинге.
function useProportionalZoom() {
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth
      const z = w > 1441 ? Math.min(w / 1441, 1.4) : 1
      document.documentElement.style.setProperty("--raw2-zoom", z.toFixed(4))
      // Модалки лежат внутри .ad и наследуют масштаб страницы. Самая высокая — 686×869:
      // если с масштабом страницы она не влезает в окно (поля 20px), уменьшаем модалки до вмещающегося.
      const fit = Math.min(z, (window.innerHeight - 40) / 869, (w - 40) / 686)
      document.documentElement.style.setProperty("--modal-zoom", (Math.max(0.5, fit) / z).toFixed(4))
    }
    apply()
    window.addEventListener("resize", apply)
    return () => window.removeEventListener("resize", apply)
  }, [])
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
    | { id: string; role: "teacher" | "student" | "admin"; name: string; avatar: string | null; level?: string | null }
    | null
  >(null)
  const [chatUnreadOverride, setChatUnreadOverride] = useState<Record<string, number>>({})
  const [groupUnreadOverride, setGroupUnreadOverride] = useState<Record<string, number>>({})
  const [groupChat, setGroupChat] = useState<{ id: string; name: string; memberCount: number } | null>(null)

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

  // Папки Библиотеки (миграция 20260905100000). Верхний уровень = список папок,
  // клик по папке → activeFolderId → показываем файлы этой папки.
  const [libraryFolders, setLibraryFolders] = useState<FolderItem[]>([])
  const [libraryFolderId, setLibraryFolderId] = useState<string | null>(null)

  // Папки Домашки (общий пул). Показываем после выбора ученика — файлы внутри
  // фильтруются по (folder_id, target_id=ученик).
  const [homeworkFolders, setHomeworkFolders] = useState<FolderItem[]>([])
  const [homeworkFolderId, setHomeworkFolderId] = useState<string | null>(null)

  async function handleAdminLibraryUpload(file: File) {
    if (!libraryFolderId) { alert("Сначала откройте папку"); return }
    if (file.size > 50 * 1024 * 1024) { alert("Файл больше 50 МБ"); return }
    setLibraryUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder_id", libraryFolderId)
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
  // Перенос урока/лекции из плашки расписания (карандаш) — модалка учителя EditLessonModal.
  // Полный календарь (все ученики и учителя) — по большому карандашу в панели расписания.
  const [calendarOpen, setCalendarOpen] = useState(false)
  useEffect(() => {
    if (!calendarOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCalendarOpen(false) }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [calendarOpen])
  const [editLesson, setEditLesson] = useState<
    { id: string; label: string; scheduledAtISO: string; kind: "lesson" | "lecture" } | null
  >(null)

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

  // Refetch folders when library modal opens or something changed.
  useEffect(() => {
    if (!libraryOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listFolders("library")
        if (cancelled) return
        setLibraryFolders(rows.map((f) => ({ id: f.id, name: f.name, count: f.count })))
      } catch (e) { console.error("[admin library folders]", e) }
    })()
    return () => { cancelled = true }
  }, [libraryOpen, libraryVersion])

  // Refetch files INSIDE the currently-open folder.
  useEffect(() => {
    if (!libraryOpen || !libraryFolderId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/admin/materials?limit=200&folder_id=${encodeURIComponent(libraryFolderId)}`,
          { cache: "no-store" },
        )
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
              mime: m.mime_type ?? null,
              onOpen: openUrl ? () => window.open(openUrl, "_blank") : undefined,
            }
          }),
        )
      } catch (e) { console.error("[admin library files]", e) }
    })()
    return () => { cancelled = true }
  }, [libraryOpen, libraryFolderId, libraryVersion])

  // Папки ДЗ (общий пул) грузятся всегда когда открыта модалка «ДЗ» ИЛИ
  // выбран конкретный ученик через student-picker.
  useEffect(() => {
    if (!homeworkOpen && !hwUploadTarget) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listFolders("homework")
        if (cancelled) return
        setHomeworkFolders(rows.map((f) => ({ id: f.id, name: f.name, count: f.count })))
      } catch (e) { console.error("[admin homework folders]", e) }
    })()
    return () => { cancelled = true }
  }, [homeworkOpen, hwUploadTarget, homeworkVersion])

  // Файлы конкретной папки. Если админ вошёл через «ДЗ» без выбора ученика —
  // показываем ВСЕ файлы всех учеников (без student_id фильтра). Если через
  // per-student flow — только этого ученика.
  useEffect(() => {
    if (!homeworkFolderId) return
    if (!homeworkOpen && !hwUploadTarget) return
    let cancelled = false
    ;(async () => {
      try {
        const url = hwUploadTarget
          ? `/api/admin/homework?folder_id=${encodeURIComponent(homeworkFolderId)}&student_id=${encodeURIComponent(hwUploadTarget)}`
          : `/api/admin/homework?folder_id=${encodeURIComponent(homeworkFolderId)}`
        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setHomeworkFiles(
          (data.materials ?? []).map((m: any) => ({
            id: m.id,
            name: m.title,
            status: "loaded" as const,
            mime: m.mime_type ?? null,
            onOpen: m.signed_url ? () => window.open(m.signed_url, "_blank") : undefined,
          })),
        )
      } catch (e) { console.error("[admin homework files]", e) }
    })()
    return () => { cancelled = true }
  }, [homeworkOpen, hwUploadTarget, homeworkFolderId, homeworkVersion])

  async function handleAdminHwUpload(file: File) {
    if (!hwUploadTarget) {
      alert("Сначала выберите ученика")
      return
    }
    if (!homeworkFolderId) {
      alert("Сначала откройте папку")
      return
    }
    if (file.size > 25 * 1024 * 1024) { alert("Файл больше 25 МБ"); return }
    setHwUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("studentId", hwUploadTarget)
      fd.append("folder_id", homeworkFolderId)
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
  useProportionalZoom()
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
  const [assignPage, setAssignPage] = useState(0)
  useEffect(() => {
    if (!assignForApp) return
    setAssignPage(0)
    setAssignPickedTeacherId(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAssignForApp(null) }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [assignForApp])
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
    // Теста нет — вопросов не показываем (раньше подставлялись демо-вопросы, что вводило в заблуждение)
    return []
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
  // Все ближайшие уроки и события (для полного календаря); в панели — 3 ближайших по дате:
  // прошедший урок уходит, на его место поднимается следующий.
  const allScheduleView = (upcomingLessons ?? []).map((l) => {
    const d = new Date(l.scheduledAt)
    const time = d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
    const date = d.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "2-digit" })
    const label = l.studentName && l.teacherName
      ? `${l.studentName} → ${l.teacherName}`
      : l.studentName ?? l.teacherName ?? l.title
    return { id: l.id, time, date, label, scheduledAt: l.scheduledAt, teacherUserId: l.teacherUserId ?? null, studentId: l.studentId ?? null }
  })
  const scheduleView = allScheduleView.slice(0, 3)
  // Плашка урока/лекции (панель и полный календарь).
  const renderScheduleRow = (l: (typeof allScheduleView)[number]) => {
                  const isLecture = String(l.id).startsWith("lec:")
                  const rawId = isLecture ? String(l.id).slice(4) : String(l.id)
                  const roomHref = isLecture ? `/lecture/${rawId}` : `/lesson/${rawId}`
                  return (
                    <div className="ad-lesson" key={l.id}>
                      <div className="ad-lesson-time">
                        <div className="hh">{l.time}</div>
                        <div className="dd">{l.date}</div>
                      </div>
                      <div className="ad-lesson-label">{l.label}</div>
                      <button
                        type="button"
                        className="ad-lesson-edit"
                        aria-label="Изменить дату и время"
                        title="Изменить дату и время"
                        onClick={() => setEditLesson({ id: rawId, label: l.label, scheduledAtISO: l.scheduledAt, kind: isLecture ? "lecture" : "lesson" })}
                      >
                        {/* карандаш — экспорт Figma 4027:221 (Group 193), лаймовый круг 44 задаётся стилем */}
                        <img src="/dashboard/ic-edit-pencil.svg" alt="" aria-hidden width={24.44} height={24.42} />
                      </button>
                      <a
                        className="ad-lesson-call"
                        href={roomHref}
                        title="Присоединиться к звонку (комната откроется за 5 мин до начала)"
                      >
                        начать звонок
                      </a>
                    </div>
                  )
  }

  return (
    <div className="ad">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="/dashboard/raw-admin.css?v=20260909-tmodal"
      />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/shared-pills.css?v=20260908-arrow2" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/files-modal.css?v=20260908-figma" />
      {/* teacher-css нужен для .tr-add-lesson-* (модалка «Добавить событие»
          у админа переиспользует UI из teacher). */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/raw-teacher.css?v=20260909-notest" />

      {/* ================== HERO: nav + dark card holding SCHEDULE ================== */}
      <div className="ad-hero">
        <nav className="ad-nav">
          <Link href="/admin" className="ad-brand" aria-label="Raw English">
            <img src="/dashboard/logo-raw-red-white.svg" alt="Raw English" width={171} height={98} />
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
            <button type="button" className="ad-panel-edit" aria-label="Полное расписание" title="Полное расписание: все ученики и учителя" onClick={() => setCalendarOpen(true)}>
              <img src="/dashboard/ic-edit-pencil-30.svg" alt="" width={30} height={29.97} />
            </button>
            {scheduleView.length === 0 ? (
              <div className="ad-schedule-empty">
                Тут попозже будет календарь
              </div>
            ) : (
              <div className="ad-schedule">
                {scheduleView.map(renderScheduleRow)}
              </div>
            )}
          </div>
          <div className="ad-hero-cta">
            <button type="button" className="ad-sched-cta" onClick={() => setEventModalOpen(true)}>
              Добавить урок или событие
              <span className="ad-sched-cta-arrow" aria-hidden>
                <img className="ad-sched-cta-arrow-circle" src="/dashboard/ic-arrow-circle-red.svg" alt="" width={67} height={68} />
                <img className="ad-sched-cta-arrow-glyph" src="/dashboard/ic-arrow-white.svg" alt="" width={37} height={36.82} />
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
      <section id="chats" className="tr-section ad-chats-section">
        {/* Figma 4005:194 (фрейм 1441×1185 на y=2293): плашка «ЧАТЫ» 251×83 на 48, карточка 1228×837 на (106,219),
            ряды 1108×153 с зазором 37, трек 7×723 на (1309,277). Разметка и стили — как у учителя (4033:225). */}
        <div className="tr-chats-frame">
          <div className="tr-chats-badge">ЧАТЫ</div>
          <div className="tr-chats-card">
           <CustomScroll className="tr-chats-list" track={723} ariaLabel="Чаты">
            {(!initialChats || initialChats.length === 0) && (
              <div className="tr-chats-empty">Пока нет ни одного чата.</div>
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
                        <img src={c.peerAvatar} alt="" />
                      ) : (
                        <div className="tr-chat-avatar-fallback">{initialsOf(c.peerName)}</div>
                      )}
                    </div>
                    <div className="tr-chat-name">{c.peerName}</div>
                    <div className="tr-chat-preview">
                      {c.lastSenderIsMe && <b>Вы: </b>}
                      {nb(c.lastText) || "Нет сообщений"}
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
                          level: c.peerLevel ?? undefined,
                        })
                      }}
                    >
                      <img src="/dashboard/chats/arrow-icon-white.svg" alt="" aria-hidden />
                    </button>
                  </div>
                )
              }
              // kind === "group" — красный ряд, стопка аватаров, счётчик, лаймовая стрелка
              const gUnread = groupUnreadOverride[c.groupId] ?? c.unreadCount
              return (
                <div
                  key={`g:${c.groupId}`}
                  className={`tr-chat-row tr-chat-row--red${gUnread > 0 ? " tr-chat-row--unread" : ""}`}
                >
                  <div className="tr-chat-avatar-big">
                    {c.memberAvatars[0]?.avatar ? (
                      <img src={c.memberAvatars[0].avatar} alt="" />
                    ) : (
                      <div className="tr-chat-avatar-fallback">{initialsOf(c.memberAvatars[0]?.name ?? c.name)}</div>
                    )}
                  </div>
                  {c.memberAvatars[1] && (
                    <div className="tr-chat-avatar-mini">
                      {c.memberAvatars[1].avatar ? (
                        <img src={c.memberAvatars[1].avatar} alt="" />
                      ) : (
                        <div className="tr-chat-avatar-fallback">{initialsOf(c.memberAvatars[1].name)}</div>
                      )}
                    </div>
                  )}
                  {c.memberAvatars[2] && (
                    <div className="tr-chat-avatar-nano">
                      {c.memberAvatars[2].avatar ? (
                        <img src={c.memberAvatars[2].avatar} alt="" />
                      ) : (
                        <div className="tr-chat-avatar-fallback">{initialsOf(c.memberAvatars[2].name)}</div>
                      )}
                    </div>
                  )}
                  {gUnread > 0 && (
                    <div className="tr-chat-count"><span>{gUnread}</span></div>
                  )}
                  <div className="tr-chat-name tr-chat-name--white">{c.name}</div>
                  <div className="tr-chat-preview tr-chat-preview--white">
                    {c.lastText ? (
                      <>
                        {c.lastSenderIsMe && <b>Вы: </b>}
                        {nb(c.lastText)}
                      </>
                    ) : (
                      <>Групповой чат — {c.memberCount} {pluralize(c.memberCount, "участник", "участника", "участников")}</>
                    )}
                  </div>
                  <button
                    type="button"
                    className="tr-chat-arrow-btn tr-chat-arrow-btn--lime"
                    aria-label={`Открыть групповой чат ${c.name}`}
                    onClick={() => {
                      setGroupUnreadOverride((s) => ({ ...s, [c.groupId]: 0 }))
                      setGroupChat({ id: c.groupId, name: c.name, memberCount: c.memberCount })
                    }}
                  >
                    <img src="/dashboard/chats/arrow-icon-dark.svg" alt="" aria-hidden />
                  </button>
                </div>
              )
            })}
           </CustomScroll>
          </div>
          {/* Figma 4053:262: «Создать группу» 308.58×68 lime на x=533 (frame 427), 42 под карточкой; лаймовый круг 67×68 с тёмной стрелкой вплотную справа */}
          <button type="button" className="ad-chats-create" onClick={() => setGroupModalOpen(true)}>
            Создать группу
            <span className="ad-chats-create-arrow" aria-hidden>
              <img className="ad-chats-create-arrow-circle" src="/dashboard/ic-arrow-circle-lime.svg" alt="" width={67} height={68} />
              <img className="ad-chats-create-arrow-glyph" src="/dashboard/ic-arrow-right.svg" alt="" width={37} height={36.82} />
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
        <div className="ad-teachers-wrap ad-tcards">
          {/* Figma 4053:291: обе стрелки видны всегда; когда листать некуда — приглушены */}
          <button
            type="button"
            className="ad-teachers-arrow ad-teachers-arrow--left"
            onClick={() => setTeacherPage((p) => Math.max(0, p - 1))}
            disabled={teacherPage <= 0}
            aria-label="Предыдущие"
          >
            <img src="/dashboard/ic-carousel-arrow.svg" alt="" aria-hidden width={79} height={79} />
          </button>
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
                      {/* Figma 4053:291 Component 6: лаймовый круг 54 + карандаш 30 (Group 193) */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/dashboard/ic-edit-pencil-30.svg" alt="" width={30} height={29.97} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
          <button
            type="button"
            className="ad-teachers-arrow ad-teachers-arrow--right"
            onClick={() => setTeacherPage((p) => Math.min(Math.max(0, teachersData.length - TEACHERS_PER_PAGE), p + 1))}
            disabled={teacherPage + TEACHERS_PER_PAGE >= teachersData.length}
            aria-label="Следующие"
          >
            <img src="/dashboard/ic-carousel-arrow.svg" alt="" aria-hidden width={79} height={79} style={{ transform: "scaleX(-1)" }} />
          </button>
        </div>
      </section>

      {/* ================== STUDENTS (dark bg) ================== */}
      {/* Figma 4054:293 «Список учеников» (админ): фрейм 1441×1137 на y=4600, фон как у шапки;
          плашка 554×83 на 75, карточка 1228×815 на 222, ряды 539×139 (2 колонки), трек 7×495, «Создать группу» 357×68 на 919.
          Разметка и стили — как у учителя (4020:217), в .tr для raw-teacher.css. */}
      <div className="tr">
      <section id="students" className="ad-students-section">
        <div className="tr-students">
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
            <CustomScroll className="tr-students-list" track={495} ariaLabel="Ученики">
              <div className="tr-students-grid">
                {sortedStudents.map((s) => (
                  <div
                    className="tr-stu"
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setStudentModal({ id: s.id, name: s.name, avatar: s.avatar, level: s.level })}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setStudentModal({ id: s.id, name: s.name, avatar: s.avatar, level: s.level })}
                  >
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
                ))}
              </div>
            </CustomScroll>
            <div className="tr-panel-footer">
              <button type="button" className="tr-create-group" onClick={() => setGroupModalOpen(true)}>
                Создать группу
                <span className="tr-create-group-arrow" aria-hidden>
                  <img src="/dashboard/ic-arrow-circle-red.svg" alt="" width={67} height={68} className="tr-create-group-arrow-circle" />
                  <img src="/dashboard/ic-arrow-white.svg" alt="" width={37} height={36.82} className="tr-create-group-arrow-glyph" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
      </div>

      {/* ================== INCOMING APPLICATIONS (UI 1:1 как у учителя) ================== */}
      {/* Оборачиваем в .tr чтобы применились teacher CSS (.tr-section, .tr-badge-wrap,
          .tr-sub, .tr-apps, .tr-app*). Без .tr-обёртки .tr-*  селекторы не сработают. */}
      <div className="tr">
      <section id="leads" className={`tr-section ad-leads-section${appsExpanded ? " tr-section--apps-open" : ""}`}>
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
              {/* Figma 2522:3178: раскрытый список — область 757 с прокруткой, тёмный скроллбар 7×757 */}
              <CustomScroll className="tr-apps-scroll" track={757}>
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
                              <img src="/dashboard/apps/edit-level-pencil-lime.svg" width={30} height={29.97} alt="" aria-hidden />
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
                        {/* свёрнуто: лаймовый круг + тёмная стрелка влево (Component 9, Group 286); раскрыто: тёмный круг + лаймовая стрелка вниз */}
                        <img className="tr-app-arrow-circle" src={isOpen ? "/dashboard/apps/arrow-circle-dark.svg" : "/dashboard/ic-arrow-circle.svg"} alt="" width={79} height={79} />
                        <img className={`tr-app-arrow-glyph${isOpen ? " is-open" : ""}`} src={isOpen ? "/dashboard/apps/arrow-lime.svg" : "/dashboard/ic-arrow-right.svg"} alt="" width={37} height={36.82} />
                      </button>
                      {isOpen && (
                        <>
                          <div className="tr-app-questions">
                            {questions.length === 0 && (
                              <div className="tr-app-notest" role="status">Ученик ещё не прошёл тест</div>
                            )}
                            {qTotalPages > 1 && (
                              <button type="button" className="tr-q-prev" aria-label="Предыдущие"
                                onClick={() => setQPage((p) => (p - 1 + qTotalPages) % qTotalPages)}>
                                <img className="tr-q-nav-circle" src="/dashboard/apps/q-next-circle.svg" alt="" width={47} height={46} />
                                <img className="tr-q-nav-arrow tr-q-nav-arrow--prev" src="/dashboard/apps/q-next-arrow.svg" alt="" width={18.5} height={18.41} />
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
                                        {/* маркеры ответа — экспорт Figma 2522:3812: лаймовый круг 21 + галочка / красный круг + крестик */}
                                        {isChosen && (
                                          <span className={`tr-q-icon ${isCorrect ? "tr-q-icon--ok" : "tr-q-icon--no"}`} aria-hidden>
                                            <img className="tr-q-icon-circle" src={isCorrect ? "/dashboard/apps/opt-ok.svg" : "/dashboard/apps/opt-no.svg"} alt="" width={21} height={21} />
                                            <img className="tr-q-icon-mark" src={isCorrect ? "/dashboard/apps/opt-ok-mark.svg" : "/dashboard/apps/opt-no-mark.svg"} alt="" width={isCorrect ? 11 : 9} height={9} />
                                          </span>
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
                                <img className="tr-q-nav-circle" src="/dashboard/apps/q-next-circle.svg" alt="" width={47} height={46} />
                                <img className="tr-q-nav-arrow" src="/dashboard/apps/q-next-arrow.svg" alt="" width={18.5} height={18.41} />
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
              </CustomScroll>
              {(remainingApps > 0 || appsExpanded) && (
                <div className="tr-apps-footer">
                  <button
                    type="button"
                    className={`tr-apps-expand ${appsExpanded ? "is-open" : ""}`}
                    aria-label={appsExpanded ? "Свернуть" : "Показать больше"}
                    aria-expanded={appsExpanded}
                    onClick={() => setAppsExpanded((v) => !v)}
                  >
                    {appsExpanded ? (
                      <img className="tr-apps-collapse-ic" src="/dashboard/ic-collapse-circle.svg" alt="" width={68} height={67} />
                    ) : (
                      <>
                        <img className="tr-apps-expand-circle" src="/dashboard/ic-expand-circle.svg" alt="" width={67} height={68} />
                        <img className="tr-apps-expand-glyph" src="/dashboard/ic-chevron-down.svg" alt="" width={36.5} height={19.69} />
                      </>
                    )}
                  </button>
                  {appsExpanded && (
                    <button type="button" className="tr-apps-handle" aria-label="Свернуть список" onClick={() => setAppsExpanded(false)} />
                  )}
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
      <SiteFooter variant="admin" supportHref="/admin/support" />

      {groupChat && adminUserId && (
        <GroupChatModal
          groupId={groupChat.id}
          groupName={groupChat.name}
          memberCount={groupChat.memberCount}
          currentUserId={adminUserId}
          currentRole="admin"
          onClose={() => setGroupChat(null)}
        />
      )}

      {chatPeer && (
        <ChatModal
          peerId={chatPeer.id}
          peerRole={chatPeer.role}
          peerName={chatPeer.name}
          peerLevel={chatPeer.level ?? undefined}
          peerAvatar={chatPeer.avatar ?? undefined}
          currentUserId={adminUserId}
          currentRole="admin"
          onClose={() => setChatPeer(null)}
        />
      )}

      {libraryOpen && (
        <FilesModal
          title="Библиотека Raw English"
          folders={libraryFolders}
          files={libraryFiles}
          activeFolderId={libraryFolderId}
          onOpenFolder={setLibraryFolderId}
          canManage
          onCreateFolder={async () => {
            const { id } = await createFolder("library")
            setLibraryVersion((v) => v + 1)
            return id
          }}
          onRenameFolder={async (id, name) => {
            await renameFolder(id, name)
            setLibraryVersion((v) => v + 1)
          }}
          onDeleteFolders={async (ids) => {
            await deleteFolders(ids)
            setLibraryVersion((v) => v + 1)
          }}
          onClose={() => { setLibraryOpen(false); setLibraryFolderId(null) }}
          addLabel={libraryUploading ? "Загружаем…" : "Добавить файл"}
          onFilePicked={handleAdminLibraryUpload}
          onDeleteFiles={async (ids) => {
            const results = await Promise.allSettled(
              ids.map((id) => fetch(`/api/teacher/materials/${id}`, { method: "DELETE" })),
            )
            const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)).length
            if (failed > 0) alert(`Не удалось удалить ${failed} из ${ids.length} файлов`)
            setLibraryVersion((v) => v + 1)
          }}
        />
      )}

      {/* Верхний вход в ДЗ у админа: browse ВСЕХ папок и файлов (все ученики,
          общий пул). Просмотр read-only — для загрузки конкретному ученику
          используется отдельный student-picker поток ниже. */}
      {homeworkOpen && !hwUploadTarget && (
        <FilesModal
          title="Домашние задания (все ученики)"
          folders={homeworkFolders}
          files={homeworkFiles}
          activeFolderId={homeworkFolderId}
          onOpenFolder={setHomeworkFolderId}
          canManage
          onCreateFolder={async () => {
            const { id } = await createFolder("homework")
            setHomeworkVersion((v) => v + 1)
            return id
          }}
          onRenameFolder={async (id, name) => {
            await renameFolder(id, name)
            setHomeworkVersion((v) => v + 1)
          }}
          onDeleteFolders={async (ids) => {
            await deleteFolders(ids)
            setHomeworkVersion((v) => v + 1)
          }}
          onClose={() => { setHomeworkOpen(false); setHomeworkFolderId(null) }}
          onDeleteFiles={async (ids) => {
            const results = await Promise.allSettled(
              ids.map((id) => fetch(`/api/teacher/materials/${id}`, { method: "DELETE" })),
            )
            const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)).length
            if (failed > 0) alert(`Не удалось удалить ${failed} из ${ids.length} файлов`)
            setHomeworkVersion((v) => v + 1)
          }}
        />
      )}

      {hwUploadTarget && (
        <FilesModal
          title={`ДЗ для: ${sortedStudents.find((s) => s.id === hwUploadTarget)?.name ?? "ученика"}`}
          folders={homeworkFolders}
          files={homeworkFiles}
          activeFolderId={homeworkFolderId}
          onOpenFolder={setHomeworkFolderId}
          canManage
          onCreateFolder={async () => {
            const { id } = await createFolder("homework")
            setHomeworkVersion((v) => v + 1)
            return id
          }}
          onRenameFolder={async (id, name) => {
            await renameFolder(id, name)
            setHomeworkVersion((v) => v + 1)
          }}
          onDeleteFolders={async (ids) => {
            await deleteFolders(ids)
            setHomeworkVersion((v) => v + 1)
          }}
          onClose={() => { setHwUploadTarget(null); setHomeworkFolderId(null) }}
          onFilePicked={handleAdminHwUpload}
          addLabel={hwUploading ? "Загружаем…" : "Добавить файл"}
          onDeleteFiles={async (ids) => {
            const results = await Promise.allSettled(
              ids.map((id) => fetch(`/api/teacher/materials/${id}`, { method: "DELETE" })),
            )
            const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)).length
            if (failed > 0) alert(`Не удалось удалить ${failed} из ${ids.length} файлов`)
            setHomeworkVersion((v) => v + 1)
          }}
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
        />
      )}

      {/* «Назначить учителя» — модалка со списком учителей (Figma 2505:264).
          После клика по учителю патчим trial_lesson_requests.assigned_teacher_id
          и показываем окно подтверждения (Figma 2505:2852). */}
      {/* Figma 2522:263 «При нажатии» (Назначить учителя): белый экран с карточками учителей,
          выбор — кнопка по центру низа карточки; чат и карандаш — по углам. ESC / крестик закрывают. */}
      {assignForApp && (
        <div className="ad-assign-overlay" role="dialog" aria-modal="true" aria-label="Назначить учителя">
          <div className="ad-assign-page">
            <button type="button" className="ad-assign-close" aria-label="Закрыть" onClick={() => setAssignForApp(null)}>
              <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
            </button>
            <div className="ad-badge-wrap">
              <span className="ad-badge">
                СПИСОК <span className="c-red">УЧИТЕЛЕЙ</span>
              </span>
            </div>
            <div className="ad-teachers-wrap ad-tcards">
              <button
                type="button"
                className="ad-assign-arrow ad-assign-arrow--left"
                onClick={() => setAssignPage((p) => Math.max(0, p - 1))}
                disabled={assignPage <= 0}
                aria-label="Предыдущие"
              >
                <img className="ad-assign-arrow-circle" src="/dashboard/apps/assign-arrow-circle.svg" alt="" aria-hidden width={81} height={82} />
                <img className="ad-assign-arrow-glyph" src="/dashboard/ic-arrow-right.svg" alt="" aria-hidden width={37} height={36.82} />
              </button>
              <div className="ad-teachers">
                {(teachersData ?? []).slice(assignPage, assignPage + TEACHERS_PER_PAGE).map((t) => {
                  const picked = assignPickedTeacherId === t.id
                  return (
                    <div className="ad-teacher ad-assign-card" key={t.id}>
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
                      <button
                        type="button"
                        className="ad-assign-chat"
                        aria-label={`Расписание учителя ${t.name}`}
                        onClick={() => setCalendarOpen(true)}
                      >
                        <img src="/dashboard/apps/assign-teacher-chat.svg" alt="" aria-hidden width={27} height={27} />
                      </button>
                      <button
                        type="button"
                        className={`ad-assign-pick${picked ? " picked" : ""}`}
                        aria-label={picked ? `Учитель ${t.name} выбран` : `Назначить учителя ${t.name}`}
                        aria-pressed={picked}
                        disabled={assignSaving}
                        onClick={() => {
                          setAssignPickedTeacherId(t.id)
                          assignTeacher(t.id, t.name)
                        }}
                      >
                        <img className="ad-assign-pick-circle" src={picked ? "/dashboard/apps/assign-pick-on.svg" : "/dashboard/apps/assign-pick.svg"} alt="" aria-hidden width={70} height={70} />
                        {picked && <img className="ad-assign-pick-check" src="/dashboard/apps/assign-pick-check.svg" alt="" aria-hidden width={29} height={24} />}
                      </button>
                      <button
                        type="button"
                        className="ad-teacher-edit"
                        aria-label={`Редактировать ${t.name}`}
                        onClick={() => setTeacherModal({ id: t.id, name: t.name, avatar: t.avatar })}
                      >
                        <img src="/dashboard/ic-edit-pencil-30.svg" alt="" aria-hidden width={30} height={29.97} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                className="ad-assign-arrow ad-assign-arrow--right"
                onClick={() => setAssignPage((p) => Math.min(Math.max(0, (teachersData ?? []).length - TEACHERS_PER_PAGE), p + 1))}
                disabled={assignPage + TEACHERS_PER_PAGE >= (teachersData ?? []).length}
                aria-label="Следующие"
              >
                <img className="ad-assign-arrow-circle" src="/dashboard/apps/assign-arrow-circle.svg" alt="" aria-hidden width={81} height={82} />
                <img className="ad-assign-arrow-glyph" src="/dashboard/ic-arrow-right.svg" alt="" aria-hidden width={37} height={36.82} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Figma 2522:2955 «Преподаватель назначен»: окно после выбора учителя, таймер 59 с */}
      {assignConfirm && (
        <div className="ad-confirm-overlay" onClick={() => setAssignConfirm(null)}>
          <div className="ad-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Преподаватель назначен">
            <div className="ad-confirm-timer">{`0:${String(assignConfirmSec).padStart(2, '0')}`}</div>
            <button type="button" className="ad-confirm-close" aria-label="Закрыть" onClick={() => setAssignConfirm(null)}>
              <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
            </button>
            <div className="ad-confirm-title">Преподаватель<br />назначен</div>
            <div className="ad-confirm-check" aria-hidden>
              <img className="ad-confirm-check-circle" src="/dashboard/ic-check-circle.svg" alt="" width={69} height={69} />
              <img className="ad-confirm-check-mark" src="/dashboard/ic-check-mark.svg" alt="" width={35} height={29} />
            </div>
            <div className="ad-confirm-name">{assignConfirm.teacherName}</div>
            <div className="ad-confirm-student">{nb(`для ученика ${assignConfirm.studentName}`)}</div>
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
      {/* Полный календарь: все ближайшие уроки и события всех учеников и учителей, листается */}
      {calendarOpen && (
        <div className="ad-cal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setCalendarOpen(false) }}>
            <div className="ad-cal" role="dialog" aria-modal="true" aria-label="Полное расписание">
              <button type="button" className="ad-cal-close" aria-label="Закрыть" onClick={() => setCalendarOpen(false)}>
                <img src="/dashboard/ic-close-lime.svg" alt="" aria-hidden />
              </button>
              <div className="ad-cal-title">Расписание</div>
              <div className="ad-cal-sub">все ученики и учителя · {allScheduleView.length}</div>
              {allScheduleView.length === 0 ? (
                <div className="ad-cal-empty">Ближайших уроков и событий нет</div>
              ) : (
                <CustomScroll className="ad-cal-list" track={692} ariaLabel="Полное расписание">
                  <div className="ad-schedule ad-schedule--cal">{allScheduleView.map(renderScheduleRow)}</div>
                </CustomScroll>
              )}
            </div>
        </div>
      )}

      {/* Перенос урока / лекции — модалка учителя, в .tr для стилей raw-teacher.css */}
      {editLesson && (
        <div className="tr">
          <EditLessonModal
            lesson={editLesson}
            reschedule={
              editLesson.kind === "lecture"
                ? (iso) => rescheduleLecture({ lectureId: editLesson.id, scheduledAt: iso })
                : undefined
            }
            onClose={() => setEditLesson(null)}
          />
        </div>
      )}

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
}: {
  teacherId: string
  fallbackName: string
  fallbackAvatar: string | null
  onClose: () => void
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

  // Figma 2522:191 (Group 287): карточка преподавателя 812×755 — фото и контакты слева, имя/описание/статы/кнопки справа
  return (
    <div className="files-modal-backdrop" onClick={onClose} style={{ zIndex: 230 }}>
      <div className="ad-tmodal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={name}>
        <button type="button" className="ad-tmodal-close" onClick={onClose} aria-label="Закрыть">
          <img src="/dashboard/ic-close-lime.svg" alt="" aria-hidden />
        </button>

        <div className="ad-tmodal-photo">
          <Avatar name={name} src={avatar} />
          <button
            type="button"
            className="ad-tmodal-camera"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={uploading ? "Загружаем…" : "Заменить фото"}
          >
            <img src="/dashboard/ic-camera-dark.svg" alt="" aria-hidden width={34.69} height={27.35} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePickPhoto} />
        </div>

        <div className="ad-tmodal-field ad-tmodal-field--mail">
          <div className="ad-tmodal-label">почта</div>
          <div className="ad-tmodal-value" title={data?.email || undefined}>{data?.email || "–"}</div>
        </div>
        <div className="ad-tmodal-field ad-tmodal-field--phone">
          <div className="ad-tmodal-label">телефон</div>
          <div className="ad-tmodal-value">{data?.phone || "–"}</div>
        </div>
        <div className="ad-tmodal-field ad-tmodal-field--pass">
          <div className="ad-tmodal-label">пароль</div>
          <div className="ad-tmodal-value">••••••••</div>
        </div>

        <div className="ad-tmodal-name">{name}</div>
        <div className="ad-tmodal-meta">о преподавателе</div>
        <div className="ad-tmodal-desc">{nb(data?.bio || "Сколько учеников, какой доход, какая маржа, сколько уроков...")}</div>

        <div className="ad-tmodal-stat ad-tmodal-stat--month">
          <div className="ad-tmodal-stat-num">{data?.lessons_this_month ?? 0}</div>
          <div className="ad-tmodal-stat-label">количество<br />уроков за месяц</div>
        </div>
        <div className="ad-tmodal-stat ad-tmodal-stat--year">
          <div className="ad-tmodal-stat-num">{data?.lessons_this_year ?? 0}</div>
          <div className="ad-tmodal-stat-label">количество<br />уроков за год</div>
        </div>

        <Link href={`/admin/teachers/${teacherId}`} className="ad-tmodal-btn ad-tmodal-btn--schedule">
          Открыть расписание
        </Link>
        <button type="button" className="ad-tmodal-btn ad-tmodal-btn--off" onClick={() => alert("Функция отключения будет добавлена")}>
          Отключить от платформы
        </button>
      </div>
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
    // Тёмный picker (Figma 2522:2733 «Выбрать событие»): 472×413 #1E1E1E, заголовок 32/500 lime в две строки (338) на 79,
    // «Урок» 398×68 rgba(204,58,58,.5) на 198, «Другое событие» 398×68 lime на 291, крестик lime на (424,34)
    return (
      <div className="tr"><div className="tr-add-lesson-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="tr-add-lesson ad-event-picker" role="dialog" aria-modal="true">
          <button type="button" className="tr-add-lesson-close" aria-label="Закрыть" onClick={onClose}>
            <img src="/dashboard/ic-close-lime.svg" alt="" aria-hidden />
          </button>
          <h2 className="tr-add-lesson-title">Добавить новое событие</h2>
          <button type="button" className="ad-event-picker-btn ad-event-picker-btn--lesson" onClick={() => setStage('lesson')}>Урок</button>
          <button type="button" className="ad-event-picker-btn ad-event-picker-btn--other" onClick={() => setStage('lecture')}>Другое событие</button>
        </div>
      </div></div>
    )
  }

  // initial — зелёная модалка (Figma 2522:2713 «Добавить событие»): те же классы, что у «Добавить новый урок»
  // (686×557, заголовок на 79, пилюля 578×68 на 202, дата/время 281×68 на 294, «Создать» 200×68 на 426).
  return (
    <div className="tr"><div className="tr-add-lesson-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tr-add-lesson" role="dialog" aria-modal="true">
        <button type="button" className="tr-add-lesson-close" aria-label="Закрыть" onClick={onClose}>
          <CloseIcon />
        </button>
        <h2 className="tr-add-lesson-title">Добавить новое событие</h2>
        {/* «выберите событие» — клик открывает picker (Урок / Другое событие) */}
        <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--full" onClick={() => setStage('picker')}>
          <span className="tr-add-lesson-pill-placeholder">выберите событие</span>
          <ArrowDown />
        </button>
        {/* дата + время: активны после выбора события — в самой форме урока/лекции */}
        <div className="tr-add-lesson-row">
          <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--half" onClick={() => setStage('picker')}>
            <span className="tr-add-lesson-pill-placeholder">дата</span>
            <ArrowDown />
          </button>
          <button type="button" className="tr-add-lesson-pill tr-add-lesson-pill--half" onClick={() => setStage('picker')}>
            <span className="tr-add-lesson-pill-placeholder">время</span>
            <ArrowDown />
          </button>
        </div>
        <div className="tr-add-lesson-footer">
          <button type="button" className="tr-add-lesson-btn" disabled>Создать</button>
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
