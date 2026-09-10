"use client"

/* ============================================================
   Универсальный чат-оверлей (multiparty: teacher/student/admin).
   Открывается поверх любого дашборда. Раньше был StudentChat.tsx
   (только teacher→student), теперь role-agnostic.
   Figma node 2208:3846.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { useFitZoom } from "@/components/dashboard/useFitZoom"

const subscribeNoop = () => () => {}

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
import { initialsOf } from "@/lib/ui/initials"

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
  /**
   * Ссылка на комнату звонка (Figma 2522:4253 «Чат с учеником»: учитель может звонить ученику).
   * Кнопки видео/аудио показываем только учителю в чате с учеником; null — урока нет, кнопки неактивны.
   */
  callHref?: string | null
}

// Иконки — экспорт Figma 2522:6073 «Чат с учителем» (public/dashboard/chat/*).
// Аудио/видео-звонки из шапки чата убраны по макету.
function Ic({ src, w, h, className }: { src: string; w: number; h: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden width={w} height={h} className={className} />
}
function AttachIcon() { return <Ic src="/dashboard/chat/plus.svg" w={20.48} h={20.48} /> }            // Group 309
function EmojiIcon() { return <Ic src="/dashboard/chat/emoji.svg" w={35} h={35} /> }                 // Group 175
function SendIcon() { return <Ic src="/dashboard/chat/send-arrow.svg" w={19} h={22.09} className="tr-chat-send-arrow" /> } // Vector 45
function PhotoIcon() { return <Ic src="/dashboard/chat/ic-photo.svg" w={21.67} h={20} /> }          // Group 310
function DocIcon() { return <Ic src="/dashboard/chat/ic-doc.svg" w={22} h={21} /> }                 // Vector
function PersonIcon() { return <Ic src="/dashboard/chat/ic-person.svg" w={17.48} h={21.28} /> }     // Group 311
// Figma 2522:4253: круги 54 (Ellipse 86, lime .26) на (909,53) и (984,53); камера Group 175 29.6×23.35, трубка Vector 27.3×27.35
function VideoIcon() { return <Ic src="/dashboard/chat/ic-video.svg" w={29.61} h={23.35} /> }
function PhoneIcon() { return <Ic src="/dashboard/chat/ic-phone.svg" w={27.32} h={27.35} /> }

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
  callHref,
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

  // Прокрутка к последнему сообщению: сразу и ещё раз после дорисовки (шрифты/картинки/zoom),
  // иначе последний пузырь остаётся под полем ввода.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const toBottom = () => { el.scrollTop = el.scrollHeight }
    toBottom()
    const raf = requestAnimationFrame(toBottom)
    const t = setTimeout(toBottom, 300)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [messages])

  // Портал в body + масштаб как у страницы, но не больше, чем влезает в окно (Figma 1228×815).
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const fitZoom = useFitZoom(1228, 815)

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

  if (!mounted) return null

  return createPortal(
    <>
    <link rel="stylesheet" href="/dashboard/chat-modal.css?v=20260908-calls2" />
    <div
      className={`tr-chat-backdrop${variant === "dock" ? " tr-chat-backdrop--dock" : ""}`}
      style={variant === "dock" ? undefined : { zoom: fitZoom }}
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
          {/* Учитель ↔ ученик (Figma 2522:4253) и админ ↔ ученик (2522:7322): видео/аудио звонок — комната ближайшего урока с учеником */}
          {(currentRole === "teacher" || currentRole === "admin") && peerRole === "student" && !hideCallActions && variant !== "dock" && (
            <div className="tr-chat-calls">
              {callHref !== null && callHref !== undefined ? (
                <>
                  <a className="tr-chat-callbtn" href={callHref} aria-label="Видеозвонок" title="Видеозвонок"><VideoIcon /></a>
                  <a className="tr-chat-callbtn" href={callHref} aria-label="Аудиозвонок" title="Аудиозвонок"><PhoneIcon /></a>
                </>
              ) : (
                <>
                  <button type="button" className="tr-chat-callbtn" disabled aria-label="Видеозвонок" title="Нет запланированного урока с учеником"><VideoIcon /></button>
                  <button type="button" className="tr-chat-callbtn" disabled aria-label="Аудиозвонок" title="Нет запланированного урока с учеником"><PhoneIcon /></button>
                </>
              )}
            </div>
          )}
          {/* Уровень прячем при hideCallActions. */}
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
                    <span className="tr-chat-attach-ic"><PhotoIcon /></span>
                    <span>Фото или видео</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => pickFile("document")}>
                    <span className="tr-chat-attach-ic"><DocIcon /></span>
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
                    <span className="tr-chat-attach-ic"><PersonIcon /></span>
                    <span>{peerRole === "teacher" ? "Об учителе" : peerRole === "student" ? "Об ученике" : "О собеседнике"}</span>
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
    </>,
    document.body,
  )
}
