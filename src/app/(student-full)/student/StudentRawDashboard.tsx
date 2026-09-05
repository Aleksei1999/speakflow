"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowIcon } from "@/components/icons/ArrowIcon"
import { useRouter } from "next/navigation"
import SiteFooter from "@/components/dashboard/SiteFooter"
import { HwPillList } from "@/components/dashboard/HwPillList"
import ChatModal from "@/components/dashboard/ChatModal"
import GroupChatModal from "@/components/dashboard/GroupChatModal"
import StudentAddLessonModal from "@/components/student/StudentAddLessonModal"
import { FilesModal, type FileItem, type FolderItem } from "@/components/dashboard/FilesModal"
import { listFolders } from "@/lib/materials/folders"
import type { ChatListItem } from "@/lib/chat/list"
import { toRoastLevel, ROAST_LEVELS } from "@/lib/levels/mapping"
import { normalizePhoneRu } from "@/lib/validators/contact"
import { disconnectStudentGoogleCalendar } from "./calendar-actions"
import LessonRescheduleWatcher from "@/components/lesson/LessonRescheduleWatcher"

// Roast-level → композитный SVG (все цвета уже внутри одного файла).
const ROAST_LEVEL_SVG: Record<string, string> = {
  Raw: "/dashboard/student/levels/raw.svg",
  Rare: "/dashboard/student/levels/rare.svg",
  "Medium Rare": "/dashboard/student/levels/medium-rare.svg",
  Medium: "/dashboard/student/levels/medium.svg",
  "Medium Well": "/dashboard/student/levels/medium-well.svg",
  "Well Done": "/dashboard/student/levels/well-done.svg",
}

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
  return <ArrowIcon direction="right" size={size} />
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
  const [failed, setFailed] = useState(false)
  // Сбрасываем failed при изменении src (например после upload) — иначе
  // fallback залипал бы навсегда, если изначально src был null.
  useEffect(() => { setFailed(false) }, [src])
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

