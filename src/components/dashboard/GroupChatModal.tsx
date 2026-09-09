"use client"

/* ============================================================
   GroupChatModal — оверлей группового чата.
   Reuses .tr-chat-* CSS из chat-modal.css (те же bubble/input/head).
   Отличия от 1:1 ChatModal:
     • header: имя группы + счётчик участников (без level);
     • bubble foreign: сверху имя отправителя;
     • «начать звонок» — только у учителя (student ученик не может звать
       участников в комнату — это решение владельца группы).
   Realtime — supabase channel на group_messages для этой group_id.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { useFitZoom } from "@/components/dashboard/useFitZoom"

const subscribeNoop = () => () => {}

import { createClient as createBrowserSupabase } from "@/lib/supabase/client"
import {
  fetchGroupMessages,
  markGroupRead,
  sendGroupMessage,
  uploadGroupAttachment,
} from "@/lib/groupchat/actions"
import type {
  GroupAttachmentType,
  GroupChatRole,
  GroupMessage,
} from "@/lib/groupchat/types"

interface UiMsg {
  id: string
  senderId: string
  senderName: string | null
  senderAvatar: string | null
  senderRole: GroupChatRole
  text: string
  attachmentUrl?: string | null
  attachmentType?: GroupAttachmentType | null
  attachmentName?: string | null
  createdAt: string
}

function toUi(m: GroupMessage): UiMsg {
  // Для document text используется как отображаемое имя файла.
  const isDoc = m.attachmentType === "document"
  return {
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName,
    senderAvatar: m.senderAvatar,
    senderRole: m.senderRole,
    text: isDoc ? "" : m.text ?? "",
    attachmentUrl: m.attachmentUrl,
    attachmentType: m.attachmentType,
    attachmentName: isDoc ? m.text : null,
    createdAt: m.createdAt,
  }
}

function initialsOf(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "?").toUpperCase() +
    (parts[1]?.[0] ?? "").toUpperCase()
}

// Иконки — экспорт Figma 2522:6807 «Чат с учителем» (public/dashboard/chat/*), те же, что в ChatModal.
function Ic({ src, w, h, className }: { src: string; w: number; h: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden width={w} height={h} className={className} />
}
function SendIcon() { return <Ic src="/dashboard/chat/send-arrow.svg" w={19} h={22.09} className="tr-chat-send-arrow" /> } // Vector 45
function AttachIcon() { return <Ic src="/dashboard/chat/plus.svg" w={20.48} h={20.48} /> }   // Group 309
function PhotoIcon() { return <Ic src="/dashboard/chat/ic-photo.svg" w={21.67} h={20} /> } // Group 310
function DocIcon() { return <Ic src="/dashboard/chat/ic-doc.svg" w={22} h={21} /> }        // Vector
function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z M14 3v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

interface GroupChatModalProps {
  groupId: string
  groupName: string
  /** Не показывается в шапке (макет 2522:6807), оставлен для совместимости вызовов */
  memberCount?: number
  currentUserId: string
  currentRole: GroupChatRole
  onClose: () => void
}

