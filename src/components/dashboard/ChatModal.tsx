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

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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
function EmojiIcon() {
  return (
    <svg viewBox="0 0 34 34" width="26" height="26" fill="none" aria-hidden>
      <circle cx="17" cy="17" r="15" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="14" r="1.6" fill="currentColor" />
      <circle cx="22" cy="14" r="1.6" fill="currentColor" />
      <path d="M11 21c1.5 2 3.5 3 6 3s4.5-1 6-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
function SendIcon() {
  return <ArrowIcon direction="right" size={14} />
}
function PhotoIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="7" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M18 14l-4-4-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function DocIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
      <path d="M3 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
      <circle cx="10" cy="7" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 17c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
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
    <link rel="stylesheet" href="/dashboard/chat-modal.css?v=20260905-icons" />
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
