"use client"

/* ============================================================
   Универсальный чат-оверлей (multiparty: teacher/student/admin).
   Открывается поверх любого дашборда. Раньше был StudentChat.tsx
   (только teacher→student), теперь role-agnostic.
   Figma node 2208:3846.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowIcon } from "@/components/icons/ArrowIcon"

import { createClient as createBrowserSupabase } from "@/lib/supabase/client"
import PeerInfoModal from "@/components/dashboard/PeerInfoModal"
import {
  fetchThreadMessages,
  sendMessage as sendChatMessage,
  uploadAttachment as uploadChatAttachment,
} from "@/lib/chat/actions"
import { computeSlots } from "@/lib/chat/slot"
import type {
  ChatAttachmentType,
  ChatMessage as DbChatMessage,
  ChatRole,
} from "@/lib/chat/types"

interface UiChatMessage {
  id: string
  senderId: string
  senderRole: ChatRole
  text: string
  attachmentUrl?: string | null
  attachmentType?: ChatAttachmentType | null
  attachmentName?: string | null
  createdAt: string
}

function dbToUi(m: DbChatMessage): UiChatMessage {
  // Для document text используется как отображаемое имя файла; для image/video
  // — как обычная подпись.
  const isDoc = m.attachmentType === "document"
  return {
    id: m.id,
    senderId: m.senderId,
    senderRole: m.senderRole,
    text: isDoc ? "" : m.text ?? "",
    attachmentUrl: m.attachmentUrl,
    attachmentType: m.attachmentType,
    attachmentName: isDoc ? m.text : null,
    createdAt: m.createdAt,
  }
}

interface ChatModalProps {
  peerId: string
  peerName: string
  peerRole: ChatRole
  peerLevel?: string
  peerAvatar?: string
  currentUserId?: string
  currentRole: ChatRole
  onClose: () => void
  /**
   * "modal" — стандартный full-screen overlay с dim-backdrop (по умолчанию).
   * "dock" — плавающее окно в углу без dim'а, чтобы фон (видео-звонок) оставался виден.
   */
  variant?: "modal" | "dock"
  /** Для dock-варианта: свернуть в pill. Если передан — рендерим кнопку «−» в шапке. */
  onMinimize?: () => void
  /**
   * Для dock-варианта: раскрыть окно на весь экран (parent переключает
   * variant → "modal") или вернуть обратно. Если передан — рендерим
   * кнопку «↗»/«↙» в шапке.
   */
  onToggleExpand?: () => void
  /**
   * Скрыть кнопки «Видеозвонок»/«Аудиозвонок» и блок уровня в шапке.
   * Используем в чате поверх активного звонка (LessonVideoRoom) — оба
   * собеседника уже на связи, звонить друг другу из чата бессмысленно.
   * По умолчанию false: на дашборде эти кнопки нужны.
   */
  hideCallActions?: boolean
}

