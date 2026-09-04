"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowIcon } from "@/components/icons/ArrowIcon"
import { CheckIcon } from "@/components/icons/CheckIcon"
import ChatModal from "@/components/dashboard/ChatModal"
import GroupChatModal from "@/components/dashboard/GroupChatModal"
import AddLessonModal from "./AddLessonModal"
import EditLessonModal from "./EditLessonModal"
import SiteFooter from "@/components/dashboard/SiteFooter"
import { HwPillList } from "@/components/dashboard/HwPillList"
import { ApplicationRow } from "@/components/dashboard/ApplicationRow"
import { FilesModal, type FileItem } from "@/components/dashboard/FilesModal"
import LessonRequestsModal from "./LessonRequestsModal"
import type { ScheduleItem } from "./calendar-actions"
import { disconnectGoogleCalendar } from "./calendar-actions"
import LessonRescheduleWatcher from "@/components/lesson/LessonRescheduleWatcher"
import type { LessonRequestRow } from "./request-actions"
import { acceptTrialRequest, declineTrialRequest } from "./trial-request-actions"
import { useRouter } from "next/navigation"

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

/** «55400» → «55.400». Копейки округляем к рублям (в БД всё в копейках). */
function formatRub(kopecks: number): string {
  const rub = Math.round(kopecks / 100)
  return String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

function ArrowRight({ size = 32 }: { size?: number }) {
  return <ArrowIcon direction="right" size={size} />
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden width="20" height="20">
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
function pluralize(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
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
  /** Объединённое расписание из Google Calendar + lessons.
   *  Если undefined — preview-режим (падаем на LESSONS mock).
   *  Если пустой массив — реально ничего нет (показываем «Нет событий»). */
  initialSchedule?: ScheduleItem[]
  /** Статус подключения Google Calendar — для CTA-баннера. */
  calendarConnection?: {
    connected: boolean
    googleEmail: string | null
    syncedAt: string | null
  }
  /** Pending-запросы на урок от учеников — для «запрос на урок» модалки
   *  и бейджа-счётчика. Если undefined — preview (кнопка без бейджа). */
  initialRequests?: LessonRequestRow[]
  /** Статистика для секции «доход»: количество уроков за месяц + суммы
   *  доход в копейках (за месяц и с начала года). Если undefined — preview:
   *  рендерим mock-значения из дизайна. */
  incomeStats?: {
    lessonsThisMonth: number
    earningsThisMonthKopecks: number
    earningsYtdKopecks: number
    monthLabel: string
  }
  /** Список чатов teacher: 1:1 треды (peer любой роли) + групповые чаты.
   *  Если undefined — preview (падаем на хардкод-моки в дизайне). */
  initialChats?: Array<
    | {
        kind: "direct"
        peerId: string
        peerRole: "teacher" | "student" | "admin"
        peerName: string
        peerAvatar: string | null
        lastText: string | null
        lastSenderIsMe: boolean
        lastAt: string | null
        unreadCount: number
      }
    | {
        kind: "group"
        groupId: string
        name: string
        memberCount: number
        memberAvatars: Array<{ avatar: string | null; name: string }>
        lastText: string | null
        lastSenderIsMe: boolean
        lastAt: string | null
        unreadCount: number
      }
  >
  /** Заявки на пробный урок (из БД). Undefined → используем мок-APPLICATIONS. */
  initialApplications?: Array<{
    id: string
    name: string
    level: string
    test: boolean
    createdAt: string
    /** Полный лог ответов на лендинг-квиз (для раскрытой карточки заявки). */
    testAnswers?: Array<{
      text: string
      options: string[]
      chosen: number
      correct: number
      lvl: 1 | 2 | 3 | 4
    }>
  }>
  /** Глобальные тарифы (админ настраивает); отображаются в плашке «доход». */
  teacherRates?: {
    rate60Kopecks: number
    rate90Kopecks: number
    rateGroupKopecks: number
  }
}

export default function TeacherRawDashboard({
  initialStudents,
  teacherId,
  initialSchedule,
  calendarConnection,
  initialRequests,
  incomeStats,
  initialChats,
  initialApplications,
  teacherRates,
}: TeacherRawDashboardProps = {}) {
  const now = useClock()
  const timeStr = now ? now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "16:24"
  const dateStr = now ? now.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "numeric" }) : "26.06.2026"
  const [sortOpen, setSortOpen] = useState(false)
  // «Добавить новый урок» модалка. При открытии — свежий mount, чтобы state
  // не тащил старые значения между открытиями.
  const [addLessonOpen, setAddLessonOpen] = useState(false)
  // Редактирование урока (иконка карандаша в строке расписания). Храним
  // UUID урока + label + текущий scheduledAt, чтобы модалка предзаполнилась.
  const [editLesson, setEditLesson] = useState<{
    id: string
    label: string
    scheduledAtISO: string
  } | null>(null)
  // «Как считается доход?» — info-модалка при клике на CTA в секции дохода.
  const [incomeInfoOpen, setIncomeInfoOpen] = useState(false)
  // «Запрос на урок» модалка (входящая очередь от учеников).
  const [requestsOpen, setRequestsOpen] = useState(false)
  // Модалка «Библиотека Raw English» — public-материалы, видят все.
  // Файлы тянутся из bucket teacher-materials через /api/teacher/materials.
  const [hwFilesOpen, setHwFilesOpen] = useState(false)
  const [hwFiles, setHwFiles] = useState<FileItem[]>([])
  // Модалка «Домашние задания» — двухшаговая:
  //   1) hwPickerOpen — список учеников (setHwPickerOpen)
  //   2) hwStudentId — выбранный ученик → открываем FilesModal со scoped-списком
  //      и upload'ы шарятся именно на этого ученика (target_type='student').
  const [hwPickerOpen, setHwPickerOpen] = useState(false)
  const [hwStudentId, setHwStudentId] = useState<string | null>(null)
  const [hwStudentFiles, setHwStudentFiles] = useState<FileItem[]>([])

  // Загрузка списка файлов при первом открытии модалки
  useEffect(() => {
    if (!hwFilesOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/teacher/materials?limit=200", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setHwFiles(
          (data.materials ?? []).map((m: any) => ({
            id: m.id,
            name: m.title,
            status: "loaded" as const,
            onOpen: m.signed_url ? () => window.open(m.signed_url, "_blank") : undefined,
          })),
        )
      } catch (e) {
        console.error("[hwFiles] fetch failed", e)
      }
    })()
    return () => { cancelled = true }
  }, [hwFilesOpen])

  async function handleHwUpload(file: File) {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // 1) Оптимистично добавляем в список
    setHwFiles((prev) => [
      { id: tempId, name: file.name, status: "loading", progress: 0.05 },
      ...prev,
    ])
    const setProgress = (p: number) =>
      setHwFiles((prev) => prev.map((x) => (x.id === tempId ? { ...x, progress: p } : x)))

    // Псевдо-прогресс во время upload (supabase-js .upload не даёт events).
    const tick = setInterval(() => {
      setHwFiles((prev) => prev.map((x) => {
        if (x.id !== tempId || x.status !== "loading") return x
        const next = Math.min(0.85, (x.progress ?? 0) + 0.08)
        return { ...x, progress: next }
      }))
    }, 250)

    try {
      const { createClient: createSbClient } = await import("@/lib/supabase/client")
      const supabase = createSbClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Не авторизован")

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file.bin"
      const storagePath = `${user.id}/${Date.now()}_${safeName}`

      // 2) Заливаем в bucket
      const { error: upErr } = await supabase.storage
        .from("teacher-materials")
        .upload(storagePath, file, { contentType: file.type, upsert: false })
      if (upErr) throw upErr

      setProgress(0.9)

      // 3) POST метаданных → создаст row в materials + signed URL
      const metaRes = await fetch("/api/teacher/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name,
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          tags: [],
          is_public: false,
        }),
      })
      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}))
        throw new Error(err.error || "Ошибка сохранения")
      }
      const created = await metaRes.json()

      clearInterval(tick)
      // 4) Заменяем temp-item на реальный
      setHwFiles((prev) => prev.map((x) =>
        x.id === tempId
          ? {
              id: created.id,
              name: created.title,
              status: "loaded",
              onOpen: created.signed_url ? () => window.open(created.signed_url, "_blank") : undefined,
            }
          : x,
      ))
    } catch (e) {
      console.error("[hwFiles] upload failed", e)
      clearInterval(tick)
      // Убираем неудачный item
      setHwFiles((prev) => prev.filter((x) => x.id !== tempId))
      alert(`Не удалось загрузить файл: ${e instanceof Error ? e.message : "неизвестная ошибка"}`)
    }
  }

  // ------------------- HOMEWORK PER-STUDENT -------------------
  // При выборе ученика загружаем его личный список материалов.
  useEffect(() => {
    if (!hwStudentId) { setHwStudentFiles([]); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/teacher/student-homework?studentId=${hwStudentId}`,
          { cache: "no-store" },
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setHwStudentFiles(
          (data.materials ?? []).map((m: any) => ({
            id: m.id,
            name: m.title,
            status: "loaded" as const,
            onOpen: m.signed_url ? () => window.open(m.signed_url, "_blank") : undefined,
          })),
        )
      } catch (e) {
        console.error("[hwStudentFiles] fetch failed", e)
      }
    })()
    return () => { cancelled = true }
  }, [hwStudentId])

  async function handleHwStudentUpload(file: File) {
    if (!hwStudentId) return
    const tempId = `tmp-hw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setHwStudentFiles((prev) => [
      { id: tempId, name: file.name, status: "loading", progress: 0.05 },
      ...prev,
    ])
    const setProgress = (p: number) =>
      setHwStudentFiles((prev) => prev.map((x) => (x.id === tempId ? { ...x, progress: p } : x)))
    const tick = setInterval(() => {
      setHwStudentFiles((prev) => prev.map((x) => {
        if (x.id !== tempId || x.status !== "loading") return x
        const next = Math.min(0.85, (x.progress ?? 0) + 0.08)
        return { ...x, progress: next }
      }))
    }, 250)
    try {
      const { createClient: createSbClient } = await import("@/lib/supabase/client")
      const supabase = createSbClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Не авторизован")
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file.bin"
      const storagePath = `${user.id}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage
        .from("teacher-materials")
        .upload(storagePath, file, { contentType: file.type, upsert: false })
      if (upErr) throw upErr
      setProgress(0.85)
      // 1) create material
      const metaRes = await fetch("/api/teacher/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name,
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          tags: [],
          is_public: false,
        }),
      })
      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}))
        throw new Error(err.error || "Ошибка сохранения")
      }
      const created = await metaRes.json()
      setProgress(0.95)
      // 2) share to student
      const shareRes = await fetch(`/api/teacher/materials/${created.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: [hwStudentId] }),
      })
      if (!shareRes.ok) {
        // Материал уже создан — но не привязан. Оставляем в списке, показываем ошибку.
        console.error("[hwStudentFiles] share failed", await shareRes.text().catch(() => ""))
      }
      clearInterval(tick)
      setHwStudentFiles((prev) => prev.map((x) =>
        x.id === tempId
          ? {
              id: created.id,
              name: created.title,
              status: "loaded",
              onOpen: created.signed_url ? () => window.open(created.signed_url, "_blank") : undefined,
            }
          : x,
      ))
    } catch (e) {
      console.error("[hwStudentFiles] upload failed", e)
      clearInterval(tick)
      setHwStudentFiles((prev) => prev.filter((x) => x.id !== tempId))
      alert(`Не удалось загрузить файл: ${e instanceof Error ? e.message : "неизвестная ошибка"}`)
    }
  }

  const pendingRequestsCount = initialRequests?.length ?? 0
  const [sortId, setSortId] = useState<typeof SORT_OPTIONS[number]["id"]>("default")
  // Если пропс передан (даже пустой) — используем реальные данные из БД.
  // Mock подставляем ТОЛЬКО когда пропс не пришёл вовсе (preview-режим).
  const initial = initialStudents
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
  const [chatPeer, setChatPeer] = useState<
    | {
        id: string
        role: "teacher" | "student" | "admin"
        name: string
        avatar: string | null
        level?: string
      }
    | null
  >(null)
  // Оптимистично зануляем бейдж непрочитанных при открытии треда — server-side
  // markThreadRead в fetchThreadMessages пометит их read_at, но без этого локального
  // sink'а цифра осталась бы висеть до навигации.
  const [chatUnreadOverride, setChatUnreadOverride] = useState<Record<string, number>>({})
  // То же самое для групп: локальный sink для unread badge.
  const [groupUnreadOverride, setGroupUnreadOverride] = useState<Record<string, number>>({})
  // Открытый групповой чат — храним всё, что нужно модалке.
  const [groupChat, setGroupChat] = useState<
    | { id: string; name: string; memberCount: number }
    | null
  >(null)

  // Realtime: живой badge непрочитанных для sidebar-чатов. Внутри модалки
  // ChatModal сама подписана на INSERT'ы. Тут только обновляем счётчики
  // когда модалка ЗАКРЫТА (иначе двойной инкремент).
  useEffect(() => {
    if (!teacherId) return
    let cancelled = false
    let cleanup: (() => void) | null = null
    ;(async () => {
      const { createClient: mkClient } = await import("@/lib/supabase/client")
      if (cancelled) return
      const supabase = mkClient()
      const chatCh = supabase
        .channel(`inbox:teacher:${teacherId}:${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `teacher_id=eq.${teacherId}`,
          },
          (payload: any) => {
            const row = payload.new
            if (!row || row.sender_id === teacherId) return
            if (chatPeer?.id === row.sender_id) return
            setChatUnreadOverride((prev) => ({
              ...prev,
              [row.sender_id]: (prev[row.sender_id] ?? 0) + 1,
            }))
          },
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn("[inbox:teacher] realtime status:", status, err ?? "")
          }
        })
      const groupIds = (initialChats ?? [])
        .filter((c: any) => c.kind === "group")
        .map((c: any) => c.groupId)
      const groupCh = supabase
        .channel(`inbox:teacher-groups:${teacherId}:${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "group_messages" },
          (payload: any) => {
            const row = payload.new
            if (!row || row.sender_id === teacherId) return
            if (!groupIds.includes(row.group_id)) return
            if (groupChat?.id === row.group_id) return
            setGroupUnreadOverride((prev) => ({
              ...prev,
              [row.group_id]: (prev[row.group_id] ?? 0) + 1,
            }))
          },
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn("[inbox:teacher-groups] realtime status:", status, err ?? "")
          }
        })
      cleanup = () => {
        supabase.removeChannel(chatCh)
        supabase.removeChannel(groupCh)
      }
    })()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [teacherId, chatPeer?.id, groupChat?.id, initialChats])
  const [transferTeacher, setTransferTeacher] = useState("")
  const [transferReason, setTransferReason] = useState("")
  const studentModalData = studentModalId ? studentsState.find(s => s.id === studentModalId) : null
  // «О последнем уроке» — заметка (lesson_notes) от ЛЮБОГО учителя по любому
  // уроку этого ученика. null = ещё грузится или заметок нет.
  const [studentLatestNote, setStudentLatestNote] = useState<{
    content: string
    authorName: string | null
    lessonAt: string | null
  } | null>(null)
  // «Об ученике» — общая заметка, любой teacher/admin может редактировать
  // (см. миграцию 20260901030000_student_shared_notes.sql).
  const [studentBio, setStudentBio] = useState<{
    content: string
    updatedByName: string | null
    updatedAt: string
  } | null>(null)
  const [bioDraft, setBioDraft] = useState("")
  const [bioSaving, setBioSaving] = useState(false)
  const bioLoadedRef = useRef<string | null>(null)
  const bioSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!studentModalId) {
      setStudentLatestNote(null)
      setStudentBio(null)
      setBioDraft("")
      bioLoadedRef.current = null
      if (bioSaveTimerRef.current) {
        clearTimeout(bioSaveTimerRef.current)
        bioSaveTimerRef.current = null
      }
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [noteRes, bioRes] = await Promise.all([
          fetch(`/api/teacher/students/${studentModalId}/latest-note`, { cache: 'no-store' }),
          fetch(`/api/teacher/students/${studentModalId}/bio`, { cache: 'no-store' }),
        ])
        if (cancelled) return
        if (noteRes.ok) {
          const data = await noteRes.json()
          setStudentLatestNote(data.note ?? null)
        }
        if (bioRes.ok) {
          const data = await bioRes.json()
          setStudentBio(data.note ?? null)
          const initial = data.note?.content ?? ""
          setBioDraft(initial)
          bioLoadedRef.current = initial
        } else {
          bioLoadedRef.current = ""
        }
      } catch (e) {
        console.error('[student-modal] fetch failed', e)
      }
    })()
    return () => { cancelled = true }
  }, [studentModalId])

  async function saveBio(content: string) {
    if (!studentModalId) return
    setBioSaving(true)
    try {
      const res = await fetch(`/api/teacher/students/${studentModalId}/bio`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return
      setStudentBio(data.note ?? null)
    } catch (e) {
      console.error('[student-modal] bio save failed', e)
    } finally {
      setBioSaving(false)
    }
  }

  useEffect(() => {
    if (!studentModalId) return
    if (bioLoadedRef.current === null) return
    const trimmed = bioDraft.trim().slice(0, 500)
    if (trimmed === (bioLoadedRef.current ?? "").trim().slice(0, 500)) return
    if (bioSaveTimerRef.current) clearTimeout(bioSaveTimerRef.current)
    bioSaveTimerRef.current = setTimeout(() => {
      bioLoadedRef.current = trimmed
      void saveBio(trimmed)
    }, 700)
    return () => {
      if (bioSaveTimerRef.current) {
        clearTimeout(bioSaveTimerRef.current)
        bioSaveTimerRef.current = null
      }
    }
  }, [bioDraft, studentModalId])
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
  async function changeStudentLevel(newLevel: string) {
    if (!studentModalData) return
    const target = studentModalData
    const prevLevel = target.level
    // Оптимистично меняем в UI и закрываем picker.
    setStudentsState(prev => prev.map(s => s.id === target.id ? { ...s, level: newLevel } : s))
    setLevelPickerOpen(false)
    try {
      const res = await fetch(`/api/teacher/students/${target.id}/level`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: newLevel }),
      })
      if (!res.ok) {
        // Откатываем UI при ошибке.
        setStudentsState(prev => prev.map(s => s.id === target.id ? { ...s, level: prevLevel } : s))
        const data = await res.json().catch(() => ({}))
        alert(data.error || `Не удалось сохранить уровень (HTTP ${res.status})`)
        return
      }
      // Ре-запрашиваем SSR-данные, чтобы initialStudents тоже подтянул
      // новый уровень (иначе F5 показывал старый до истечения 60с TTL).
      router.refresh()
    } catch (e) {
      setStudentsState(prev => prev.map(s => s.id === target.id ? { ...s, level: prevLevel } : s))
      alert(e instanceof Error ? e.message : "Ошибка сети при сохранении уровня")
    }
  }
  const router = useRouter()
  const [trialActionPending, setTrialActionPending] = useState<string | null>(null)
  // Локальный оптимистичный dismiss для мгновенного UI-фидбека — server-refresh
  // подтянет актуальный список из БД.
  const [dismissedTrialIds, setDismissedTrialIds] = useState<Set<string>>(new Set())
  const applications = (initialApplications ?? APPLICATIONS).filter((a) => !dismissedTrialIds.has(a.id))
  const visibleApps = appsExpanded ? applications : applications.slice(0, APPLICATIONS_VISIBLE)
  const remainingApps = applications.length - visibleApps.length

  const handleAcceptTrial = async (id: string) => {
    setTrialActionPending(id)
    try {
      const res = await acceptTrialRequest(id)
      if (!res.ok) {
        alert(res.error ?? "Не удалось взять ученика")
        return
      }
      setDismissedTrialIds((s) => new Set(s).add(id))
      router.refresh()
    } finally {
      setTrialActionPending(null)
    }
  }

  const handleDeclineTrial = async (id: string) => {
    setTrialActionPending(id)
    try {
      const res = await declineTrialRequest(id)
      if (!res.ok) {
        alert(res.error ?? "Не удалось отклонить заявку")
        return
      }
      setDismissedTrialIds((s) => new Set(s).add(id))
      router.refresh()
    } finally {
      setTrialActionPending(null)
    }
  }
  // Реальные ответы теста берём из initialApplications[expandedAppId].testAnswers
  // (если тест пройден). Иначе фолбэчимся на SAMPLE_QUESTIONS (mock).
  // Формат из БД: {text: string, options: string[], chosen, correct}. Приводим
  // к рендер-формату {text: string[], options: string[], chosen, correct} —
  // многострочный текст пока не режем, оборачиваем в 1-элемент.
  type UiQuestion = { text: string[]; options: string[]; chosen: number; correct: number }
  const expandedApp = expandedAppId
    ? (initialApplications ?? []).find((a) => a.id === expandedAppId)
    : null
  const questions: UiQuestion[] = useMemo(() => {
    if (expandedApp?.testAnswers && expandedApp.testAnswers.length > 0) {
      return expandedApp.testAnswers.map((it) => ({
        text: [it.text],
        options: it.options,
        chosen: it.chosen,
        correct: it.correct,
      }))
    }
    return SAMPLE_QUESTIONS
  }, [expandedApp])
  const qTotalPages = Math.max(1, Math.ceil(questions.length / Q_PER_PAGE))
  const currentQuestions = questions.slice(qPage * Q_PER_PAGE, (qPage + 1) * Q_PER_PAGE)
  useEffect(() => { setQPage(0) }, [expandedAppId])
  const [groupStep, setGroupStep] = useState<null | "participants" | "name" | "success">(null)
  const [groupSel, setGroupSel] = useState<Set<string>>(new Set())
  const [groupName, setGroupName] = useState("")
  const [backEnabled, setBackEnabled] = useState(false)
  // POST /api/teacher/groups в процессе — блокируем «Готово» + отдельно ошибку.
  const [groupSubmitting, setGroupSubmitting] = useState(false)
  const [groupSubmitError, setGroupSubmitError] = useState<string | null>(null)
  // Пометка «в этой сессии создан хотя бы 1 group» — чтобы closeGroupModal
  // сделал router.refresh() и группа появилась в списке чатов.
  const [groupJustCreated, setGroupJustCreated] = useState(false)
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
    setGroupSubmitError(null)
    // Если хотя бы одна группа была создана — обновляем данные с сервера,
    // чтобы initialChats подтянул её и она появилась в блоке «Чат с учениками».
    if (groupJustCreated) {
      setGroupJustCreated(false)
      router.refresh()
    }
  }
  // POST /api/teacher/groups с текущим именем/участниками. Переводит в step
  // 'success' при успехе; иначе — оставляет на 'name' с error.
  async function submitCreateGroup() {
    const trimmed = groupName.trim()
    if (!trimmed || groupSel.size < 2 || groupSubmitting) return
    setGroupSubmitting(true)
    setGroupSubmitError(null)
    try {
      const res = await fetch('/api/teacher/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          student_ids: Array.from(groupSel),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setGroupSubmitError(err.error || 'Не удалось создать группу')
        return
      }
      setGroupJustCreated(true)
      setGroupStep('success')
    } catch (e) {
      setGroupSubmitError(e instanceof Error ? e.message : 'Не удалось создать группу')
    } finally {
      setGroupSubmitting(false)
    }
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

  // ------------------- SCHEDULE VIEW (Google Calendar + lessons) -------------------
  // Если initialSchedule не пришёл (preview / нет БД) — падаем на LESSONS mock,
  // маппим mock в тот же вид, что и реальные события.
  //
  // cutoff завязан на реактивный `now` из useClock() — ре-рендерится каждые 30с
  // и одновременно удовлетворяет react-hooks/purity (никаких Date.now() в render).
  const nowMs = now ? now.getTime() : 0
  const scheduleView = useMemo(() => {
    if (initialSchedule && initialSchedule.length > 0) {
      // Показываем только события с now-1h и в будущее (короткая retention для UI),
      // а прошлые — не рендерим, чтобы не засорять секцию.
      const cutoff = nowMs - 60 * 60 * 1000
      return initialSchedule
        .filter((s) => new Date(s.startAt).getTime() >= cutoff)
        .slice(0, 20)
        .map((s) => {
          const d = new Date(s.startAt)
          const time = d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
          const date = d.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "2-digit" })
          // Для урока из БД — редиректим на нашу комнату /lesson/[id];
          // meetingUrl используем только если явно задан (Google Meet и т.п.).
          // s.id приходит с префиксом "lesson:" (см. calendar-actions.ts:141) —
          // снимаем его, иначе получится /lesson/lesson:UUID и /lesson/[id] упадёт на "/".
          const lessonUuid = s.id.startsWith("lesson:") ? s.id.slice("lesson:".length) : s.id
          const roomHref = s.source === "lesson" ? `/lesson/${lessonUuid}` : null
          return {
            id: s.id,
            source: s.source,
            time,
            date,
            startAt: s.startAt,
            label: s.title || (s.source === "google" ? "Событие календаря" : "Урок"),
            callHref: s.meetingUrl ?? roomHref,
            studentName: s.studentName ?? null,
            studentAvatar: s.studentAvatar ?? null,
          }
        })
    }
    if (initialSchedule && initialSchedule.length === 0) {
      return [] as Array<{ id: string; source: "google" | "lesson"; time: string; date: string; startAt: string; label: string; callHref: string | null; studentName: string | null; studentAvatar: string | null }>
    }
    // Preview-режим: пропс не пришёл → mock.
    return LESSONS.map((l) => ({
      id: l.id,
      source: "lesson" as const,
      time: l.time,
      date: l.date,
      startAt: new Date().toISOString(),
      label: l.label,
      callHref: null as string | null,
      studentName: null as string | null,
      studentAvatar: null as string | null,
    }))
  }, [initialSchedule, nowMs])

  return (
    <div className="tr">
      {teacherId && <LessonRescheduleWatcher userId={teacherId} role="teacher" scheduleHref="#schedule" />}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/raw-teacher.css?v=20260904-arrows-lime" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/shared-pills.css?v=1" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/files-modal.css?v=1" />

      {/* ================== HERO: nav + dark backdrop that hosts STUDENTS ================== */}
      <div className="tr-hero">
        <nav className="tr-nav">
          <Link href="/teacher" className="tr-brand" aria-label="Raw English">
            <img src="/landing/raw2/logo-raw-word-white.svg" alt="Raw English" />
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
                          <CheckIcon size={16} style={{ color: "#DFED8C" }} />
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
                placeholder="Название группы"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
              />
              <div className="tr-modal-footer">
                <button
                  type="button"
                  className="tr-modal-done"
                  onClick={submitCreateGroup}
                  disabled={!groupName.trim() || groupSubmitting}
                >
                  {groupSubmitting ? 'Создаём…' : 'Готово'}
                </button>
                {groupSubmitError && (
                  <div className="tr-add-lesson-error" role="alert" style={{ marginTop: 12 }}>
                    {groupSubmitError}
                  </div>
                )}
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
                <CheckIcon size={32} style={{ color: "#fff" }} />
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
                <ArrowIcon direction="left" size={22} style={{ color: "#fff" }} />
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
              <textarea
                className="tr-stu-modal-card tr-stu-modal-card--edit"
                maxLength={500}
                placeholder="Добавьте информацию об ученике…"
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
              />
              <div className="tr-stu-modal-count">
                {bioSaving ? "Сохраняем…" : studentBio?.updatedByName ?? ""}
              </div>
            </div>

            <div className="tr-stu-modal-section">
              <div className="tr-stu-modal-title">О последнем уроке</div>
              {studentLatestNote ? (
                <>
                  <div className="tr-stu-modal-card">
                    {studentLatestNote.content.split(/\r?\n/).map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                  </div>
                  {studentLatestNote.authorName && (
                    <div className="tr-stu-modal-count">
                      {studentLatestNote.authorName}
                      {studentLatestNote.lessonAt && (
                        <> · {new Date(studentLatestNote.lessonAt).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: '2-digit' })}</>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="tr-stu-modal-card tr-stu-modal-card--empty">
                  Пока нет заметок о прошедших уроках.
                </div>
              )}
            </div>

            <div className="tr-stu-modal-actions">
              <button
                type="button"
                className="tr-stu-modal-chat"
                onClick={() => {
                  const s = studentModalData
                  setStudentModalId(null)
                  setChatPeer({ id: s.id, role: "student", name: s.name, avatar: s.avatar ?? null, level: s.level })
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

      {/* ================== CHAT MODAL (universal: teacher↔any) ================== */}
      {chatPeer && (
        <ChatModal
          peerId={chatPeer.id}
          peerRole={chatPeer.role}
          peerName={chatPeer.name}
          peerLevel={chatPeer.level}
          peerAvatar={chatPeer.avatar ?? undefined}
          currentUserId={teacherId}
          currentRole="teacher"
          onClose={() => setChatPeer(null)}
        />
      )}

      {/* ================== GROUP CHAT MODAL ================== */}
      {groupChat && teacherId && (
        <GroupChatModal
          groupId={groupChat.id}
          groupName={groupChat.name}
          memberCount={groupChat.memberCount}
          currentUserId={teacherId}
          currentRole="teacher"
          onClose={() => setGroupChat(null)}
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
        {applications.length === 0 ? (
          <div className="tr-apps-empty" role="status">
            <img
              className="tr-apps-empty-icon"
              src="/dashboard/empty-states/no-students.svg"
              alt=""
              aria-hidden
            />
            <div className="tr-apps-empty-title">На данный момент учеников нет.</div>
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
                    <ArrowIcon direction="left" size={32} style={{ color: "#1E1E1E" }} />
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
                          <ArrowIcon direction="left" size={18} style={{ color: "#DFED8C" }} />
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
                          <ArrowIcon direction="right" size={18} style={{ color: "#DFED8C" }} />
                        </button>
                      )}
                    </div>
                    <div className="tr-app-actions">
                      <button
                        type="button"
                        className="tr-app-accept"
                        disabled={trialActionPending === a.id}
                        onClick={() => handleAcceptTrial(a.id)}
                      >
                        {trialActionPending === a.id ? "..." : "Взять ученика"}
                      </button>
                      <button
                        type="button"
                        className="tr-app-decline"
                        disabled={trialActionPending === a.id}
                        onClick={() => handleDeclineTrial(a.id)}
                      >
                        Не могу взять
                      </button>
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
        )}
      </section>

      {/* ================== SCHEDULE (dark) ================== */}
      <section id="schedule" className="tr-section tr-section-dark">
        <div className="tr-inner">
          <div className="tr-badge-wrap">
            <span className="tr-badge on-dark">
              <span className="c-lime">РАСПИСАНИЕ</span> И КАЛЕНДАРЬ
            </span>
          </div>
          <GoogleCalendarBanner
            connection={calendarConnection}
            onDisconnected={() => window.location.reload()}
          />
          <div className="tr-schedule">
            {scheduleView.length === 0 ? (
              <div className="tr-lesson-empty" role="status">
                Ближайших уроков пока нет — нажмите «добавить урок», чтобы запланировать.
              </div>
            ) : (
              scheduleView.map((l) => (
                <div className={`tr-lesson tr-lesson--${l.source}`} key={l.id}>
                  <div className="tr-lesson-time">
                    <div className="hh">{l.time}</div>
                    <div className="dd">{l.date}</div>
                  </div>
                  <div className="tr-lesson-label">{l.label}</div>
                  <button
                    type="button"
                    className="tr-lesson-edit"
                    aria-label="Изменить дату и время"
                    disabled={l.source !== "lesson"}
                    title={l.source === "lesson" ? "Изменить дату и время" : "Событие Google Calendar редактируется в Google"}
                    onClick={() => {
                      if (l.source !== "lesson") return
                      // s.id имеет формат "lesson:UUID" — снимаем префикс.
                      const uuid = l.id.startsWith("lesson:") ? l.id.slice("lesson:".length) : l.id
                      setEditLesson({ id: uuid, label: l.label, scheduledAtISO: l.startAt })
                    }}
                  >
                    <EditIcon />
                  </button>
                  {l.callHref ? (
                    <a
                      className="tr-lesson-call"
                      href={l.callHref}
                      target={l.source === "google" ? "_blank" : undefined}
                      rel={l.source === "google" ? "noreferrer" : undefined}
                    >
                      начать звонок
                    </a>
                  ) : (
                    <button type="button" className="tr-lesson-call">
                      начать звонок
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div id="calendar" className="tr-schedule-actions">
            {calendarConnection?.connected ? (
              <a
                className="tr-sched-btn lime"
                href="https://calendar.google.com/calendar/r"
                target="_blank"
                rel="noreferrer"
              >
                открыть календарь
              </a>
            ) : (
              <a className="tr-sched-btn lime" href="/api/google/oauth/start">
                подключить календарь
              </a>
            )}
            <button
              type="button"
              className="tr-sched-btn lime"
              onClick={() => setAddLessonOpen(true)}
            >
              добавить урок
            </button>
            <button
              type="button"
              className="tr-sched-btn red tr-sched-btn--with-badge"
              onClick={() => setRequestsOpen(true)}
            >
              запрос на урок
              {pendingRequestsCount > 0 && (
                <span className="tr-sched-btn-badge" aria-label={`${pendingRequestsCount} новых запросов`}>
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ================== INCOME (red) ================== */}
      <section id="income" className="tr-section tr-section-red">
        <div className="tr-inner">
          <div className="tr-income-card">
            <div className="tr-income-left">
              <div className="tr-income-header">
                <div className="tr-income-title">
                  Ваш доход
                  <br />
                  <span className="c-red">на платформе</span>
                </div>
                <div className="tr-income-metric tr-income-metric--book">
                  <img className="tr-income-icon" src="/dashboard/income/book-red.svg" alt="" aria-hidden />
                  <div className="stack">
                    <div className="value">{incomeStats?.lessonsThisMonth ?? 0}</div>
                    <span className="label">уроков<br />проведено</span>
                  </div>
                </div>
              </div>
              <button type="button" className="tr-income-cta" onClick={() => setIncomeInfoOpen(true)}>КАК СЧИТАЕТСЯ ДОХОД?</button>
            </div>

            <div className="tr-income-metric tr-income-metric--money">
              <div className="tr-income-row">
                <img className="tr-income-icon tr-income-icon--wallet" src="/dashboard/income/wallet-red.svg" alt="" aria-hidden />
                <div className="stack">
                  <span className="caption red">за {incomeStats?.monthLabel ?? new Date().toLocaleDateString("ru", { month: "long" })}</span>
                  <div className="value">{formatRub(incomeStats?.earningsThisMonthKopecks ?? 0)}</div>
                  <span className="label">рублей</span>
                </div>
              </div>
              <div className="tr-income-row">
                <img className="tr-income-icon tr-income-icon--wallet" src="/dashboard/income/wallet-lime.svg" alt="" aria-hidden />
                <div className="stack">
                  <span className="caption mut">с начала года</span>
                  <div className="value">{formatRub(incomeStats?.earningsYtdKopecks ?? 0)}</div>
                  <span className="label">рублей</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================== CHATS ================== */}
      <section id="chats" className="tr-section">
        <div className="tr-chats-frame">
          <div className="tr-chats-badge">
            ЧАТ С <span className="c-lime">УЧЕНИКАМИ</span>
          </div>

          <div className="tr-chats-card tr-chats-card--flow">
            {(!initialChats || initialChats.length === 0) && (
              <div className="tr-chats-empty">Пока нет ни одного чата. Как только ученик напишет — он появится здесь.</div>
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
                      <img src="/dashboard/chats/arrow-icon-white.svg" alt="" aria-hidden />
                    </button>
                  </div>
                )
              }
              // kind === "group"
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
                      <div className="tr-chat-avatar-fallback">
                        {initialsOf(c.memberAvatars[0]?.name ?? c.name)}
                      </div>
                    )}
                  </div>
                  {c.memberAvatars[1] && (
                    <div className="tr-chat-avatar-mini">
                      {c.memberAvatars[1].avatar ? (
                        <img src={c.memberAvatars[1].avatar} alt="" />
                      ) : (
                        <div className="tr-chat-avatar-fallback">
                          {initialsOf(c.memberAvatars[1].name)}
                        </div>
                      )}
                    </div>
                  )}
                  {c.memberAvatars[2] && (
                    <div className="tr-chat-avatar-nano">
                      {c.memberAvatars[2].avatar ? (
                        <img src={c.memberAvatars[2].avatar} alt="" />
                      ) : (
                        <div className="tr-chat-avatar-fallback">
                          {initialsOf(c.memberAvatars[2].name)}
                        </div>
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
                        {c.lastText}
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
          </div>
        </div>
      </section>

      {/* ================== HOMEWORK ================== */}
      <section id="homework" className="tr-section">
        <div className="tr-badge-wrap">
          <span className="tr-badge">
            ДОМАШНИЕ ЗАДАНИЯ И <span className="c-red">БИБЛИОТЕКА</span>
          </span>
        </div>
        <HwPillList
          items={[
            {
              label: "Домашние задания",
              onClick: () => setHwPickerOpen(true),
            },
            {
              label: <>Библиотека <span className="raw">Raw English</span></>,
              onClick: () => setHwFilesOpen(true),
            },
            { label: "История занятий", href: "/teacher/summaries" },
          ]}
        />
      </section>

      {/* ================== FOOTER ================== */}
      {/* ================== INCOME INFO MODAL ================== */}
      {incomeInfoOpen && (
        <div className="tr-modal-backdrop" onClick={() => setIncomeInfoOpen(false)}>
          <div className="tr-income-info" role="dialog" aria-modal="true" aria-labelledby="tr-inc-info-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tr-income-info-close" aria-label="Закрыть" onClick={() => setIncomeInfoOpen(false)}>
              <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <p className="tr-income-info-text" id="tr-inc-info-title">
              {(() => {
                const fmt = (k?: number) => (k && k > 0 ? Math.round(k / 100).toLocaleString("ru-RU") : "______")
                const r60 = fmt(teacherRates?.rate60Kopecks)
                const r90 = fmt(teacherRates?.rate90Kopecks)
                const rG = fmt(teacherRates?.rateGroupKopecks)
                return (
                  <>
                    Ваш доход считается исходя из кол-ва часов, которые вы провели с учениками.
                    Каждый проведенный урок на 1 час стоит {r60} рублей, каждый проведенный урок
                    на 1,5 часа стоит {r90} рублей, каждое занятие с группой стоит {rG} рублей.
                  </>
                )
              })()}
            </p>
            <p className="tr-income-info-q">Остались вопросы?</p>
            <button type="button" className="tr-income-info-cta">Пиши администратору</button>
          </div>
        </div>
      )}

      <SiteFooter
        onSupportClick={async () => {
          // «Написать в поддержку» → чат с админом. Сообщение падает в
          // chat_messages, админ видит его в общем списке чатов.
          try {
            const r = await fetch("/api/support/admin-peer", { cache: "no-store" })
            const j = await r.json()
            if (r.ok && j.admin?.id) {
              setChatPeer({ id: j.admin.id, role: "admin", name: j.admin.name, avatar: j.admin.avatar })
            }
          } catch {
            /* fail-soft */
          }
        }}
      />

      {/* ================== ADD LESSON MODAL ================== */}
      {addLessonOpen && (
        <AddLessonModal
          students={studentsState.map((s) => ({
            id: s.id,
            name: s.name,
            level: s.level,
            avatar: s.avatar,
          }))}
          onClose={() => setAddLessonOpen(false)}
        />
      )}

      {/* ================== EDIT LESSON MODAL ================== */}
      {editLesson && (
        <EditLessonModal
          lesson={editLesson}
          onClose={() => setEditLesson(null)}
        />
      )}

      {/* ================== LESSON REQUESTS MODAL ================== */}
      {requestsOpen && (
        <LessonRequestsModal
          requests={initialRequests ?? []}
          onClose={() => setRequestsOpen(false)}
          onOpenChat={(studentId) => {
            const s = studentsState.find((x) => x.id === studentId)
            if (!s) return
            setChatPeer({ id: s.id, role: "student", name: s.name, avatar: s.avatar ?? null, level: s.level })
          }}
        />
      )}

      {/* ================== LIBRARY FILES MODAL ================== */}
      {hwFilesOpen && (
        <FilesModal
          title="Библиотека Raw English"
          files={hwFiles}
          onClose={() => setHwFilesOpen(false)}
          onFilePicked={handleHwUpload}
          multiple
          onDelete={async (ids) => {
            const results = await Promise.allSettled(
              ids.map((id) =>
                fetch(`/api/teacher/materials/${id}`, { method: "DELETE" }),
              ),
            )
            const failedCount = results.filter(
              (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
            ).length
            if (failedCount > 0) {
              alert(`Не удалось удалить ${failedCount} из ${ids.length} файлов`)
            }
            const deletedIds = new Set(
              ids.filter((_, i) => {
                const r = results[i]
                return r.status === "fulfilled" && r.value.ok
              }),
            )
            setHwFiles((prev) => prev.filter((x) => !deletedIds.has(x.id)))
          }}
        />
      )}

      {/* ================== HOMEWORK STUDENT PICKER ================== */}
      {hwPickerOpen && (
        <div className="tr-modal-backdrop" onClick={() => setHwPickerOpen(false)}>
          <div
            className="tr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tr-hw-picker-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tr-modal-close"
              aria-label="Закрыть"
              onClick={() => setHwPickerOpen(false)}
            >
              <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <h2 id="tr-hw-picker-title" className="tr-modal-title">
              Выберите ученика
            </h2>
            <div className="tr-modal-list">
              {sortedStudents.length === 0 ? (
                <div className="tr-modal-empty">Учеников пока нет</div>
              ) : (
                sortedStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="tr-modal-row"
                    onClick={() => {
                      setHwStudentId(s.id)
                      setHwPickerOpen(false)
                    }}
                  >
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
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================== HOMEWORK PER-STUDENT FILES MODAL ================== */}
      {hwStudentId && (
        <FilesModal
          title={`Домашка — ${studentsState.find((s) => s.id === hwStudentId)?.name ?? "ученик"}`}
          files={hwStudentFiles}
          onClose={() => setHwStudentId(null)}
          onFilePicked={handleHwStudentUpload}
          multiple
          onDelete={async (ids) => {
            const results = await Promise.allSettled(
              ids.map((id) =>
                fetch(`/api/teacher/materials/${id}`, { method: "DELETE" }),
              ),
            )
            const failedCount = results.filter(
              (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
            ).length
            if (failedCount > 0) {
              alert(`Не удалось удалить ${failedCount} из ${ids.length} файлов`)
            }
            const deletedIds = new Set(
              ids.filter((_, i) => {
                const r = results[i]
                return r.status === "fulfilled" && r.value.ok
              }),
            )
            setHwStudentFiles((prev) => prev.filter((x) => !deletedIds.has(x.id)))
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GoogleCalendarBanner: всегда показывает статус подключения.
//   - connected=false → красная плашка + CTA «Подключить»
//   - connected=true  → лаймовая плашка «Подключён: email» + «Отключить»
// В preview-режиме (connection не передан) не рендерится.
// ---------------------------------------------------------------------------

interface GoogleCalendarBannerProps {
  connection?: {
    connected: boolean
    googleEmail: string | null
    syncedAt: string | null
  }
  onDisconnected?: () => void
}

function GoogleCalendarBanner({ connection, onDisconnected }: GoogleCalendarBannerProps) {
  const [busy, setBusy] = useState(false)
  if (!connection) return null // preview-режим

  if (connection.connected) {
    return (
      <div className="tr-gcal-banner tr-gcal-banner--ok">
        <div className="tr-gcal-banner-text">
          <span className="tr-gcal-dot tr-gcal-dot--ok" aria-hidden /> Google Calendar подключён
          {connection.googleEmail ? <> — <b>{connection.googleEmail}</b></> : null}
        </div>
        <button
          type="button"
          className="tr-gcal-banner-unlink"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Отключить Google Calendar? Новые уроки перестанут попадать в него.")) return
            setBusy(true)
            try {
              await disconnectGoogleCalendar()
              onDisconnected?.()
            } catch (e) {
              alert("Не удалось отключить: " + (e instanceof Error ? e.message : String(e)))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? "..." : "Отключить"}
        </button>
      </div>
    )
  }

  return (
    <div className="tr-gcal-banner">
      <div className="tr-gcal-banner-text">
        <span className="tr-gcal-dot tr-gcal-dot--off" aria-hidden /> Google Calendar не подключён.
        Новые уроки не будут попадать в него автоматически.
      </div>
      <a className="tr-sched-btn lime tr-gcal-banner-btn" href="/api/google/oauth/start">
        Подключить Google Calendar
      </a>
    </div>
  )
}
