// @ts-nocheck
"use client"

import "@/styles/dashboard/admin-support.css"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"

type Thread = {
  id: string
  subject: string
  student_id: string | null
  student_name: string
  student_email: string | null
  student_avatar_url: string | null
  student_level: string | null
  priority: "low" | "medium" | "high"
  status: "open" | "pending" | "resolved" | "closed"
  last_message_at: string
  created_at: string
  unread_count: number
  unread_for_admin?: boolean
  last_message_preview: string | null
  last_message_sender_role?: string | null
}

type Message = {
  id: string
  author_id: string
  author_role: "student" | "teacher" | "admin"
  author_name: string
  author_avatar_url: string | null
  body: string
  attachments: any[]
  created_at: string
}

type FilterKey = "open" | "pending" | "resolved" | "all"

const AVATAR_STYLES = ["red", "", "lime", "dark", ""]

function initialsOf(name: string): string {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function timeAgoRu(iso: string): string {
  try {
    const d = new Date(iso).getTime()
    const diff = Date.now() - d
    if (Number.isNaN(d)) return ""
    const m = Math.round(diff / 60000)
    if (m < 1) return "сейчас"
    if (m < 60) return `${m} мин`
    const h = Math.round(m / 60)
    if (h < 24) return `${h} ч`
    const dd = Math.round(h / 24)
    return `${dd} дн`
  } catch {
    return ""
  }
}

function priorityClass(p: string): string {
  if (p === "high") return "priority-high"
  if (p === "medium") return "priority-med"
  return "priority-low"
}

export default function AdminSupportClient({
  initial,
}: {
  initial: Thread[]
}) {
  const [threads, setThreads] = useState<Thread[]>(initial)
  const [filter, setFilter] = useState<FilterKey>("open")
  const [activeId, setActiveId] = useState<string | null>(
    initial.find((t) => t.status === "open")?.id || initial[0]?.id || null
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const counts = useMemo(() => {
    const c = { open: 0, pending: 0, resolved: 0, all: threads.length }
    for (const t of threads) {
      if (t.status === "open") c.open++
      else if (t.status === "pending") c.pending++
      else if (t.status === "resolved" || t.status === "closed") c.resolved++
    }
    return c
  }, [threads])

  const filtered = useMemo(() => {
    if (filter === "all") return threads
    if (filter === "resolved")
      return threads.filter(
        (t) => t.status === "resolved" || t.status === "closed"
      )
    return threads.filter((t) => t.status === filter)
  }, [threads, filter])

  const active = threads.find((t) => t.id === activeId) || null

  // Keep the right-hand panel in sync with the current filter:
  // if the active thread is not in the filtered list (e.g. user just
  // switched from "Все" → "В работе" while looking at an open ticket),
  // jump to the first thread in the new list — or clear selection so
  // the empty-state «Выберите обращение» is shown.
  useEffect(() => {
    if (filtered.length === 0) {
      if (activeId !== null) setActiveId(null)
      return
    }
    if (!activeId || !filtered.some((t) => t.id === activeId)) {
      setActiveId(filtered[0].id)
      // If the URL pinned a thread that isn't in this filter,
      // clear the search param so a refresh doesn't snap back.
      try {
        const url = new URL(window.location.href)
        if (url.searchParams.has("thread")) {
          url.searchParams.delete("thread")
          window.history.replaceState({}, "", url.toString())
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, filtered])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    let cancelled = false
    const load = async () => {
      setLoadingMessages(true)
      try {
        const res = await fetch(`/api/support/threads/${activeId}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          if (!cancelled) setMessages([])
          return
        }
        const json = await res.json()
        if (!cancelled) {
          setMessages(Array.isArray(json.messages) ? json.messages : [])
        }
      } catch {
        if (!cancelled) setMessages([])
      } finally {
        if (!cancelled) setLoadingMessages(false)
      }
    }
    load()

    // Mark as read on the server, then locally clear unread state.
    void fetch(`/api/admin/support/threads/${activeId}/read`, {
      method: "POST",
    })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return
        setThreads((cur) =>
          cur.map((t) =>
            t.id === activeId
              ? { ...t, unread_count: 0, unread_for_admin: false }
              : t
          )
        )
        // Notify shell to refresh sidebar badge.
        window.dispatchEvent(new CustomEvent("support-unread-changed"))
      })

    return () => {
      cancelled = true
    }
  }, [activeId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const handleSend = async () => {
    if (!active || !draft.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/support/threads/${active.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      })
      if (!res.ok) {
        throw new Error((await res.json())?.error || "Ошибка отправки")
      }
      const json = await res.json()
      const newMsg = json.message as Message
      setMessages((cur) => [...cur, newMsg])
      setDraft("")
      setThreads((cur) =>
        cur.map((t) =>
          t.id === active.id
            ? {
                ...t,
                last_message_at: newMsg.created_at,
                last_message_preview: newMsg.body.slice(0, 120),
              }
            : t
        )
      )
    } catch (e: any) {
      toast.error(e?.message || "Ошибка")
    } finally {
      setSending(false)
    }
  }

  const changeStatus = async (status: Thread["status"]) => {
    if (!active) return
    try {
      const res = await fetch(`/api/support/threads/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        throw new Error("Не удалось изменить статус")
      }
      setThreads((cur) =>
        cur.map((t) => (t.id === active.id ? { ...t, status } : t))
      )
      toast.success("Статус обновлён")
    } catch (e: any) {
      toast.error(e?.message || "Ошибка")
    }
  }

  const changePriority = async (priority: Thread["priority"]) => {
    if (!active) return
    try {
      const res = await fetch(`/api/support/threads/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      })
      if (!res.ok) throw new Error("Не удалось изменить приоритет")
      setThreads((cur) =>
        cur.map((t) => (t.id === active.id ? { ...t, priority } : t))
      )
      toast.success("Приоритет обновлён")
    } catch (e: any) {
      toast.error(e?.message || "Ошибка")
    }
  }

  const refreshThreads = async () => {
    try {
      const res = await fetch(`/api/support/threads?limit=100`, {
        cache: "no-store",
      })
      if (!res.ok) return
      const json = await res.json()
      if (Array.isArray(json?.threads)) {
        setThreads((prev) => {
          // Preserve unread_count locally for the currently-active thread
          // since we mark it read on the server too.
          const next = json.threads as Thread[]
          if (!activeId) return next
          return next.map((t) =>
            t.id === activeId
              ? { ...t, unread_count: 0, unread_for_admin: false }
              : t
          )
        })
      }
    } catch {}
  }

  // Auto-poll threads + react to focus/visibility so new tickets appear
  // without a manual reload.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    timer = setInterval(refreshThreads, 30_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshThreads()
    }
    const onFocus = () => refreshThreads()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Realtime: any insert/update on support_threads or new support_messages
  // → refresh the list immediately.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("admin-support-threads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_threads" },
        () => refreshThreads()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload: any) => {
          refreshThreads()
          // If the active thread received the message, append it to the chat.
          if (
            payload?.new?.thread_id === activeId &&
            payload?.new?.sender_role !== "admin"
          ) {
            void fetch(`/api/support/threads/${activeId}`, {
              cache: "no-store",
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((j) => {
                if (j?.messages) setMessages(j.messages)
              })
              .catch(() => {})
          }
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  return (
    <div className="adm-support">

      <div className="page-hdr">
        <div>
          <h1>Центр <span className="gl">support</span></h1>
          <div className="sub">
            Всего: {threads.length} · открытых: {counts.open} · в работе:{" "}
            {counts.pending}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin" className="btn btn-sm btn-secondary">
            ← На главную
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => void refreshThreads()}
            title="Перезагрузить список"
          >
            ⟳ Обновить
          </button>
        </div>
      </div>

      <div className="layout">
        <div className="thread-list">
          <div className="thread-tabs">
            <button
              type="button"
              className={filter === "open" ? "active" : ""}
              onClick={() => setFilter("open")}
            >
              Открытые ({counts.open})
            </button>
            <button
              type="button"
              className={filter === "pending" ? "active" : ""}
              onClick={() => setFilter("pending")}
            >
              В работе ({counts.pending})
            </button>
            <button
              type="button"
              className={filter === "resolved" ? "active" : ""}
              onClick={() => setFilter("resolved")}
            >
              Решённые ({counts.resolved})
            </button>
            <button
              type="button"
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              Все ({counts.all})
            </button>
          </div>
          <div className="thread-items">
            {filtered.length === 0 ? (
              <div className="empty">
                <b>{threads.length === 0 ? "Данные подгружаются" : "Пусто"}</b>
                {threads.length === 0
                  ? "API поддержки может быть ещё не готов"
                  : "В этой категории обращений нет"}
              </div>
            ) : (
              filtered.map((t, i) => {
                const isUnread =
                  (t.unread_for_admin ?? t.unread_count > 0) &&
                  activeId !== t.id
                return (
                  <div
                    key={t.id}
                    className={`thread-item ${priorityClass(t.priority)}${
                      activeId === t.id ? " active" : ""
                    }${isUnread ? " unread" : ""}`}
                    onClick={() => setActiveId(t.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div
                      className={`th-avatar ${
                        t.student_avatar_url
                          ? ""
                          : AVATAR_STYLES[i % AVATAR_STYLES.length]
                      }`}
                    >
                      {t.student_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.student_avatar_url}
                          alt={t.student_name}
                        />
                      ) : (
                        initialsOf(t.student_name)
                      )}
                    </div>
                    <div className="th-body">
                      <div className="th-subject">
                        {t.subject || "(без темы)"}
                      </div>
                      <div className="th-last">
                        <b style={{ color: "var(--text)" }}>
                          {t.student_name}
                        </b>
                        {" · "}
                        {t.last_message_preview || "Нет сообщений"}
                      </div>
                    </div>
                    <div className="th-meta">
                      <span>
                        {timeAgoRu(t.last_message_at || t.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="chat-panel">
          {!active ? (
            <div className="empty-thread">
              <div>
                <b>Выберите обращение</b>
                Кликните на обращение слева, чтобы открыть переписку
              </div>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="chat-head-info">
                  <h3>{active.subject || "(без темы)"}</h3>
                  <p>
                    {active.student_name}
                    {active.student_level ? ` · ${active.student_level}` : ""}
                    {active.student_email ? ` · ${active.student_email}` : ""}
                  </p>
                </div>
                <div className="chat-head-actions">
                  <select
                    value={active.priority}
                    onChange={(e) =>
                      changePriority(e.target.value as Thread["priority"])
                    }
                  >
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                  </select>
                  <select
                    value={active.status}
                    onChange={(e) =>
                      changeStatus(e.target.value as Thread["status"])
                    }
                  >
                    <option value="open">Открыт</option>
                    <option value="pending">В работе</option>
                    <option value="resolved">Решён</option>
                    <option value="closed">Закрыт</option>
                  </select>
                </div>
              </div>
              <div className="chat-messages">
                {loadingMessages ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: 13,
                      padding: 40,
                    }}
                  >
                    Загружаю сообщения...
                  </div>
                ) : messages.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: 13,
                      padding: 40,
                    }}
                  >
                    Сообщений пока нет
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`msg${m.author_role === "admin" ? " me" : ""}`}
                    >
                      <div className="msg-avatar">
                        {m.author_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.author_avatar_url}
                            alt={m.author_name}
                          />
                        ) : (
                          initialsOf(m.author_name)
                        )}
                      </div>
                      <div>
                        <div className="msg-bubble">{m.body}</div>
                        <div className="msg-time">
                          {format(new Date(m.created_at), "d MMM, HH:mm", {
                            locale: ru,
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>
              <div className="chat-composer">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Ответить ученику... (Cmd/Ctrl+Enter)"
                  rows={2}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                >
                  {sending ? "…" : "Отправить"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