// Figma Group 335-2 (адаптировано под 34×34): «плюс» строго по центру круга.
// Оригинал был 38×35 — при uniform-scale в 34×34 плюс уезжал по вертикали,
// поэтому пересчитано в квадратный viewBox 34×34 с идеальным центром (17,17).
function AttachIcon() {
  return (
    <svg viewBox="0 0 34 34" width="34" height="34" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <circle cx="17" cy="17" r="17" fill="#DFED8C" fillOpacity="0.26" />
      <path d="M9 17H25" stroke="#DFED8C" strokeWidth="3" strokeLinecap="round" />
      <path d="M17 9V25" stroke="#DFED8C" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
// Figma icons (Group 333 / 334): 54×54 с встроенным полупрозрачным кругом.
function CameraIcon() {
  return (
    <svg viewBox="0 0 54 54" width="54" height="54" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <circle cx="27" cy="27" r="27" fill="#DFED8C" fillOpacity="0.26" />
      <path d="M38.9053 38.35H14.7094C13.217 38.35 12 37.1304 12 35.6204V21.1742C12 19.6787 13.2026 18.4591 14.6949 18.4591C16.4045 18.4446 18.5343 18.4446 19.8093 18.4156C20.1426 18.4156 20.5483 18.2123 20.7656 17.951C21.4755 17.1524 22.084 16.2813 22.7795 15.4828C22.9823 15.2505 23.359 15.0327 23.6633 15.0327C25.7641 14.9891 27.865 14.9891 29.9658 15.0327C30.2701 15.0327 30.6468 15.2505 30.8496 15.4828C31.5451 16.2813 32.1536 17.1524 32.8635 17.951C33.0809 18.1978 33.501 18.401 33.8198 18.401C35.5149 18.4301 37.1956 18.4301 38.9053 18.4301C40.3976 18.4301 41.6146 19.6497 41.6146 21.1451V35.6059C41.6146 37.1304 40.3976 38.35 38.9053 38.35ZM32.9794 28.0851C32.9939 24.6587 30.2411 21.8856 26.8363 21.8711C23.4315 21.8565 20.6497 24.6297 20.6497 28.0416C20.6352 31.4535 23.4025 34.2412 26.7928 34.2557C30.1832 34.2702 32.965 31.4971 32.9794 28.0851ZM38.4561 20.3611C37.6303 20.2885 36.8769 20.9419 36.8334 21.7694C36.7755 22.6551 37.4999 23.381 38.3692 23.352C39.195 23.323 39.8036 22.6986 39.8036 21.8565C39.8181 21.058 39.2385 20.4337 38.4561 20.3611Z" fill="#DFED8C" />
      <path d="M31.3641 28.0986C31.3641 30.6202 29.3408 32.6547 26.8152 32.6547C24.2896 32.6547 22.2663 30.6345 22.252 28.1129C22.252 25.6057 24.304 23.5426 26.8009 23.5426C29.3121 23.5282 31.3641 25.5913 31.3641 28.0986Z" fill="#DFED8C" />
    </svg>
  )
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 54 54" width="54" height="54" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <circle cx="27" cy="27" r="27" fill="#DFED8C" fillOpacity="0.26" />
      <path d="M33.8724 40.35C31.6923 40.2919 29.5121 39.4489 27.5064 38.2861C21.9833 35.0595 17.6231 30.6411 14.5999 24.9727C13.6697 23.1995 13.0302 21.3101 13.0011 19.3043C12.9721 17.5893 13.4953 16.1068 14.8034 14.944C15.3266 14.4789 15.7917 13.9848 16.2859 13.5197C17.0417 12.822 18.0009 12.822 18.7277 13.5487C20.1811 14.9731 21.6345 16.4265 23.0589 17.88C23.7856 18.6357 23.7565 19.6241 23.0298 20.3799C22.6519 20.7577 22.274 21.1356 21.8961 21.5135C21.0241 22.4437 20.8787 23.6065 21.4892 24.7111C23.1752 27.7924 25.5588 30.176 28.6401 31.862C29.7156 32.4433 30.8783 32.298 31.7795 31.455C32.2155 31.0771 32.5934 30.6411 33.0004 30.2341C33.6689 29.5946 34.6863 29.5655 35.3549 30.205C36.8665 31.6875 38.349 33.17 39.8315 34.6816C40.5001 35.3502 40.471 36.3095 39.8315 37.0362C39.3664 37.5594 38.8432 38.0826 38.349 38.5768C37.1281 39.8558 35.9072 40.35 33.8724 40.35Z" fill="#DFED8C" />
    </svg>
  )
}
// Figma Group 175: смайл-стикер (34×34).
function EmojiIcon() {
  return (
    <svg viewBox="0 0 35 35" width="34" height="34" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path d="M17.4659 2.78444e-05C27.1463 -0.0170453 35 7.81954 35 17.5C35 27.1464 27.1805 34.983 17.5341 35C7.85366 35.0171 0 27.1805 0 17.5C0 7.85369 7.81951 0.017101 17.4659 2.78444e-05ZM17.5 32.7976C25.9854 32.7976 32.7976 26.0025 32.7976 17.5171C32.8146 9.03174 26.0195 2.21954 17.5341 2.20247C9.01463 2.18539 2.18537 9.01466 2.18537 17.5342C2.20244 26.0195 9.01463 32.8147 17.5 32.7976Z" fill="#DFED8C" />
      <path d="M7.93945 21.034C8.55409 20.7949 9.18579 20.5559 9.83457 20.3169C11.4395 23.7486 14.0346 25.712 17.8248 25.5754C21.3077 25.4559 23.6809 23.5267 25.1663 20.3169C25.798 20.5388 26.4126 20.7779 27.0443 20.9998C26.3614 24.0388 22.5882 27.6071 17.9273 27.7779C12.976 27.9827 8.9297 24.4998 7.93945 21.034Z" fill="#DFED8C" />
      <path d="M14.5295 14.2221C14.5124 15.605 13.3173 16.7489 11.9514 16.7148C10.6026 16.6806 9.49289 15.5197 9.50996 14.1538C9.52703 12.7879 10.6539 11.6611 12.0197 11.644C13.3856 11.644 14.5465 12.8221 14.5295 14.2221Z" fill="#DFED8C" />
      <path d="M22.9466 16.7145C21.5636 16.6974 20.4197 15.5023 20.4539 14.1023C20.488 12.7535 21.6661 11.6267 22.9978 11.6437C24.3978 11.6608 25.5246 12.8559 25.4734 14.2559C25.4563 15.6218 24.2953 16.7316 22.9466 16.7145Z" fill="#DFED8C" />
    </svg>
  )
}
function SendIcon() {
  return <ArrowIcon direction="right" size={14} />
}
// Figma Group 310: «фото или видео» — рамка с картинкой.
function PhotoIcon() {
  return (
    <svg viewBox="0 0 23 20" width="23" height="20" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path d="M13.037 0C15.2336 0 17.4407 0 19.6372 0C21.1579 0 22.0556 0.908888 22.0556 2.44131C22.0556 5.63299 22.0556 8.8141 22.0556 12.0058C22.0556 13.4854 21.1368 14.4365 19.6584 14.4365C15.2441 14.4471 10.8299 14.4471 6.40512 14.4365C4.93723 14.4365 4.00792 13.4748 4.00792 12.0058C3.99736 8.80353 3.99736 5.60128 4.00792 2.38847C4.01848 0.940593 4.94779 0.0105685 6.384 0C8.60167 0 10.8193 0 13.037 0ZM20.1653 8.53932C20.2181 8.42306 20.2497 8.39136 20.2497 8.35965C20.2497 6.37278 20.2497 4.37534 20.2603 2.38847C20.2603 1.88119 19.9646 1.78607 19.5422 1.78607C15.2125 1.79664 10.8827 1.78607 6.55296 1.79664C5.9299 1.79664 5.8243 1.91289 5.8243 2.547C5.8243 5.11514 5.8243 7.68327 5.8243 10.262C5.8243 10.3888 5.85598 10.5156 5.8771 10.7693C6.71137 9.91322 7.46115 9.14172 8.21094 8.38079C9.00297 7.58816 9.86891 7.58816 10.6609 8.39136C10.9778 8.70841 11.2312 9.08888 11.548 9.46934C12.7413 8.0426 13.7868 6.78495 14.8323 5.52731C15.6982 4.4916 16.7015 4.50216 17.5885 5.52731C18.4334 6.52074 19.2782 7.51418 20.1653 8.53932Z" fill="#DFED8C" />
      <path d="M18.6111 15.937C18.3067 16.9224 18.0653 17.8017 17.7609 18.6599C17.383 19.7194 16.4069 20.2174 15.2628 19.9101C12.8067 19.2638 10.3716 18.5964 7.91544 17.9289C5.90016 17.3991 3.89537 16.8588 1.88009 16.3291C0.977418 16.096 0.253177 15.6616 0.0537483 14.6657C0.00126708 14.4008 -0.0302216 14.0935 0.0432521 13.8287C0.704516 11.519 1.39727 9.23047 2.07952 6.93138C2.09002 6.889 2.132 6.85721 2.24746 6.6665C2.24746 7.00554 2.24746 7.18565 2.24746 7.36577C2.24746 9.00798 2.24746 10.6502 2.24746 12.2924C2.25796 14.5279 3.65396 15.937 5.84768 15.937C9.86774 15.937 13.8983 15.937 17.9184 15.937C18.1178 15.937 18.3172 15.937 18.6111 15.937Z" fill="#DFED8C" />
      <path d="M9.99968 4.59903C9.98909 5.58853 9.14203 6.4096 8.15733 6.38855C7.15144 6.36749 6.36791 5.5359 6.38909 4.53587C6.41027 3.56743 7.22556 2.76741 8.19968 2.77793C9.18439 2.77793 10.0103 3.60953 9.99968 4.59903Z" fill="#DFED8C" />
    </svg>
  )
}
// Figma Vector-2: папка «документ».
function DocIcon() {
  return (
    <svg viewBox="0 0 22 21" width="22" height="21" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path d="M18.6427 2.33789H14.7531C13.4293 2.33789 12.1328 1.88672 11.1092 1.03906C10.3586 0.4375 9.75807 0 8.84367 0H3.35732C1.50124 0 0 1.50391 0 3.36328V5.70117V17.6367C0 19.4961 1.50124 21 3.35732 21H8.84367H18.6427C20.4988 21 22 19.4961 22 17.6367V5.70117C22 3.8418 20.4988 2.33789 18.6427 2.33789Z" fill="#DFED8C" />
    </svg>
  )
}
// Figma Group 311: «о собеседнике» — человек.
function PersonIcon() {
  return (
    <svg viewBox="0 0 18 22" width="18" height="22" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path d="M8.70277 21.2719C6.6718 21.2719 4.64082 21.2719 2.60985 21.2719C0.856801 21.2719 -0.169375 20.1174 0.0230331 18.3751C0.204752 16.761 0.418538 15.1469 1.39127 13.768C2.81295 11.7584 4.72634 10.6574 7.19558 10.5719C8.17899 10.5398 9.15172 10.5612 10.1351 10.5612C13.7268 10.5932 16.7305 13.2335 17.2329 16.8038C17.3184 17.381 17.4039 17.9689 17.468 18.5568C17.607 20.0961 16.5594 21.2612 15.0095 21.2719C12.9037 21.2826 10.8086 21.2719 8.70277 21.2719Z" fill="#DFED8C" />
      <path d="M8.75598 9.41734C6.13709 9.42803 4.0206 7.31154 4.03129 4.71404C4.04198 2.12722 6.15847 0.010729 8.72391 3.97143e-05C11.3107 -0.0106496 13.4593 2.13791 13.4486 4.72472C13.4379 7.31154 11.3428 9.40665 8.75598 9.41734Z" fill="#DFED8C" />
    </svg>
  )
}

// System-события звонка. Пишем в chat_messages.text как маркер — не требует
// новой колонки в БД. Рендерим как pill (Figma 2522:6800 / 2522:6803).
export const CALL_MARKERS = {
  started: "__call:started",
  ended: "__call:ended",
} as const

function parseCallMarker(text: string): "active" | "ended" | null {
  const t = (text ?? "").trim()
  if (t === CALL_MARKERS.started) return "active"
  if (t === CALL_MARKERS.ended) return "ended"
  return null
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function detectKind(file: File): ChatAttachmentType {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  return "document"
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export default function ChatModal({
  peerId,
  peerName,
  peerRole,
  peerLevel,
  peerAvatar,
  currentUserId: currentUserIdProp,
  currentRole,
  onClose,
  variant = "modal",
  onMinimize,
  onToggleExpand,
  hideCallActions = false,
}: ChatModalProps) {
  // Support-режим: не-админ пишет админу → это чат «в поддержку».
  // В нём: шапка «Поддержка» вместо имени + скрыты кнопки звонка (звонить в поддержку нельзя).
  const isSupport = peerRole === "admin" && currentRole !== "admin"
  const [messages, setMessages] = useState<UiChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(!peerAvatar)
  const [currentUserId, setCurrentUserId] = useState<string | null>(currentUserIdProp ?? null)
  const [lightbox, setLightbox] = useState<
    { url: string; type: "image" | "video"; name?: string | null } | null
  >(null)
  const [peerInfoOpen, setPeerInfoOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fileImgRef = useRef<HTMLInputElement | null>(null)
  const fileDocRef = useRef<HTMLInputElement | null>(null)
  const supabase = useMemo(() => createBrowserSupabase(), [])

  // Резолвим currentUserId из auth, если не передан.
  useEffect(() => {
    if (currentUserId) return
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      if (data.user) setCurrentUserId(data.user.id)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, currentUserId])

  // ESC + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightbox) setLightbox(null)
        else if (attachOpen) setAttachOpen(false)
        else onClose()
      }
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, attachOpen, lightbox])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!attachOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest?.(".tr-chat-attach-wrap")) setAttachOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [attachOpen])

  // Загрузка треда вынесена в ref, чтобы realtime мог триггерить refetch
  // при (re)connect, не таская peerId через deps подписки.
  const reloadThreadRef = useRef<() => void>(() => {})
  useEffect(() => {
    if (!peerId) return
    let cancelled = false
    const load = () => {
      fetchThreadMessages(peerId)
        .then((rows) => {
          if (cancelled) return
          setMessages(rows.map(dbToUi))
        })
        .catch((err) => {
          if (cancelled) return
          console.error("[chat] fetchThreadMessages failed", err)
        })
    }
    reloadThreadRef.current = load
    load()
    return () => {
      cancelled = true
      reloadThreadRef.current = () => {}
    }
  }, [peerId])

  // Realtime подписка на INSERT в наш тред. Фильтр по slot A id
  // (postgres_changes принимает только один eq — второй участник
  // проверяется в handler ниже). При (re)connect делаем полный refetch,
  // чтобы закрыть возможный gap событий во время разрыва.
  useEffect(() => {
    if (!currentUserId || !peerId) return
    const slots = computeSlots(
      { id: currentUserId, role: currentRole },
      { id: peerId, role: peerRole },
    )
    // Уникальный суффикс — иначе в React StrictMode (dev) первый mount
    // делает subscribe→cleanup→removeChannel, а второй mount получает
    // уже «мёртвый» канал из кеша supabase-js по имени, и SUBSCRIBED
    // никогда не приходит. Тот же паттерн — в LessonRescheduleWatcher.
    const channelName = `chat:${slots.slotAId}:${slots.slotBId}:${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `teacher_id=eq.${slots.slotAId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string
            teacher_id: string
            student_id: string
            sender_id: string
            sender_role: ChatRole
            text: string | null
            attachment_url: string | null
            attachment_type: ChatAttachmentType | null
            created_at: string
          }
          if (row.student_id !== slots.slotBId) return
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [
              ...prev,
              {
                id: row.id,
                senderId: row.sender_id,
                senderRole: row.sender_role,
                text: row.text ?? "",
                // NB: attachment_url в realtime-payload — storage path, не signed URL.
                attachmentUrl: row.attachment_url,
                attachmentType: row.attachment_type,
                createdAt: row.created_at,
              },
            ]
          })
          // Attachment realtime-payload содержит только storage path, не signed URL.
          // Раньше тут был полный refetch всего треда — теперь подписываем адрес
          // локально через bucket-getSignedUrl (быстрее и без лишних запросов).
          if (row.attachment_url) {
            supabase.storage
              .from("chat-attachments")
              .createSignedUrl(row.attachment_url, 3600)
              .then((res) => {
                if (!res.data?.signedUrl) return
                setMessages((prev) => prev.map((m) =>
                  m.id === row.id
                    ? { ...m, attachmentUrl: res.data!.signedUrl }
                    : m
                ))
              })
              .catch((err) => console.error("[chat] sign attachment url failed", err))
          }
        },
      )
      .subscribe((status, err) => {
        // При успешной (re)подписке — рефетчим тред, чтобы не пропустить
        // сообщения отправленные пока сокет был отключён.
        if (status === "SUBSCRIBED") reloadThreadRef.current()
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("[chat] realtime status:", status, err ?? "")
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, currentUserId, currentRole, peerId, peerRole])

  const send = useCallback(() => {
    if (sending) return
    const text = draft.trim()
    if (!text) return
    const localId = `local-${Date.now()}`
    const optimistic: UiChatMessage = {
      id: localId,
      senderId: currentUserId ?? "self",
      senderRole: currentRole,
      text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft("")
    setSending(true)
    sendChatMessage({ peerId, text })
      .then((real) => {
        setMessages((prev) => prev.map((m) => (m.id === localId ? dbToUi(real) : m)))
      })
      .catch((err) => {
        console.error("[chat] sendMessage failed", err)
        setMessages((prev) => prev.filter((m) => m.id !== localId))
        alert("Не удалось отправить сообщение. Попробуйте ещё раз.")
      })
      .finally(() => setSending(false))
    inputRef.current?.focus()
  }, [draft, peerId, currentRole, currentUserId, sending])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function pickFile(kind: "image" | "document") {
    setAttachOpen(false)
    if (kind === "image") fileImgRef.current?.click()
    else fileDocRef.current?.click()
  }

  function handleFile(kind: "image" | "document", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    // «Документ» ⇒ всегда шлём как файл-ссылку, даже если внутри картинка/аудио.
    // «Фото или видео» ⇒ авто-детект image/video по MIME.
    const finalKind: ChatAttachmentType = kind === "document" ? "document" : detectKind(file)
    const isDoc = finalKind === "document"

    const localId = `local-${Date.now()}`
    const optimistic: UiChatMessage = {
      id: localId,
      senderId: currentUserId ?? "self",
      senderRole: currentRole,
      text: "",
      attachmentType: finalKind,
      attachmentName: isDoc ? `${file.name} · ${formatFileSize(file.size)}` : null,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    uploadChatAttachment({
      peerId,
      file,
      kind: finalKind,
      text: isDoc ? `${file.name} · ${formatFileSize(file.size)}` : null,
    })
      .then((real) => {
        setMessages((prev) => prev.map((m) => (m.id === localId ? dbToUi(real) : m)))
      })
      .catch((err) => {
        console.error("[chat] uploadAttachment failed", err)
        setMessages((prev) => prev.filter((m) => m.id !== localId))
      })
  }

  const isMine = (m: UiChatMessage): boolean => {
    if (currentUserId && m.senderId) return m.senderId === currentUserId
    return m.senderRole === currentRole
  }

  return (
    <>
    <link rel="stylesheet" href="/dashboard/chat-modal.css?v=20260905-callpill" />
    <div
      className={`tr-chat-backdrop${variant === "dock" ? " tr-chat-backdrop--dock" : ""}`}
      onClick={variant === "dock" ? undefined : onClose}
    >
      <div className="tr-chat" role="dialog" aria-modal="true" aria-label={`Чат с ${peerName}`} onClick={(e) => e.stopPropagation()}>
        <div className="tr-chat-watermark" aria-hidden />

        <header className="tr-chat-head">
          <div className="tr-chat-avatar">
            {peerAvatar && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={peerAvatar} alt="" onError={() => setAvatarFailed(true)} />
            ) : (
              <span className="tr-chat-avatar-fb">{initialsOf(peerName)}</span>
            )}
          </div>
          <h2 className="tr-chat-name">{isSupport ? "Поддержка" : peerName}</h2>
          {/* Кнопки вызова + уровень прячем при hideCallActions (чат поверх
              активного звонка) — оба собеседника уже на связи. */}
          {!isSupport && !hideCallActions && (
            <div className="tr-chat-actions">
              <button type="button" className="tr-chat-icon-btn" aria-label="Видеозвонок"><CameraIcon /></button>
              <button type="button" className="tr-chat-icon-btn" aria-label="Аудиозвонок"><PhoneIcon /></button>
            </div>
          )}
          {peerLevel && !isSupport && !hideCallActions && (
            <div className="tr-chat-lvl">
              {peerLevel === "A1" ? "А1" : peerLevel === "A2" ? "А2" : peerLevel}
            </div>
          )}
          {variant === "dock" ? (
            <div className="tr-chat-dockbtns">
              {onMinimize && (
                <button
                  type="button"
                  className="tr-chat-dockbtn tr-chat-dockbtn--min"
                  aria-label="Свернуть чат"
                  onClick={onMinimize}
                >
                  <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                    <path d="M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              {onToggleExpand && (
                <button
                  type="button"
                  className="tr-chat-dockbtn tr-chat-dockbtn--expand"
                  aria-label="Раскрыть на весь экран"
                  onClick={onToggleExpand}
                >
                  <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                    <path d="M5 9L9 5M9 5H5.5M9 5V8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="tr-chat-dockbtn tr-chat-dockbtn--close"
                aria-label="Закрыть чат"
                onClick={onClose}
              >
                <svg viewBox="0 0 14 14" width="12" height="12" fill="none" aria-hidden>
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : (
            // В modal-варианте отдельного крестика нет — окно закрывается по клику на backdrop / ESC (см. Figma).
            onToggleExpand && (
              <button
                type="button"
                className="tr-chat-dockbtn tr-chat-dockbtn--collapse"
                aria-label="Свернуть окно"
                onClick={onToggleExpand}
              >
                <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
                  <path d="M9 5l-4 4M5 9h3.5M5 9V5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )
          )}
        </header>

        <div className="tr-chat-body" ref={bodyRef}>
          {messages.map((m) => {
            // System-события звонка: рендерим как pill вместо bubble.
            // Маркер приходит в text как "__call:started" / "__call:ended".
            const callKind = parseCallMarker(m.text)
            if (callKind) {
              return (
                <div
                  key={m.id}
                  className={`tr-chat-call-pill tr-chat-call-pill--${callKind}`}
                  role="status"
                >
                  {callKind === "ended" ? "Звонок окончен" : "Звонок"}
                </div>
              )
            }
            const mine = isMine(m)
            return (
              <div
                key={m.id}
                className={`tr-chat-bubble tr-chat-bubble--${mine ? currentRole : peerRole} tr-chat-bubble--${mine ? "mine" : "theirs"}${
                  !m.text && m.attachmentUrl && (m.attachmentType === "image" || m.attachmentType === "video")
                    ? " is-media-only"
                    : ""
                }`}
              >
                {m.text}
                {m.attachmentUrl && m.attachmentType === "image" && (
                  <button
                    type="button"
                    className="tr-chat-media-btn"
                    onClick={() => setLightbox({ url: m.attachmentUrl!, type: "image", name: m.attachmentName })}
                    aria-label="Открыть изображение"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.attachmentUrl} alt="" className="tr-chat-media-img" />
                  </button>
                )}
                {m.attachmentUrl && m.attachmentType === "video" && (
                  <button
                    type="button"
                    className="tr-chat-media-btn"
                    onClick={() => setLightbox({ url: m.attachmentUrl!, type: "video", name: m.attachmentName })}
                    aria-label="Открыть видео"
                  >
                    <video
                      src={m.attachmentUrl}
                      className="tr-chat-media-img"
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <span className="tr-chat-media-play" aria-hidden>▶</span>
                  </button>
                )}
                {m.attachmentUrl && m.attachmentType === "document" && (
                  <a
                    href={m.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={m.attachmentName ?? true}
                    className="tr-chat-file-link"
                  >
                    <span className="tr-chat-file-icon"><FileIcon /></span>
                    <span className="tr-chat-file-name">
                      {m.attachmentName ?? "Файл"}
                    </span>
                  </a>
                )}
              </div>
            )
          })}
        </div>

        <div className="tr-chat-input-row">
          <div className="tr-chat-input-pill">
            <div className="tr-chat-attach-wrap">
              <button
                type="button"
                className={`tr-chat-attach${attachOpen ? " is-open" : ""}`}
                aria-label="Прикрепить"
                aria-expanded={attachOpen}
                onClick={() => setAttachOpen((v) => !v)}
              >
                <AttachIcon />
              </button>
              {attachOpen && (
                <div className="tr-chat-attach-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => pickFile("image")}>
                    <PhotoIcon />
                    <span>Фото или видео</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => pickFile("document")}>
                    <DocIcon />
                    <span>Документ</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAttachOpen(false)
                      setPeerInfoOpen(true)
                    }}
                  >
                    <PersonIcon />
                    <span>О собеседнике</span>
                  </button>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              className="tr-chat-input"
              placeholder="Введите сообщение"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
            />
            <button type="button" className="tr-chat-emoji" aria-label="Смайлик"><EmojiIcon /></button>
            <button
              type="button"
              className="tr-chat-send"
              aria-label="Отправить"
              disabled={!draft.trim() || sending}
              onClick={send}
            >
              <SendIcon />
            </button>
          </div>
        </div>

        <input ref={fileImgRef} type="file" accept="image/*,video/*" hidden onChange={(e) => handleFile("image", e)} />
        <input ref={fileDocRef} type="file" hidden onChange={(e) => handleFile("document", e)} />
      </div>

      <PeerInfoModal
        open={peerInfoOpen}
        peerId={peerId}
        peerFallbackName={peerName}
        peerFallbackAvatar={peerAvatar}
        onClose={() => setPeerInfoOpen(false)}
      />

      {lightbox && (
        <div
          className="tr-chat-lightbox"
          onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null) }}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.name ?? "Просмотр вложения"}
        >
          <button
            type="button"
            className="tr-chat-lightbox-close"
            aria-label="Закрыть"
            onClick={() => setLightbox(null)}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden>
              <path d="M3 3l14 14M17 3L3 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {lightbox.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.url} alt="" className="tr-chat-lightbox-media" />
          ) : (
            <video
              src={lightbox.url}
              controls
              autoPlay
              playsInline
              className="tr-chat-lightbox-media"
            />
          )}
        </div>
      )}
    </div>
    </>
  )
}
