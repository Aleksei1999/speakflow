"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react"
const Q_PER_PAGE_ADMIN = 3
import Link from "next/link"
import CustomScroll from "@/components/dashboard/CustomScroll"
import SiteFooter from "@/components/dashboard/SiteFooter"
import { HwPillList } from "@/components/dashboard/HwPillList"
import ChatModal from "@/components/dashboard/ChatModal"
import GroupChatModal from "@/components/dashboard/GroupChatModal"
import { nb } from "@/lib/ru/typo"
import { FilesModal, type FileItem, type FolderItem } from "@/components/dashboard/FilesModal"
import { listFolders, createFolder, renameFolder, deleteFolders } from "@/lib/materials/folders"
import type { ChatListItem } from "@/lib/chat/list"
import AdminAddLessonModal from "./AdminAddLessonModal"
import AdminAddLectureModal from "./AdminAddLectureModal"
import AdminStudentModal from "./AdminStudentModal"
import AdminCreateGroupModal from "./AdminCreateGroupModal"
import EditLessonModal from "@/app/(teacher-full)/teacher/EditLessonModal"
import { rescheduleLecture } from "./admin-actions"
import { type AddLessonStudent, ArrowDown, CloseIcon } from "@/app/(teacher-full)/teacher/AddLessonModal"
import { initialsOf, paletteFor } from "@/lib/ui/initials"
import { pluralize } from "@/lib/ru/plural"
import { useClock, levelLabel } from "@/lib/dashboard-ui"

/* Admin Dashboard — Figma «Администратор RAW english» (file YSwlSQF1n6QIpGTOohlMOd,
   node 2208:1206). CSS scope: `.ad`. */