function pluralize(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

interface StudentRawDashboardProps {
  studentId?: string
  firstName?: string
  lastName?: string
  avatarUrl?: string | null
  englishLevel?: string
  /** Кол-во дней подряд без пропусков; используем для «огоньков» (макс 6). */
  currentStreak?: number
  balance?: number
  lessonsThisYear?: number
  initialLessons?: Array<{
    id: string
    scheduledAt: string
    durationMinutes: number
    status: string
    teacherName: string | null
    teacherAvatar: string | null
    teacherUserId: string | null
    meetingUrl: string | null
  }>
  initialChats?: ChatListItem[]
  calendarConnection?: {
    connected: boolean
    googleEmail: string | null
    syncedAt: string | null
  }
}

export default function StudentRawDashboard({
  studentId,
  firstName = "Вадим",
  lastName = "Думович",
  avatarUrl,
  englishLevel = "Rare",
  currentStreak = 0,
  balance = 14500,
  lessonsThisYear = 25,
  initialLessons = [],
  initialChats,
  calendarConnection,
}: StudentRawDashboardProps = {}) {
  const router = useRouter()
  const [addLessonOpen, setAddLessonOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [homeworkOpen, setHomeworkOpen] = useState(false)
  const [homeworkFiles, setHomeworkFiles] = useState<FileItem[]>([])
  const [homeworkVersion, setHomeworkVersion] = useState(0) // bump → refetch
  const [hwUploading, setHwUploading] = useState(false)

  // Папки Библиотеки и ДЗ — read-only для студента (нельзя создавать).
  const [libFolders, setLibFolders] = useState<FolderItem[]>([])
  const [libFolderId, setLibFolderId] = useState<string | null>(null)
  const [hwFolders, setHwFolders] = useState<FolderItem[]>([])
  const [hwFolderId, setHwFolderId] = useState<string | null>(null)

  // Реальные лекции из БД — приходят с сервера через /api/lectures.
  // Если пусто — используем placeholder-моки (LECTORY_*), чтобы дизайн-превью не пустовало.
  const [lectures, setLectures] = useState<Array<{
    id: string; title: string; host_name: string | null; description: string | null;
    tag: string | null; scheduled_at: string; slot: 'main' | 'tall' | 'small'; cover_url: string | null;
  }>>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/lectures', { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setLectures(j.lectures ?? [])
      } catch (e) { console.error('[lectures]', e) }
    })()
    return () => { cancelled = true }
  }, [])
  const lecMain  = lectures.find((l) => l.slot === 'main')
  const lecTall  = lectures.find((l) => l.slot === 'tall')
  const lecSmall = lectures.filter((l) => l.slot === 'small').slice(0, 2)
  const lecFmt = (iso: string) => {
    const d = new Date(iso)
    return {
      time: d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      date: d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    }
  }

  async function handleStudentHwUpload(file: File) {
    if (!studentId) return
    if (!hwFolderId) { alert("Сначала откройте папку"); return }
    if (file.size > 25 * 1024 * 1024) {
      alert("Файл больше 25 МБ")
      return
    }
    setHwUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder_id", hwFolderId)
      const res = await fetch("/api/me/homework/upload", { method: "POST", body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      setHomeworkVersion((v) => v + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось загрузить файл")
    } finally {
      setHwUploading(false)
    }
  }
  // Аватар: локальный override после загрузки нового + upload state.
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const effectiveAvatarUrl = avatarOverride ?? avatarUrl ?? null

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !studentId) return
    if (file.size > 5 * 1024 * 1024) {
      alert("Файл больше 5 МБ")
      return
    }
    setAvatarUploading(true)
    try {
      const { createClient: createBrowserSb } = await import("@/lib/supabase/client")
      const supabase = createBrowserSb()
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
      const path = `${studentId}/avatar.${ext}`
      const up = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type })
      if (up.error) throw up.error
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path)
      const url = `${pub.publicUrl}?t=${Date.now()}`
      const res = await fetch("/api/settings/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: { avatar_url: url } }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      setAvatarOverride(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки аватара")
    } finally {
      setAvatarUploading(false)
    }
  }
  const [libraryFiles, setLibraryFiles] = useState<FileItem[]>([])

  // Автоимпорт результата теста с лендинга: если в localStorage лежит
  // raw_quiz_result — переносим в level_tests (user_id=me) через
  // /api/me/level-test/import. Идемпотентно на сервере (24h окно),
  // но локально тоже чистим ключ после успеха. Fire-and-forget, не блокируем UI.
  useEffect(() => {
    if (!studentId) return
    if (typeof window === "undefined") return
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem("raw_quiz_result")
    } catch { /* private mode */ }
    if (!raw) return
    let parsed: {
      cefr?: string
      correctCount?: number
      totalQuestions?: number
      answers?: Record<string | number, unknown>
    } | null = null
    try {
      parsed = JSON.parse(raw)
    } catch { /* corrupted json — just drop */ }
    if (!parsed) {
      try { window.localStorage.removeItem("raw_quiz_result") } catch {}
      return
    }
    // cefr: 'C1+' → 'C1'; остальное как есть если валидное.
    const rawLvl = String(parsed.cefr ?? "").replace("+", "").toUpperCase()
    const ALLOWED = new Set(["A1", "A2", "B1", "B2", "C1", "C2"])
    if (!ALLOWED.has(rawLvl)) return
    const score = Math.max(0, Math.min(1000, Number.isFinite(parsed.correctCount) ? parsed.correctCount! : 0))
    ;(async () => {
      try {
        const res = await fetch("/api/me/level-test/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: parsed!.answers ?? {},
            score,
            level: rawLvl,
          }),
        })
        if (res.ok) {
          try { window.localStorage.removeItem("raw_quiz_result") } catch {}
        }
      } catch {
        /* сеть отвалилась — оставляем ключ, попробуем на следующем визите */
      }
    })()
  }, [studentId])

  // Список папок Библиотеки — грузим при открытии.
  useEffect(() => {
    if (!libraryOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listFolders("library")
        if (cancelled) return
        setLibFolders(rows.map((f) => ({ id: f.id, name: f.name, count: f.count })))
      } catch (e) { console.error("[library folders]", e) }
    })()
    return () => { cancelled = true }
  }, [libraryOpen])

  // Файлы внутри открытой папки Библиотеки.
  useEffect(() => {
    if (!libraryOpen || !libFolderId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/student/materials?limit=200&folder_id=${encodeURIComponent(libFolderId)}`,
          { cache: "no-store" },
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setLibraryFiles(
          (data.materials ?? []).map((m: any) => {
            const storedIsSigned = !!m.file_url && /\/storage\/v1\/object\/sign\//.test(m.file_url)
            const openUrl = m.signed_url || (storedIsSigned ? null : m.file_url)
            return {
              id: m.id,
              name: m.title,
              status: "loaded" as const,
              mime: m.mime_type ?? null,
              onOpen: openUrl ? () => window.open(openUrl, "_blank") : undefined,
            }
          }),
        )
      } catch (e) {
        console.error("[library files] fetch failed", e)
      }
    })()
    return () => { cancelled = true }
  }, [libraryOpen, libFolderId])

  // Список папок ДЗ (общий пул) — грузим при открытии.
  useEffect(() => {
    if (!homeworkOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listFolders("homework")
        if (cancelled) return
        setHwFolders(rows.map((f) => ({ id: f.id, name: f.name, count: f.count })))
      } catch (e) { console.error("[homework folders]", e) }
    })()
    return () => { cancelled = true }
  }, [homeworkOpen])

  // Файлы внутри открытой папки ДЗ.
  useEffect(() => {
    if (!homeworkOpen || !hwFolderId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/me/homework?folder_id=${encodeURIComponent(hwFolderId)}`, { cache: "no-store" })
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
      } catch (e) {
        console.error("[homework files] fetch failed", e)
      }
    })()
    return () => { cancelled = true }
  }, [homeworkOpen, hwFolderId, homeworkVersion])
  const [chatPeer, setChatPeer] = useState<
    | { id: string; role: "teacher" | "student" | "admin"; name: string; avatar: string | null }
    | null
  >(null)
  const [chatUnreadOverride, setChatUnreadOverride] = useState<Record<string, number>>({})
  // Групповой чат: локальный sink unread + открытая модалка.
  const [groupUnreadOverride, setGroupUnreadOverride] = useState<Record<string, number>>({})
  const [groupChat, setGroupChat] = useState<
    | { id: string; name: string; memberCount: number }
    | null
  >(null)

  // Realtime: слушаем INSERT в chat_messages и group_messages для этого юзера,
  // чтобы sidebar-счётчик unread обновлялся без обновления страницы даже
  // когда сама модалка закрыта. Внутри модалки — своя подписка (сообщение
  // сразу добавляется в бабблы). Тут только badge-инкремент.
  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    let cleanup: (() => void) | null = null
    ;(async () => {
      const { createClient: mkClient } = await import("@/lib/supabase/client")
      if (cancelled) return
      const supabase = mkClient()
      const chatCh = supabase
        .channel(`inbox:student:${studentId}:${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `student_id=eq.${studentId}`,
          },
          (payload: any) => {
            const row = payload.new
            if (!row || row.sender_id === studentId) return
            if (chatPeer?.id === row.sender_id) return
            setChatUnreadOverride((prev) => ({
              ...prev,
              [row.sender_id]: (prev[row.sender_id] ?? 0) + 1,
            }))
          },
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn("[inbox:student] realtime status:", status, err ?? "")
          }
        })
      const groupIds = (initialChats ?? [])
        .filter((c) => c.kind === "group")
        .map((c: any) => c.groupId)
      const groupCh = supabase
        .channel(`inbox:groups:${studentId}:${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "group_messages" },
          (payload: any) => {
            const row = payload.new
            if (!row || row.sender_id === studentId) return
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
            console.warn("[inbox:student-groups] realtime status:", status, err ?? "")
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
  }, [studentId, chatPeer?.id, groupChat?.id, initialChats])
  const now = useClock()
  const timeStr = now
    ? now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
    : "16:24"
  const dateStr = now
    ? now.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "26.06.2026"

  // Фильтруем прошедшие: cutoff = -1h от «сейчас» (даём буфер на уже начавшийся урок).
  // При отсутствии now (SSR) фильтр не применяется — покажем всё, потом сузим при clock-tick.
  const nowMs = now ? now.getTime() : 0
  const cutoff = nowMs - 60 * 60 * 1000
  // Только реальные уроки; никаких моков — иначе кажется что бэк не работает.
  // Уроки ученика
  const lessonEvents = initialLessons
    .filter((l) => !nowMs || new Date(l.scheduledAt).getTime() >= cutoff)
    .map((l) => ({
      id: l.id,
      scheduledAt: l.scheduledAt,
      label: l.teacherName ? `урок с ${l.teacherName}` : "Урок",
      callHref: l.meetingUrl,
      teacherUserId: l.teacherUserId,
      teacherName: l.teacherName,
      teacherAvatar: l.teacherAvatar,
    }))
  // Лекции — тоже в календарь (не только в блоке лектория).
  const lectureEvents = lectures
    .filter((l) => !nowMs || new Date(l.scheduled_at).getTime() >= cutoff)
    .map((l) => ({
      id: `lec:${l.id}`,
      scheduledAt: l.scheduled_at,
      label: l.host_name ? `лекция: ${l.title} (${l.host_name})` : `лекция: ${l.title}`,
      callHref: null as string | null,
      teacherUserId: null as string | null,
      teacherName: l.host_name,
      teacherAvatar: null as string | null,
    }))
  const scheduleView = [...lessonEvents, ...lectureEvents]
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 10)
    .map((l) => {
      const d = new Date(l.scheduledAt)
      return {
        id: l.id,
        time: d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        date: d.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "2-digit" }),
        label: l.label,
        callHref: l.callHref,
        teacherUserId: l.teacherUserId,
        teacherName: l.teacherName,
        teacherAvatar: l.teacherAvatar,
      }
    })

  const [topupAmount, setTopupAmount] = useState("")
  const [topupPhone, setTopupPhone] = useState("")
  const [topupBusy, setTopupBusy] = useState(false)
  const [topupError, setTopupError] = useState<string | null>(null)

  async function submitTopup() {
    setTopupError(null)
    const amountRub = Number.parseInt(topupAmount.replace(/\s+/g, ''), 10)
    if (!Number.isFinite(amountRub) || amountRub < 100) {
      setTopupError('Введите сумму не меньше 100 ₽')
      return
    }
    const normalizedPhone = normalizePhoneRu(topupPhone)
    if (!normalizedPhone) {
      setTopupError('Введите корректный номер телефона (11 цифр, +7…)')
      return
    }
    setTopupBusy(true)
    try {
      const res = await fetch('/api/balance/topup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRub, phone: topupPhone.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTopupError(data.error || 'Не удалось создать платёж')
        return
      }
      if (data.confirmationUrl) {
        // YooKassa host — редиректим прямо на форму оплаты.
        window.location.href = data.confirmationUrl
      } else {
        setTopupError('YooKassa не вернула ссылку на оплату')
      }
    } catch (e) {
      setTopupError(e instanceof Error ? e.message : 'Ошибка сети')
    } finally {
      setTopupBusy(false)
    }
  }

  return (
    <div className="st">
      {studentId && <LessonRescheduleWatcher userId={studentId} role="student" scheduleHref="#schedule" />}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/raw-student.css?v=20260905-lectory2" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/shared-pills.css?v=1" />
      {/* Подключаем teacher.css чтобы использовать блок .tr-chats-frame 1:1 — стили префиксированы .tr-*, коллизий со .st-* нет. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/raw-teacher.css?v=20260904-arrows-lime" />
      {/* FilesModal — модалка «Библиотека / ДЗ». Без стилей плашки папок валятся в поток документа. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/files-modal.css?v=1" />
      {/* StudentAddLessonModal — модалка добавления урока. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/student-add-lesson.css?v=20260904-typo" />

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
          <StudentGoogleCalendarBanner connection={calendarConnection} onDisconnected={() => router.refresh()} />
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
                  <button
                    type="button"
                    className="st-lesson-call"
                    onClick={() => {
                      if (!l.teacherUserId) return
                      setChatPeer({
                        id: l.teacherUserId,
                        role: "teacher",
                        name: l.teacherName ?? "Преподаватель",
                        avatar: l.teacherAvatar,
                      })
                    }}
                    disabled={!l.teacherUserId}
                    title={l.teacherUserId ? "Открыть чат с преподавателем" : "Преподаватель не найден"}
                  >
                    чат
                  </button>
                  {(() => {
                    const isLecture = String(l.id).startsWith("lec:")
                    const href = isLecture ? `/lecture/${String(l.id).slice(4)}` : `/lesson/${l.id}`
                    return (
                      <a
                        className="st-lesson-call-mini"
                        href={href}
                        title={isLecture ? "Присоединиться к лекции" : "Присоединиться к звонку (комната откроется за 5 мин до начала)"}
                        aria-label="Начать звонок"
                      >
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
                          <path d="M4.5 5.5c0-.55.45-1 1-1h2.7c.44 0 .82.29.95.71l1.14 3.62c.13.42-.01.88-.36 1.16l-1.63 1.3c1.13 2.24 2.99 4.1 5.23 5.23l1.3-1.63c.28-.35.74-.49 1.16-.36l3.62 1.14c.42.13.71.51.71.95v2.7c0 .55-.45 1-1 1C10.1 20.32 3.68 13.9 3.68 5.5" fill="#fff" />
                        </svg>
                      </a>
                    )
                  })()}
                </div>
              ))
            )}
          </div>
          <div className="st-schedule-actions">
            <a
              href="https://calendar.google.com/calendar/r"
              target="_blank"
              rel="noreferrer"
              className="st-sched-btn lime"
            >
              открыть календарь
            </a>
            <button
              type="button"
              className="st-sched-btn red"
              onClick={() => setAddLessonOpen(true)}
            >
              добавить урок
            </button>
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
        <HwPillList
          items={[
            { label: "Домашние задания", onClick: () => setHomeworkOpen(true) },
            {
              label: <>Библиотека <span className="raw">Raw English</span></>,
              onClick: () => setLibraryOpen(true),
              id: "library",
            },
            { label: "История занятий", href: "/student/summaries" },
          ]}
        />
      </section>

      {/* ================== CHATS ================== */}
      {/* Полностью повторяет teacher-блок (`.tr-chats-frame`). Стили в raw-teacher.css. */}
      <section id="chats" className="st-chats-section tr-section">
        <div className="tr-chats-frame">
          <div className="tr-chats-badge">
            ЧАТ С&nbsp;<span className="c-lime">УЧИТЕЛЯМИ</span>
          </div>

          <div className="tr-chats-card tr-chats-card--flow">
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
                        // eslint-disable-next-line @next/next/no-img-element
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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
                      // eslint-disable-next-line @next/next/no-img-element
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
                        // eslint-disable-next-line @next/next/no-img-element
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
                        // eslint-disable-next-line @next/next/no-img-element
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/dashboard/chats/arrow-icon-dark.svg" alt="" aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {chatPeer && (
        <ChatModal
          peerId={chatPeer.id}
          peerRole={chatPeer.role}
          peerName={chatPeer.name}
          peerAvatar={chatPeer.avatar ?? undefined}
          currentUserId={studentId}
          currentRole="student"
          onClose={() => setChatPeer(null)}
        />
      )}

      {groupChat && studentId && (
        <GroupChatModal
          groupId={groupChat.id}
          groupName={groupChat.name}
          memberCount={groupChat.memberCount}
          currentUserId={studentId}
          currentRole="student"
          onClose={() => setGroupChat(null)}
        />
      )}

      <StudentAddLessonModal
        open={addLessonOpen}
        onClose={() => setAddLessonOpen(false)}
        onCreated={() => router.refresh()}
      />

      {libraryOpen && (
        <FilesModal
          title="Библиотека Raw English"
          folders={libFolders}
          files={libraryFiles}
          activeFolderId={libFolderId}
          onOpenFolder={setLibFolderId}
          onClose={() => { setLibraryOpen(false); setLibFolderId(null) }}
        />
      )}

      {homeworkOpen && (
        <FilesModal
          title="Домашние задания"
          folders={hwFolders}
          files={homeworkFiles}
          activeFolderId={hwFolderId}
          onOpenFolder={setHwFolderId}
          canManage
          onClose={() => { setHomeworkOpen(false); setHwFolderId(null) }}
          onFilePicked={handleStudentHwUpload}
          addLabel={hwUploading ? "Загружаем…" : "Загрузить работу"}
        />
      )}

      {/* ================== LECTORY (lime) ================== */}
      <section id="calls" className="st-lectory-section">
        <div className="st-badge-wrap">
          <span className="st-badge on-light-dark-outline">
            РАСПИСАНИЕ <span className="c-red">ЛЕКТОРИЯ</span>
          </span>
        </div>
        <div className="st-lectory-grid">
          {/* MAIN — большая тёмная плашка (col 1-2, row 1) */}
          {(() => {
            const l = lecMain
            const src = l ? { tag: l.tag ?? "", title: l.title, author: l.host_name ?? "", desc: l.description ?? "", ...lecFmt(l.scheduled_at) } : LECTORY_MAIN
            return (
              <div className="st-lect-card st-lect-card--main">
                {src.tag && <span className="st-lect-tag st-lect-tag--top">{src.tag}</span>}
                <div className="st-lect-body">
                  <div className="st-lect-title">{src.title}</div>
                  {src.author && <div className="st-lect-author">{src.author}</div>}
                  <p className="st-lect-desc">{src.desc}</p>
                </div>
                <div className="st-lect-foot">
                  <span className="st-lect-date">{src.date}</span>
                  <span className="st-lect-time">{src.time}</span>
                </div>
              </div>
            )
          })()}

          {/* TALL — правая колонка, spans 2 rows */}
          {(() => {
            const l = lecTall
            const src = l ? { tag: l.tag ?? "", title: l.host_name ?? l.title, desc: l.description ?? "", ...lecFmt(l.scheduled_at) }
              : { tag: LECTORY_TALL.tag, title: LECTORY_TALL.author, desc: LECTORY_TALL.desc, time: LECTORY_TALL.time, date: LECTORY_TALL.date }
            return (
              <div className="st-lect-card red tall">
                {src.tag && <span className="st-lect-tag st-lect-tag--top">{src.tag}</span>}
                <div className="st-lect-body">
                  <div className="st-lect-title">{src.title}</div>
                  <p className="st-lect-desc">{src.desc}</p>
                </div>
                <div className="st-lect-foot">
                  <span className="st-lect-date">{src.date}</span>
                  <span className="st-lect-time">{src.time}</span>
                </div>
              </div>
            )
          })()}

          {/* SMALL 1 — нижний левый */}
          {(() => {
            const l = lecSmall[0]
            const src = l ? { tag: l.tag ?? "", title: l.host_name ?? l.title, desc: l.description ?? "", ...lecFmt(l.scheduled_at) }
              : { tag: LECTORY_LEFT.tag, title: LECTORY_LEFT.title, desc: LECTORY_LEFT.desc, time: LECTORY_LEFT.time, date: LECTORY_LEFT.date }
            return (
              <div className="st-lect-card red">
                {src.tag && <span className="st-lect-tag st-lect-tag--top">{src.tag}</span>}
                <div className="st-lect-body">
                  <div className="st-lect-title">{src.title}</div>
                  <p className="st-lect-desc">{src.desc}</p>
                </div>
                <div className="st-lect-foot">
                  <span className="st-lect-date">{src.date}</span>
                  <span className="st-lect-time">{src.time}</span>
                </div>
              </div>
            )
          })()}

          {/* SMALL 2 — нижний средний */}
          {(() => {
            const l = lecSmall[1]
            const src = l ? { tag: l.tag ?? "", title: l.host_name ?? l.title, desc: l.description ?? "", ...lecFmt(l.scheduled_at) }
              : { tag: LECTORY_RIGHT.tag, title: LECTORY_RIGHT.title, desc: LECTORY_RIGHT.desc, time: LECTORY_RIGHT.time, date: LECTORY_RIGHT.date }
            return (
              <div className="st-lect-card red">
                {src.tag && <span className="st-lect-tag st-lect-tag--top">{src.tag}</span>}
                <div className="st-lect-body">
                  <div className="st-lect-title">{src.title}</div>
                  <p className="st-lect-desc">{src.desc}</p>
                </div>
                <div className="st-lect-foot">
                  <span className="st-lect-date">{src.date}</span>
                  <span className="st-lect-time">{src.time}</span>
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* ================== BALANCE + STATS ================== */}
      <section id="balance" className="st-balance-section">
        <div className="st-balance-grid">
          <div className="st-balance-card">
            <div className="st-bal-head">
              <button
                type="button"
                className="st-bal-avatar st-bal-avatar--btn"
                aria-label={avatarUploading ? "Загружаем…" : "Изменить аватар"}
                title={avatarUploading ? "Загружаем…" : "Нажмите чтобы изменить аватар"}
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                <Avatar name={`${firstName} ${lastName}`} src={effectiveAvatarUrl ?? undefined} />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarPick}
              />
              <div>
                {/* Строка «прожарки» — 6 огней, заполнены по уровню (Raw=1 … Well Done=6). */}
                {(() => {
                  const roast = toRoastLevel(englishLevel)
                  const roastIdx = ROAST_LEVELS.indexOf(roast) + 1
                  return (
                    <div className="st-flame-row" aria-label={`Уровень: ${roast} (${roastIdx} из 6)`}>
                      {Array.from({ length: 6 }, (_, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          className="st-flame"
                          src={i < roastIdx
                            ? "/dashboard/student/flame/filled.svg"
                            : "/dashboard/student/flame/empty.svg"}
                          alt=""
                          aria-hidden
                        />
                      ))}
                    </div>
                  )
                })()}
                <div className="st-bal-name">
                  <span>{firstName}</span>
                  {lastName && <span>{lastName}</span>}
                </div>
              </div>
              <div className="st-bal-money">
                <div className="st-bal-caption">ваш баланс</div>
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
              <h3>Пополнение<br />баланса</h3>
              <input
                type="tel"
                className="st-topup-input"
                placeholder="введите сумму"
                inputMode="numeric"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value.replace(/\D+/g, ''))}
                disabled={topupBusy}
              />
              <input
                type="tel"
                className="st-topup-input"
                placeholder="номер телефона"
                value={topupPhone}
                onChange={(e) => setTopupPhone(e.target.value)}
                disabled={topupBusy}
              />
              {(() => {
                const amountValid = Number.parseInt(topupAmount.replace(/\s+/g, ''), 10) >= 100
                const phoneValid = !!normalizePhoneRu(topupPhone)
                const canSubmit = amountValid && phoneValid && !topupBusy
                return (
                  <button
                    type="button"
                    className="st-topup-btn"
                    onClick={submitTopup}
                    disabled={!canSubmit}
                  >
                    {topupBusy ? 'Переход…' : 'Оплатить'}
                  </button>
                )
              })()}
              {topupError && (
                <p className="st-topup-hint" style={{ color: '#c53030' }}>
                  {topupError}
                </p>
              )}
              <p className="st-topup-hint">
                Соглашаясь отправить,<br />
                вы даёте согласие на обработку<br />
                персональных данных.
              </p>
            </div>

            <div className="st-level-card">
              <h3>Ваш уровень</h3>
              {(() => {
                // englishLevel — CEFR (A1..C2). Мапим в roast → SVG-логотип.
                const roast = toRoastLevel(englishLevel)
                const src = ROAST_LEVEL_SVG[roast] ?? ROAST_LEVEL_SVG.Raw
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="st-level-svg" src={src} alt={roast} />
                )
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ================== FOOTER ================== */}
      <SiteFooter
        onSupportClick={async () => {
          // «Написать в поддержку» → открываем обычный ChatModal с админом.
          // Сообщение падает в chat_messages и висит у админа в списке чатов.
          try {
            const r = await fetch("/api/support/admin-peer", { cache: "no-store" })
            const j = await r.json()
            if (r.ok && j.admin?.id) {
              setChatPeer({ id: j.admin.id, role: "admin", name: j.admin.name, avatar: j.admin.avatar })
            }
          } catch {
            /* fail-soft: если админ не найден — просто ничего не открываем */
          }
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// StudentGoogleCalendarBanner: аналог tr-варианта — показывает статус Google
// Calendar-подключения ученика и CTA «Подключить/Отключить». В preview-режиме
// (connection не передан) не рендерится.
// ---------------------------------------------------------------------------
function StudentGoogleCalendarBanner({
  connection,
  onDisconnected,
}: {
  connection?: { connected: boolean; googleEmail: string | null; syncedAt: string | null }
  onDisconnected?: () => void
}) {
  const [busy, setBusy] = useState(false)
  if (!connection) return null

  if (connection.connected) {
    return (
      <div className="st-gcal-banner st-gcal-banner--ok">
        <div className="st-gcal-banner-text">
          <span className="st-gcal-dot st-gcal-dot--ok" aria-hidden /> Google Calendar подключён
          {connection.googleEmail ? <> — <b>{connection.googleEmail}</b></> : null}
        </div>
        <button
          type="button"
          className="st-gcal-banner-unlink"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Отключить Google Calendar? Новые уроки перестанут попадать в него.")) return
            setBusy(true)
            try {
              await disconnectStudentGoogleCalendar()
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
    <div className="st-gcal-banner">
      <div className="st-gcal-banner-text">
        <span className="st-gcal-dot" aria-hidden /> Подключите Google Calendar — уроки будут автоматически появляться в вашем календаре.
      </div>
      <a href="/api/google/oauth/start" className="st-gcal-banner-btn st-sched-btn lime">
        Подключить
      </a>
    </div>
  )
}