export default function GroupChatModal({
  groupId,
  groupName,
  currentUserId,
  currentRole,
  onClose,
}: GroupChatModalProps) {
  const [messages, setMessages] = useState<UiMsg[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [lightbox, setLightbox] = useState<
    | { url: string; type: "image" | "video"; name?: string | null }
    | null
  >(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileImgRef = useRef<HTMLInputElement>(null)
  const fileDocRef = useRef<HTMLInputElement>(null)

  const supabaseRef = useRef(createBrowserSupabase())

  // Загрузка истории при mount + пометка прочитанного.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const rows = await fetchGroupMessages(groupId)
        if (!alive) return
        setMessages(rows.map(toUi))
      } catch (e) {
        console.error("[GroupChatModal] fetch failed", e)
      }
    })()
    return () => {
      alive = false
    }
  }, [groupId])

  // Auto-scroll в низ при добавлении.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  // ESC + body scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightbox) setLightbox(null)
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
  }, [onClose, lightbox])

  // Клик мимо attach-menu закрывает его.
  useEffect(() => {
    if (!attachOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest?.(".tr-chat-attach-wrap")) setAttachOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [attachOpen])

  // Realtime: подписываемся на INSERT в group_messages для нашей группы.
  useEffect(() => {
    const sb = supabaseRef.current
    const ch = sb
      .channel(`group_messages:${groupId}:${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as {
            id: string
            group_id: string
            sender_id: string
            sender_role: GroupChatRole
            text: string | null
            attachment_url: string | null
            attachment_type: GroupAttachmentType | null
            created_at: string
          }
          // Игнорируем эхо своих отправок — они уже в state.
          if (row.sender_id === currentUserId) return
          // Для attachment realtime-payload не даёт signed URL — перезапросим
          // всю ленту одним вызовом (не оптимально, но проще правильно).
          if (row.attachment_url) {
            fetchGroupMessages(groupId).then((rows) => {
              setMessages(rows.map(toUi))
              markGroupRead(groupId).catch(() => {})
            }).catch(() => {})
            return
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [
              ...prev,
              {
                id: row.id,
                senderId: row.sender_id,
                senderName: null,
                senderAvatar: null,
                senderRole: row.sender_role,
                text: row.text ?? "",
                createdAt: row.created_at,
              },
            ]
          })
          markGroupRead(groupId).catch(() => {})
        },
      )
      .subscribe((status, err) => {
        // Reconnect-safe: перечитываем ленту после (re)подписки, чтобы
        // не потерять сообщения отправленные во время разрыва сокета.
        if (status === "SUBSCRIBED") {
          fetchGroupMessages(groupId)
            .then((rows) => setMessages(rows.map(toUi)))
            .catch(() => {})
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("[group-chat] realtime status:", status, err ?? "")
        }
      })
    return () => {
      sb.removeChannel(ch)
    }
  }, [groupId, currentUserId])

  const send = useCallback(async () => {
    const t = draft.trim()
    if (!t || sending) return
    setSending(true)
    const tempId = `tmp-${Date.now()}`
    const optimistic: UiMsg = {
      id: tempId,
      senderId: currentUserId,
      senderName: "Вы",
      senderAvatar: null,
      senderRole: currentRole,
      text: t,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft("")
    try {
      const created = await sendGroupMessage({ groupId, text: t })
      setMessages((prev) => prev.map((m) => (m.id === tempId ? toUi(created) : m)))
    } catch (e) {
      console.error("[GroupChatModal] send failed", e)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setDraft(t)
      alert(e instanceof Error ? e.message : "Не удалось отправить сообщение")
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [draft, sending, currentUserId, currentRole, groupId])

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

  async function handleFile(chosenKind: "image" | "document", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // позволить выбрать тот же файл ещё раз
    if (!file) return

    // Определяем реальный kind: если через «Документ» выбрали — всегда document.
    // Через «Фото или видео» — автоопределяем image/video, иначе document.
    let kind: GroupAttachmentType
    if (chosenKind === "document") {
      kind = "document"
    } else if (file.type.startsWith("image/")) {
      kind = "image"
    } else if (file.type.startsWith("video/")) {
      kind = "video"
    } else {
      kind = "document"
    }

    // Оптимистичный item с blob-URL для мгновенного превью.
    const tempId = `tmp-att-${Date.now()}`
    const previewUrl = kind === "document" ? undefined : URL.createObjectURL(file)
    const optimistic: UiMsg = {
      id: tempId,
      senderId: currentUserId,
      senderName: "Вы",
      senderAvatar: null,
      senderRole: currentRole,
      text: "",
      attachmentUrl: previewUrl,
      attachmentType: kind,
      attachmentName: kind === "document" ? file.name : null,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setSending(true)
    try {
      const created = await uploadGroupAttachment({
        groupId,
        file,
        kind,
        // Для document — храним имя файла в text (потом отрисуем как ссылку).
        text: kind === "document" ? file.name : null,
      })
      setMessages((prev) => prev.map((m) => (m.id === tempId ? toUi(created) : m)))
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    } catch (err) {
      console.error("[GroupChatModal] upload failed", err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      alert(err instanceof Error ? err.message : "Не удалось загрузить файл")
    } finally {
      setSending(false)
    }
  }

  const rendered = useMemo(() => {
    return messages.map((m, i) => {
      const prev = i > 0 ? messages[i - 1] : null
      const showName = m.senderId !== currentUserId && (!prev || prev.senderId !== m.senderId)
      return { m, showName }
    })
  }, [messages, currentUserId])

  // Портал в body + масштаб как у страницы, но не больше, чем влезает в окно.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const fitZoom = useFitZoom(1228, 815)
  if (!mounted) return null

  return createPortal(
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/chat-modal.css?v=20260908-wide" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/group-chat.css?v=20260909-figma" />
      <div className="tr-chat-backdrop" style={{ zoom: fitZoom }} onClick={onClose}>
        <div
          className="tr-chat"
          role="dialog"
          aria-modal="true"
          aria-label={`Групповой чат ${groupName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tr-chat-watermark" aria-hidden />

          <header className="tr-chat-head">
            <div className="tr-chat-avatar" aria-hidden>
              <span className="tr-chat-avatar-fb">{initialsOf(groupName)}</span>
            </div>
            <h2 className="tr-chat-name">{groupName}</h2>
            {/* По макету 2522:6807 в шапке только аватар и имя: кнопки звонка и счётчика участников нет */}
            {/* Крестика в макете нет: закрытие по Esc и клику по фону */}
          </header>

          <div className="tr-chat-body" ref={bodyRef}>
            {rendered.length === 0 && (
              <div className="tr-groupchat-empty">
                Пока нет сообщений. Напишите первым!
              </div>
            )}
            {rendered.map(({ m, showName }) => {
              // Свои сообщения — справа (лайм), чужие — слева (белые) с именем отправителя над пузырём.
              // Раньше сторона выбиралась по роли автора, и сообщения учителя у ученика уезжали вправо,
              // а имя оставалось слева.
              const mine = m.senderId === currentUserId
              const isMediaOnly =
                !m.text &&
                m.attachmentUrl &&
                (m.attachmentType === "image" || m.attachmentType === "video")
              return (
                <div key={m.id} className={`tr-groupchat-item tr-groupchat-item--${mine ? "mine" : "theirs"}`}>
                  {showName && (
                    <div className="tr-groupchat-sender">{m.senderName ?? "Участник"}</div>
                  )}
                  <div
                    className={`tr-chat-bubble tr-chat-bubble--${mine ? "mine" : "theirs"}${
                      isMediaOnly ? " is-media-only" : ""
                    }`}
                  >
                    {m.text}
                    {m.attachmentUrl && m.attachmentType === "image" && (
                      <button
                        type="button"
                        className="tr-chat-media-btn"
                        onClick={() =>
                          setLightbox({
                            url: m.attachmentUrl!,
                            type: "image",
                            name: m.attachmentName,
                          })
                        }
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
                        onClick={() =>
                          setLightbox({
                            url: m.attachmentUrl!,
                            type: "video",
                            name: m.attachmentName,
                          })
                        }
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
                        <span className="tr-chat-file-name">{m.attachmentName ?? "Файл"}</span>
                      </a>
                    )}
                  </div>
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
                  disabled={sending}
                >
                  <AttachIcon />
                </button>
                {attachOpen && (
                  <div className="tr-chat-attach-menu tr-chat-attach-menu--two" role="menu">
                    <button type="button" role="menuitem" onClick={() => pickFile("image")}>
                      <span className="tr-chat-attach-ic"><PhotoIcon /></span>
                      <span>Фото или видео</span>
                    </button>
                    <button type="button" role="menuitem" onClick={() => pickFile("document")}>
                      <span className="tr-chat-attach-ic"><DocIcon /></span>
                      <span>Документ</span>
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
                disabled={sending}
              />
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