const NAV = [
  { href: "#schedule", label: "Занятия и расписание" },
  { href: "#library", label: "Библиотека" },
  { href: "#leads", label: "Лиды" },
  { href: "#chats", label: "Звонки" },
  { href: "#teachers", label: "Учителя" },
  { href: "#students", label: "Ученики" },
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
      // Ниже 1441 страница тоже масштабируется (иначе блоки шириной 1441 вылезают за край окна и режутся)
      const z = Math.min(w / 1441, 1.4)
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
  adminUserId?: string
  teachers?: Array<{ id: string; name: string; avatar: string | null
    bio?: string | null
    banned?: boolean }>
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
  const router = useRouter()
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
  // Figma 2522:3740: клик по «Домашние задания» открывает выбор ученика (панель как в списке учеников), затем ДЗ выбранного
  const [hwPickerOpen, setHwPickerOpen] = useState(false)
  useEffect(() => {
    ;(window as any).__openHwPicker = () => setHwPickerOpen(true)
    return () => { delete (window as any).__openHwPicker }
  }, [])
  useEffect(() => {
    if (!hwPickerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setHwPickerOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [hwPickerOpen])
  const [hwUploading, setHwUploading] = useState(false)
  const [homeworkVersion, setHomeworkVersion] = useState(0)
  const [libraryVersion, setLibraryVersion] = useState(0)
  const [libraryUploading, setLibraryUploading] = useState(false)

  // Папки Библиотеки. Верхний уровень = список папок,
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

  // Создание группы (Figma 2522:2968 участники → 2522:2921 название → 2522:2579 готово).
  // API требует учителя группы, в макете его выбора нет — добавлен отдельный шаг «Выберите учителя группы»
  // между участниками и названием, в оформлении шага участников.
  const [groupStep, setGroupStep] = useState<null | "form" | "participants" | "teacher" | "name" | "success" | "form-success">(null)
  const [groupName, setGroupName] = useState("")
  const [groupTeacherId, setGroupTeacherId] = useState<string>("")
  const [groupStudentSel, setGroupStudentSel] = useState<Set<string>>(new Set())
  const [groupSubmitting, setGroupSubmitting] = useState(false)
  const [groupError, setGroupError] = useState<string | null>(null)
  const [groupBackEnabled, setGroupBackEnabled] = useState(false)
  const groupOpen = groupStep !== null
  // Список teacher_profiles (id + full_name) — грузим при первом открытии.
  const [teacherProfiles, setTeacherProfiles] = useState<Array<{ id: string; name: string; avatar: string | null }>>([])
  useEffect(() => {
    if (!groupOpen || teacherProfiles.length > 0) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch("/api/booking/teachers", { cache: "no-store" })
        if (!r.ok) return
        const j = await r.json()
        if (cancelled) return
        setTeacherProfiles((j.teachers ?? []).map((t: any) => ({ id: t.teacherProfileId, name: t.name, avatar: t.avatarUrl ?? null })))
      } catch (e) { console.error("[admin groups] teachers fetch", e) }
    })()
    return () => { cancelled = true }
  }, [groupOpen, teacherProfiles.length])
  // Figma 2522:2943: таймер 0:59 → 0:00, пока он идёт — можно вернуться назад; после — группа окончательно сохранена
  const [groupBackSec, setGroupBackSec] = useState(59)
  useEffect(() => {
    if (groupStep !== "success" && groupStep !== "form-success") { setGroupBackEnabled(false); return }
    setGroupBackEnabled(true)
    setGroupBackSec(59)
    const iv = setInterval(() => setGroupBackSec((s) => (s > 0 ? s - 1 : 0)), 1000)
    const t = setTimeout(() => setGroupBackEnabled(false), 60_000)
    return () => { clearInterval(iv); clearTimeout(t) }
  }, [groupStep])
  useEffect(() => {
    if (!groupOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeGroupModal() }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupOpen])
  function toggleGroupSel(id: string) {
    setGroupStudentSel((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function closeGroupModal() {
    setGroupStep(null)
    setGroupStudentSel(new Set())
    setGroupName("")
    setGroupTeacherId("")
    setGroupError(null)
  }
  async function submitCreateGroup() {
    const trimmed = groupName.trim()
    if (!trimmed || !groupTeacherId || groupStudentSel.size < 1 || groupSubmitting) return
    setGroupSubmitting(true); setGroupError(null)
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, teacher_id: groupTeacherId, student_ids: Array.from(groupStudentSel) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setGroupError(j.error || "Не удалось создать группу")
        return
      }
      setGroupStep(groupStep === "form" ? "form-success" : "success")
      // Список чатов приходит с сервера (initialChats) — обновляем, чтобы новая группа появилась без перезагрузки.
      router.refresh()
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
        const rows = await listFolders("library")
        if (cancelled) return
        setLibraryFolders(rows.map((f) => ({ id: f.id, name: f.name, count: f.count })))
      } catch (e) { console.error("[admin library folders]", e) }
    })()
    return () => { cancelled = true }
  }, [libraryOpen, libraryVersion])

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
  // Правки из карточки преподавателя (имя / описание / фото) — сразу в карточках, без перезагрузки
  const [teacherEdits, setTeacherEdits] = useState<Record<string, { name?: string; bio?: string | null; avatar?: string | null; banned?: boolean }>>({})
  const teachersBase =
    teachers && teachers.length > 0 ? teachers : TEACHERS_MOCK
  const teachersData = teachersBase.map((t) => {
    const e = teacherEdits[t.id]
    return e ? { ...t, name: e.name ?? t.name, bio: e.bio !== undefined ? e.bio : (t as { bio?: string | null }).bio, avatar: e.avatar !== undefined ? e.avatar : t.avatar, banned: e.banned !== undefined ? e.banned : (t as { banned?: boolean }).banned } : t
  })
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
    // Теста нет — вопросов не показываем.
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
      if (!t.closest?.(".tr-sort-wrap")) setSortOpen(false) // попап на разметке учителя: .tr-sort-wrap, иначе закрывался до клика по пункту
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [sortOpen])

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
  // Figma 2522:7322 «Чат с учеником» (админ): кнопки видео/аудио ведут в комнату ближайшего урока ученика; без урока — неактивны
  const lessonCallHrefFor = (studentId: string): string | null => {
    const now = Date.now()
    const next = allScheduleView
      .filter((l) => !String(l.id).startsWith("lec:") && l.studentId === studentId && new Date(l.scheduledAt).getTime() >= now - 60 * 60 * 1000)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0]
    return next ? `/lesson/${String(next.id)}` : null
  }
  // Плашка урока/лекции (панель и полный календарь).
  const renderScheduleRow = (l: (typeof allScheduleView)[number]) => {
                  const isLecture = String(l.id).startsWith("lec:")
                  const rawId = isLecture ? String(l.id).slice(4) : String(l.id)
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
                      {/* «начать звонок» убрана по просьбе заказчика: админ не участвует в звонках */}
                    </div>
                  )
  }

  return (
    <div className="ad">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="/dashboard/raw-admin.css?v=20260909-ban"
      />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/shared-pills.css?v=20260908-arrow2" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/files-modal.css?v=20260908-figma" />
      {/* teacher-css нужен для .tr-add-lesson-* (модалка «Добавить событие»
          у админа переиспользует UI из teacher). */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/raw-teacher.css?v=20260909-sort" />

      {/* HERO: nav + dark card holding SCHEDULE */}
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

      {/* HOMEWORK & LIBRARY */}
      <section id="library" className="ad-section">
        <div className="ad-badge-wrap">
          <span className="ad-badge">
            ДОМАШНИЕ ЗАДАНИЯ И <span className="c-red">БИБЛИОТЕКА</span>
          </span>
        </div>
        <HwPillList
          items={[
            { label: "Домашние задания", onClick: () => setHwPickerOpen(true) },
            { label: <>Библиотека <span className="raw">Raw English</span></>, onClick: () => setLibraryOpen(true) },
            { label: "История занятий", href: "/admin/history" },
          ]}
        />
      </section>

      {/* Верстка 1:1 как у учителя — переиспользуем .tr-chats-* / .tr-chat-row-*.
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
                          // уровень для плашки в шапке чата (2522:7322): из списка чатов, иначе из списка учеников
                          level: c.peerLevel ?? (c.peerRole === "student" ? sortedStudents.find((s) => s.id === c.peerId)?.level : undefined) ?? undefined,
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
          <button type="button" className="ad-chats-create" onClick={() => setGroupStep("form")}>
            Создать группу
            <span className="ad-chats-create-arrow" aria-hidden>
              <img className="ad-chats-create-arrow-circle" src="/dashboard/ic-arrow-circle-lime.svg" alt="" width={67} height={68} />
              <img className="ad-chats-create-arrow-glyph" src="/dashboard/ic-arrow-right.svg" alt="" width={37} height={36.82} />
            </span>
          </button>
        </div>
      </section>
      </div>

      {/* TEACHERS (Figma 2208-62 / 2208-1406 / 2208-1408) */}
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
                  className={`ad-teacher${(t as { banned?: boolean }).banned ? " ad-teacher--banned" : ""}`}
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTeacherModal({ id: t.id, name: t.name, avatar: t.avatar })}
                >
                  {(t as { banned?: boolean }).banned && <div className="ad-teacher-banned">отключён</div>}
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
                    <div className="ad-teacher-desc">{nb((t as { bio?: string | null }).bio || "Сколько учеников, какой доход, какая маржа, сколько уроков...")}</div>
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

      {/* STUDENTS (dark bg) */}
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
              <button type="button" className="tr-create-group" onClick={() => setGroupStep("participants")}>
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

      {/* INCOMING APPLICATIONS (UI 1:1 как у учителя) */}
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

      <SiteFooter variant="admin" />

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
          callHref={chatPeer.role === "student" ? lessonCallHrefFor(chatPeer.id) : null}
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

      {/* Figma 2522:3740 «Домашние задания (окно)»: панель 1228×725 как в списке учеников — «Сортировать» на (54,57),
          сетка учеников 539×139 в две колонки с 151, трек 7×495 на 1203, крестик lime на (1181,31). Клик по ученику открывает его ДЗ */}
      {hwPickerOpen && (
        <div className="tr">
          <div className="files-modal-backdrop ad-hw-picker-backdrop" onClick={() => setHwPickerOpen(false)}>
            <div className="tr-panel ad-hw-picker" role="dialog" aria-modal="true" aria-label="Домашние задания: выберите ученика" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="ad-hw-picker-close" aria-label="Закрыть" onClick={() => setHwPickerOpen(false)}>
                <img src="/dashboard/ic-close-lime.svg" alt="" aria-hidden />
              </button>
              <div className="tr-sort-wrap">
                <button type="button" className="tr-sort" aria-expanded={sortOpen} aria-haspopup="listbox" onClick={() => setSortOpen((v) => !v)}>
                  Сортировать
                </button>
                {sortOpen && (
                  <div className="tr-sort-pop" role="listbox">
                    {SORT_OPTIONS.map((o) => (
                      <button key={o.id} type="button" role="option" aria-selected={sortId === o.id} className={`tr-sort-opt ${sortId === o.id ? "on" : ""}`} onClick={() => { setSortId(o.id); setSortOpen(false) }}>
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
                      onClick={() => { setHwPickerOpen(false); setHwUploadTarget(s.id) }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setHwPickerOpen(false); setHwUploadTarget(s.id) } }}
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
            </div>
          </div>
        </div>
      )}

      {/* Модалка карточки учителя (Figma 2208-62) — реальные данные + upload фото */}
      {teacherModal && (
        <TeacherDetailModal
          teacherId={teacherModal.id}
          fallbackName={teacherModal.name}
          fallbackAvatar={teacherModal.avatar}
          onSaved={(patch) => setTeacherEdits((prev) => ({ ...prev, [teacherModal.id]: { ...prev[teacherModal.id], ...patch } }))}
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
                {(teachersData ?? []).filter((t) => !(t as { banned?: boolean }).banned).slice(assignPage, assignPage + TEACHERS_PER_PAGE).map((t) => {
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
                        <div className="ad-teacher-desc">{nb((t as { bio?: string | null }).bio || "Сколько учеников, какой доход, какая маржа, сколько уроков...")}</div>
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

      {/* Создание группы (админ): Figma 2522:2968 участники → название + учитель → готово. Разметка и стили — как у учителя (.tr-modal-*) */}
      {/* Figma 2522:592 «Создать группу» из блока «Чаты»: название + преподаватель + ученики + «Создать» */}
      {groupStep === "form" && (
        <AdminCreateGroupModal
          teachers={teacherProfiles}
          students={sortedStudents.map((s) => ({ id: s.id, name: s.name }))}
          groupName={groupName}
          setGroupName={setGroupName}
          groupTeacherId={groupTeacherId}
          setGroupTeacherId={setGroupTeacherId}
          groupStudentSel={groupStudentSel}
          toggleStudent={toggleGroupSel}
          submitting={groupSubmitting}
          error={groupError}
          onSubmit={submitCreateGroup}
          onClose={closeGroupModal}
        />
      )}
      {groupOpen && groupStep !== "form" && (
        <div className="tr ad-group-flow">
          <div className="tr-modal-backdrop" onClick={closeGroupModal}>
            {/* Figma 2522:2968 «Создание группы»: 686×869, заголовок top 79, ряды 539×139 с 183 (шаг 178),
                чекбоксы 36 на x=52, «Создать группу» 357×68 at (165,750) */}
            {groupStep === "participants" && (
              <div className="tr-modal tr-modal--group" role="dialog" aria-modal="true" aria-labelledby="ad-group-title" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="tr-modal-close" aria-label="Закрыть" onClick={closeGroupModal}>
                  <img src="/dashboard/ic-close-lime.svg" alt="" aria-hidden />
                </button>
                <h2 id="ad-group-title" className="tr-modal-title">Выберите участников группы</h2>
                <div className="tr-modal-list">
                  {sortedStudents.map((s) => {
                    const on = groupStudentSel.has(s.id)
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
                          <img className="tr-modal-check-circle" src={on ? "/dashboard/files/check-on.svg" : "/dashboard/files/check-off.svg"} alt="" width={36} height={36} />
                          {on && <img className="tr-modal-check-mark" src="/dashboard/files/check-mark.svg" alt="" width={20} height={17} />}
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
                    onClick={() => setGroupStep("teacher")}
                    disabled={groupStudentSel.size < 2}
                  >
                    Создать группу
                  </button>
                </div>
              </div>
            )}

            {/* Шаг учителя (в макете нет): та же модалка, что у участников, один выбор, кнопка «Далее» */}
            {groupStep === "teacher" && (
              <div className="tr-modal tr-modal--group" role="dialog" aria-modal="true" aria-labelledby="ad-group-teacher-title" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="tr-modal-close" aria-label="Закрыть" onClick={closeGroupModal}>
                  <img src="/dashboard/ic-close-lime.svg" alt="" aria-hidden />
                </button>
                <h2 id="ad-group-teacher-title" className="tr-modal-title">Выберите учителя группы</h2>
                <div className="tr-modal-list" role="radiogroup">
                  {teacherProfiles.length === 0 && <div className="ad-group-teacher-empty">Загружаем список учителей…</div>}
                  {teacherProfiles.map((tp) => {
                    const on = groupTeacherId === tp.id
                    return (
                      <button
                        key={tp.id}
                        type="button"
                        className={`tr-modal-row ${on ? "on" : ""}`}
                        role="radio"
                        aria-checked={on}
                        onClick={() => setGroupTeacherId(on ? "" : tp.id)}
                      >
                        <span className={`tr-modal-check ${on ? "on" : ""}`} aria-hidden>
                          <img className="tr-modal-check-circle" src={on ? "/dashboard/files/check-on.svg" : "/dashboard/files/check-off.svg"} alt="" width={36} height={36} />
                          {on && <img className="tr-modal-check-mark" src="/dashboard/files/check-mark.svg" alt="" width={20} height={17} />}
                        </span>
                        <div className="tr-stu tr-stu--modal ad-group-teacher-row">
                          <div className="tr-stu-avatar">
                            <Avatar name={tp.name} src={tp.avatar} />
                          </div>
                          <div className="tr-stu-name">
                            {tp.name.split(/\s+/).map((part, i) => (
                              <span key={i} className="tr-stu-name-line">{part}</span>
                            ))}
                          </div>
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
                    disabled={!groupTeacherId}
                  >
                    Далее
                  </button>
                </div>
              </div>
            )}

            {/* Figma 2522:2921 «Имя группы после создания»: 686×428, крестик (638,35), заголовок 79, поле 578×68 на (54,196)
                с плейсхолдером «название группы», «Готово» 182×68 на (252,298) */}
            {groupStep === "name" && (
              <div className="tr-modal tr-modal--name ad-group-name" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="tr-modal-close tr-modal-close--dark" aria-label="Закрыть" onClick={closeGroupModal}>
                  <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
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
                    className={`tr-modal-done${groupSubmitting ? " busy" : ""}`}
                    onClick={submitCreateGroup}
                    disabled={!groupName.trim() || !groupTeacherId || groupSubmitting}
                  >
                    Готово
                  </button>
                  {groupError && (
                    <div className="tr-add-lesson-error" role="alert" style={{ marginTop: 12 }}>{groupError}</div>
                  )}
                </div>
              </div>
            )}

            {/* Figma 2522:2617 «Оповещение о созданой группе» (после формы из чатов): 503×527; таймер на 33; заголовок «Группа добавлена / в чаты» на 86;
                галочка 69 на (217,189); название группы 20/500 на 275; учитель 36/700 на 295; ученики 32/500 на 339 (до двух строк); назад 46×47 на (229,438) */}
            {groupStep === "form-success" && (
              <div className="tr-modal tr-modal--success ad-group-success ad-group-form-success" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <div className="ad-group-success-timer" aria-live="off">{`0:${String(groupBackSec).padStart(2, "0")}`}</div>
                <button type="button" className="tr-modal-close tr-modal-close--dark" aria-label="Закрыть" onClick={closeGroupModal}>
                  <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
                </button>
                <p className="tr-modal-success-title">
                  Группа добавлена
                  <br />
                  {nb("в чаты")}
                </p>
                <div className="tr-modal-success-check" aria-hidden>
                  <img className="tr-modal-success-check-circle" src="/dashboard/ic-check-circle.svg" alt="" width={69} height={69} />
                  <img className="tr-modal-success-check-mark" src="/dashboard/ic-check-mark.svg" alt="" width={35} height={29} />
                </div>
                <div className="ad-group-form-success-sub">{groupName || "Группа"}</div>
                <h3 className="tr-modal-success-name">{teacherProfiles.find((tp) => tp.id === groupTeacherId)?.name ?? "Преподаватель"}</h3>
                <div className="ad-group-form-success-students">
                  {nb(sortedStudents.filter((s) => groupStudentSel.has(s.id)).map((s) => s.name).join(", "))}
                </div>
                <button
                  type="button"
                  className="tr-modal-success-back"
                  aria-label={groupBackEnabled ? "Вернуться к форме" : "Отменить нельзя — прошло 60 сек"}
                  onClick={() => setGroupStep("form")}
                  disabled={!groupBackEnabled}
                >
                  <img className="tr-modal-success-back-circle" src="/dashboard/ic-back-circle-red.svg" alt="" width={46} height={47} />
                  <img className="tr-modal-success-back-glyph" src="/dashboard/ic-back-arrow-white.svg" alt="" width={25} height={22.09} />
                </button>
              </div>
            )}

            {/* Figma 2522:2943: 503×431; таймер 0:59 на 33; заголовок 86 (две строки); галочка 69 at (217,185); имя 36 bold на 278; назад 46×47 at (229,353) */}
            {groupStep === "success" && (
              <div className="tr-modal tr-modal--success ad-group-success" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <div className="ad-group-success-timer" aria-live="off">{`0:${String(groupBackSec).padStart(2, "0")}`}</div>
                <button type="button" className="tr-modal-close tr-modal-close--dark" aria-label="Закрыть" onClick={closeGroupModal}>
                  <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
                </button>
                <p className="tr-modal-success-title">
                  Группа создана
                  <br />
                  {nb("и появится у вас в чатах")}
                </p>
                <div className="tr-modal-success-check" aria-hidden>
                  <img className="tr-modal-success-check-circle" src="/dashboard/ic-check-circle.svg" alt="" width={69} height={69} />
                  <img className="tr-modal-success-check-mark" src="/dashboard/ic-check-mark.svg" alt="" width={35} height={29} />
                </div>
                <h3 className="tr-modal-success-name">{groupName || "Группа"}</h3>
                <button
                  type="button"
                  className="tr-modal-success-back"
                  aria-label={groupBackEnabled ? "Вернуться к вводу названия" : "Отменить нельзя — прошло 60 сек"}
                  onClick={() => setGroupStep("name")}
                  disabled={!groupBackEnabled}
                >
                  <img className="tr-modal-success-back-circle" src="/dashboard/ic-back-circle-red.svg" alt="" width={46} height={47} />
                  <img className="tr-modal-success-back-glyph" src="/dashboard/ic-back-arrow-white.svg" alt="" width={25} height={22.09} />
                </button>
              </div>
            )}
          </div>
        </div>
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
  onSaved,
}: {
  teacherId: string
  fallbackName: string
  fallbackAvatar: string | null
  onClose: () => void
  /** Сообщает родителю сохранённые правки, чтобы карточки в списке обновились сразу */
  onSaved?: (patch: { name?: string; bio?: string | null; avatar?: string | null; banned?: boolean }) => void
}) {
  const [data, setData] = useState<{
    full_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
    bio: string | null
    lessons_this_month: number
    lessons_this_year: number
    banned_at?: string | null
  } | null>(null)
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  // Редактирование имени и описания по кнопке-карандашу: поля выглядят как текст, сохраняются по уходу с поля
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [bioDraft, setBioDraft] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  // «Отключить от платформы» = бан: вход закрыт, через 30 дней без возврата аккаунт удаляется кроном
  const [banBusy, setBanBusy] = useState(false)
  const bannedAt = data?.banned_at ?? null
  const purgeDaysLeft = bannedAt ? Math.max(0, 30 - Math.floor((Date.now() - new Date(bannedAt).getTime()) / 86400000)) : null
  async function toggleBan() {
    const banning = !bannedAt
    const ok = window.confirm(banning
      ? `Отключить ${name} от платформы? Учитель не сможет войти. Если не вернуть его в течение 30 дней, аккаунт будет удалён.`
      : `Вернуть ${name} на платформу?`)
    if (!ok) return
    setBanBusy(true)
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banned: banning }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      const at = banning ? new Date().toISOString() : null
      setData((d) => (d ? { ...d, banned_at: at } : d))
      onSaved?.({ banned: banning })
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось изменить статус")
    } finally {
      setBanBusy(false)
    }
  }
  // высота описания = высоте текста (до 187), чтобы подсветка поля не наезжала на цифры ниже
  const bioRef = useRef<HTMLTextAreaElement | null>(null)
  const bioValue = bioDraft ?? (data?.bio ?? "")
  useLayoutEffect(() => {
    const el = bioRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(187, el.scrollHeight)}px`
  }, [bioValue])
  async function saveField(field: "full_name" | "bio", value: string) {
    setSaveState("saving")
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setData((d) => (d ? { ...d, [field]: value } : d))
      onSaved?.(field === "full_name" ? { name: value } : { bio: value })
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 1500)
    } catch (err) {
      setSaveState("error")
      alert(err instanceof Error ? err.message : "Не удалось сохранить")
    }
  }

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
      onSaved?.({ avatar: url })
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

        <input
          className="ad-tmodal-name ad-tmodal-edit"
          value={nameDraft ?? name}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => { const v = (nameDraft ?? name).trim(); setNameDraft(null); if (v && v !== name) void saveField("full_name", v) }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
          aria-label="Имя преподавателя"
          title="Нажмите, чтобы изменить имя"
          maxLength={120}
        />
        <div className="ad-tmodal-meta">о преподавателе</div>
        <textarea
          ref={bioRef}
          className="ad-tmodal-desc ad-tmodal-edit"
          value={bioValue}
          placeholder="Сколько учеников, какой доход, какая маржа, сколько уроков..."
          onChange={(e) => setBioDraft(e.target.value.slice(0, 500))}
          onBlur={() => { const v = (bioDraft ?? data?.bio ?? "").trim(); setBioDraft(null); if (v !== (data?.bio ?? "")) void saveField("bio", v) }}
          aria-label="Описание преподавателя"
          title="Нажмите, чтобы изменить описание"
          rows={4}
        />
        {saveState !== "idle" && (
          <div className={`ad-tmodal-save ad-tmodal-save--${saveState}`} role="status">
            {saveState === "saving" ? "Сохраняем…" : saveState === "saved" ? "Сохранено" : "Ошибка"}
          </div>
        )}

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
        <button
          type="button"
          className={`ad-tmodal-btn ad-tmodal-btn--off${bannedAt ? " ad-tmodal-btn--off-active" : ""}`}
          onClick={toggleBan}
          disabled={banBusy}
        >
          {banBusy ? "Секунду…" : bannedAt ? "Вернуть на платформу" : "Отключить от платформы"}
        </button>
        {bannedAt && (
          <div className="ad-tmodal-banned" role="status">
            {nb(`Отключён ${new Date(bannedAt).toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "2-digit" })}. Аккаунт будет удалён через ${purgeDaysLeft} ${purgeDaysLeft === 1 ? "день" : purgeDaysLeft && purgeDaysLeft < 5 ? "дня" : "дней"}, если не вернуть.`)}
          </div>
        )}
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

