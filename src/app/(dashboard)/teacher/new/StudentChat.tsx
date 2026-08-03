"use client"

/* ============================================================
   Чат учитель ↔ ученик. Оверлей поверх дашборда, открывается
   из модалки ученика по кнопке «Открыть чат».
   Figma node 2208:3846.

   Data flow:
     • initial load — server action fetchChatMessages(studentId)
     • send text   — server action sendChatMessage
     • upload file — server action uploadChatAttachment
     • realtime    — supabase channel на INSERT в chat_messages,
                     filter=teacher_id=eq.X,student_id=eq.Y
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { createClient as createBrowserSupabase } from "@/lib/supabase/client"
import {
  fetchChatMessages,
  sendChatMessage,
  uploadChatAttachment,
} from "./chat-actions"
import type {
  ChatAttachmentType,
  ChatMessage as DbChatMessage,
  ChatSenderRole,
} from "@/lib/chat/types"

// Локальная UI-модель. Отличается от DbChatMessage тем, что id может быть
// временным (local-...) для оптимистичных сообщений.
export interface ChatMessage {
  id: string
  senderRole: ChatSenderRole
  text: string
  attachmentUrl?: string | null
  attachmentType?: ChatAttachmentType | null
  createdAt: string
}

function dbToUi(m: DbChatMessage): ChatMessage {
  return {
    id: m.id,
    senderRole: m.senderRole,
    text: m.text ?? "",
    attachmentUrl: m.attachmentUrl,
    attachmentType: m.attachmentType,
    createdAt: m.createdAt,
  }
}

interface StudentChatProps {
  studentId: string
  studentName: string
  studentLevel: string
  studentAvatar?: string
  /** teacherId нужен только чтобы realtime-фильтр указывал на «мой» тред.
   *  Если не передан — берём из supabase.auth.getSession в клиенте. */
  teacherId?: string
  /** Роль текущего пользователя. По умолчанию 'teacher' — модалка открывается
   *  из учительского дашборда. Для student-side можно передать 'student'. */
  currentRole?: ChatSenderRole
  onClose: () => void
}

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
function CameraIcon() {
  return (
    <svg viewBox="0 0 30 24" width="26" height="22" fill="none" aria-hidden>
      <path d="M4 6h5l2-3h8l2 3h5v14H4V6z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="15" cy="13" r="4.5" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  )
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M5 4l3-1 2 5-2 1a12 12 0 0 0 7 7l1-2 5 2-1 3a3 3 0 0 1-3 2A17 17 0 0 1 3 7a3 3 0 0 1 2-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
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
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
      <path d="M3 8h9M8 3l5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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

export default function StudentChat({
  studentId,
  studentName,
  studentLevel,
  studentAvatar,
  teacherId: teacherIdProp,
  currentRole = "teacher",
  onClose,
}: StudentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [attachOpen, setAttachOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(!studentAvatar)
  const [resolvedTeacherId, setResolvedTeacherId] = useState<string | null>(teacherIdProp ?? null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fileImgRef = useRef<HTMLInputElement | null>(null)
  const fileDocRef = useRef<HTMLInputElement | null>(null)
  const supabase = useMemo(() => createBrowserSupabase(), [])

  // ESC + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (attachOpen) setAttachOpen(false)
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
  }, [onClose, attachOpen])

  useEffect(() => {
    // Автоскролл в конец списка при появлении новых сообщений
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    // Закрытие меню вложений по клику вне
    if (!attachOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest?.(".tr-chat-attach-wrap")) setAttachOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [attachOpen])

  // Загрузка истории.
  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    fetchChatMessages(studentId)
      .then((rows) => {
        if (cancelled) return
        setMessages(rows.map(dbToUi))
      })
      .catch((err) => {
        if (cancelled) return
        // eslint-disable-next-line no-console
        console.error("[chat] fetchChatMessages failed", err)
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  // Резолвим teacher_id из auth-сессии, если не передан пропсом.
  useEffect(() => {
    if (resolvedTeacherId) return
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      if (data.user) setResolvedTeacherId(data.user.id)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, resolvedTeacherId])

  // Realtime подписка на INSERT в тред.
  useEffect(() => {
    if (!resolvedTeacherId || !studentId) return
    const channelName = `chat:${resolvedTeacherId}:${studentId}`
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `teacher_id=eq.${resolvedTeacherId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string
            teacher_id: string
            student_id: string
            sender_role: ChatSenderRole
            text: string | null
            attachment_url: string | null
            attachment_type: ChatAttachmentType | null
            created_at: string
          }
          // supabase filter умеет только один eq — фильтруем student_id вручную.
          if (row.student_id !== studentId) return
          // Своё сообщение уже вставлено оптимистично и заменено server-версией
          // из sendChatMessage — не дублируем.
          if (row.sender_role === currentRole) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev
              return [
                ...prev,
                {
                  id: row.id,
                  senderRole: row.sender_role,
                  text: row.text ?? "",
                  attachmentUrl: row.attachment_url,
                  attachmentType: row.attachment_type,
                  createdAt: row.created_at,
                },
              ]
            })
            return
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [
              ...prev,
              {
                id: row.id,
                senderRole: row.sender_role,
                text: row.text ?? "",
                // NB: attachment_url в realtime-payload — storage path, не signed URL.
                // Для входящих attachment'ов сделаем отдельный refetch (см. ниже).
                attachmentUrl: row.attachment_url,
                attachmentType: row.attachment_type,
                createdAt: row.created_at,
              },
            ]
          })
          // Если пришло вложение — перезапросим тред целиком, чтобы получить
          // signed URL'ы. Это редкое событие (входящий attachment), поэтому
          // full refetch — приемлемо.
          if (row.attachment_url) {
            fetchChatMessages(studentId)
              .then((rows) => setMessages(rows.map(dbToUi)))
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.error("[chat] refetch after attachment failed", err)
              })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, resolvedTeacherId, studentId, currentRole])

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    const localId = `local-${Date.now()}`
    const optimistic: ChatMessage = {
      id: localId,
      senderRole: currentRole,
      text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft("")
    sendChatMessage({ studentId, text })
      .then((real) => {
        setMessages((prev) => prev.map((m) => (m.id === localId ? dbToUi(real) : m)))
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[chat] sendChatMessage failed", err)
        setMessages((prev) => prev.filter((m) => m.id !== localId))
      })
    inputRef.current?.focus()
  }, [draft, studentId, currentRole])

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

  function handleFile(_kind: "image" | "document", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    const detected = detectKind(file)
    const localId = `local-${Date.now()}`
    // Оптимистичный плейсхолдер: показываем имя файла как «текст» для UX.
    const optimistic: ChatMessage = {
      id: localId,
      senderRole: currentRole,
      text: `📎 ${file.name}`,
      attachmentType: detected,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    uploadChatAttachment({ studentId, file, kind: detected })
      .then((real) => {
        setMessages((prev) => prev.map((m) => (m.id === localId ? dbToUi(real) : m)))
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[chat] uploadChatAttachment failed", err)
        setMessages((prev) => prev.filter((m) => m.id !== localId))
      })
  }

  return (
    <div className="tr-chat-backdrop" onClick={onClose}>
      <div className="tr-chat" role="dialog" aria-modal="true" aria-label={`Чат с ${studentName}`} onClick={(e) => e.stopPropagation()}>
        <div className="tr-chat-watermark" aria-hidden />

        <header className="tr-chat-head">
          <div className="tr-chat-avatar">
            {studentAvatar && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={studentAvatar} alt="" onError={() => setAvatarFailed(true)} />
            ) : (
              <span className="tr-chat-avatar-fb">{initialsOf(studentName)}</span>
            )}
          </div>
          <h2 className="tr-chat-name">{studentName}</h2>
          <div className="tr-chat-actions">
            <button type="button" className="tr-chat-icon-btn" aria-label="Видеозвонок"><CameraIcon /></button>
            <button type="button" className="tr-chat-icon-btn" aria-label="Аудиозвонок"><PhoneIcon /></button>
          </div>
          <div className="tr-chat-lvl">
            {studentLevel === "A1" ? "А1" : studentLevel === "A2" ? "А2" : studentLevel}
          </div>
          <button type="button" className="tr-chat-close" aria-label="Закрыть чат" onClick={onClose}>
            <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="tr-chat-body" ref={bodyRef}>
          {messages.map((m) => (
            <div key={m.id} className={`tr-chat-bubble tr-chat-bubble--${m.senderRole}`}>
              {m.text}
              {m.attachmentUrl && m.attachmentType === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.attachmentUrl}
                  alt=""
                  style={{ maxWidth: 260, borderRadius: 12, display: "block", marginTop: m.text ? 6 : 0 }}
                />
              )}
              {m.attachmentUrl && m.attachmentType === "video" && (
                <video
                  src={m.attachmentUrl}
                  controls
                  style={{ maxWidth: 320, borderRadius: 12, display: "block", marginTop: m.text ? 6 : 0 }}
                />
              )}
              {m.attachmentUrl && m.attachmentType === "document" && (
                <a
                  href={m.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "block", marginTop: m.text ? 6 : 0 }}
                >
                  Скачать документ
                </a>
              )}
            </div>
          ))}
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
                  <button type="button" role="menuitem" onClick={() => setAttachOpen(false)}>
                    <PersonIcon />
                    <span>Об ученике</span>
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
              disabled={!draft.trim()}
              onClick={send}
            >
              <SendIcon />
            </button>
          </div>
        </div>

        <input ref={fileImgRef} type="file" accept="image/*,video/*" hidden onChange={(e) => handleFile("image", e)} />
        <input ref={fileDocRef} type="file" hidden onChange={(e) => handleFile("document", e)} />
      </div>
    </div>
  )
}
