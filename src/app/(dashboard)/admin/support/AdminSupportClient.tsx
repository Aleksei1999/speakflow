// @ts-nocheck
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

const CSS = `
.adm-support{max-width:1400px;margin:0 auto}

.adm-support .page-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.adm-support .page-hdr h1{font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.adm-support .page-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}

.adm-support .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s ease;cursor:pointer;border:none;text-decoration:none}
.adm-support .btn:disabled{opacity:.55;cursor:not-allowed}
.adm-support .btn-sm{padding:6px 14px;font-size:12px}
.adm-support .btn-primary{background:var(--accent-dark);color:#fff}
.adm-support .btn-primary:hover{background:var(--red)}
.adm-support .btn-red{background:var(--red);color:#fff}
.adm-support .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.adm-support .btn-secondary:hover{border-color:var(--text)}

.adm-support .layout{display:grid;grid-template-columns:340px 1fr;gap:16px;min-height:calc(100vh - 240px)}

.adm-support .thread-list{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.adm-support .thread-tabs{display:flex;gap:4px;padding:10px;border-bottom:1px solid var(--border);background:var(--surface-2);overflow-x:auto}
.adm-support .thread-tabs button{padding:6px 12px;border-radius:100px;font-size:11px;font-weight:700;color:var(--muted);border:none;background:none;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all .15s}
.adm-support .thread-tabs button:hover{color:var(--text)}
.adm-support .thread-tabs button.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-support .thread-tabs button.active{background:var(--red)}

.adm-support .thread-items{flex:1;overflow-y:auto}
.adm-support .thread-item{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;position:relative}
.adm-support .thread-item:hover{background:var(--surface-2)}
.adm-support .thread-item.active{background:var(--bg);border-left:3px solid var(--red)}
.adm-support .thread-item.priority-high{border-left:3px solid var(--red)}
.adm-support .thread-item.priority-med{border-left:3px solid #F59E0B}
.adm-support .thread-item.priority-low{border-left:3px solid #22c55e}
.adm-support .thread-item.unread{background:rgba(230,57,70,.05)}
.adm-support .thread-item.unread .th-subject{font-weight:800}
.adm-support .thread-item.unread .th-last{color:var(--text)}
.adm-support .thread-item.unread::after{content:"";position:absolute;top:14px;right:14px;width:8px;height:8px;border-radius:50%;background:var(--red)}
.adm-support .th-avatar{width:36px;height:36px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;color:var(--text);overflow:hidden}
.adm-support .th-avatar img{width:100%;height:100%;object-fit:cover}
.adm-support .th-avatar.red{background:var(--red);color:#fff}
.adm-support .th-avatar.lime{background:var(--lime);color:#0A0A0A}
.adm-support .th-avatar.dark{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-support .th-avatar.dark{background:var(--red)}
.adm-support .th-body{flex:1;min-width:0}
.adm-support .th-subject{font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.adm-support .th-last{font-size:11px;color:var(--muted);line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.adm-support .th-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;font-size:10px;color:var(--muted);font-weight:600}
.adm-support .unread-dot{background:var(--red);color:#fff;border-radius:999px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;padding:0 5px}

.adm-support .chat-panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.adm-support .chat-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--surface-2);flex-wrap:wrap}
.adm-support .chat-head-info h3{font-size:16px;font-weight:800;color:var(--text);letter-spacing:-.2px}
.adm-support .chat-head-info p{font-size:12px;color:var(--muted);margin-top:2px}
.adm-support .chat-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.adm-support .chat-head-actions select{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:6px 10px;font-size:12px;color:var(--text);font-family:inherit;font-weight:600;cursor:pointer}

.adm-support .chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;background:var(--bg)}
.adm-support .msg{display:flex;gap:10px;max-width:72%}
.adm-support .msg.me{align-self:flex-end;flex-direction:row-reverse}
.adm-support .msg-avatar{width:32px;height:32px;border-radius:50%;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;color:var(--text);overflow:hidden}
.adm-support .msg-avatar img{width:100%;height:100%;object-fit:cover}
.adm-support .msg.me .msg-avatar{background:var(--red);color:#fff;border-color:var(--red)}
.adm-support .msg-bubble{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:10px 14px;font-size:13px;color:var(--text);line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
.adm-support .msg.me .msg-bubble{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}
[data-theme="dark"] .adm-support .msg.me .msg-bubble{background:var(--red);border-color:var(--red)}
.adm-support .msg-time{font-size:10px;color:var(--muted);margin-top:4px;display:block;text-align:right}

.adm-support .chat-composer{padding:14px 16px;border-top:1px solid var(--border);display:flex;gap:10px;align-items:flex-end}
.adm-support .chat-composer textarea{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--text);font-family:inherit;resize:none;min-height:40px;max-height:140px;transition:border-color .15s}
.adm-support .chat-composer textarea:focus{outline:none;border-color:var(--text)}

.adm-support .empty-thread{flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;padding:40px 16px;text-align:center}
.adm-support .empty-thread b{display:block;color:var(--text);font-size:16px;margin-bottom:6px}

.adm-support .empty{padding:60px 16px;text-align:center;color:var(--muted);font-size:14px}
.adm-support .empty b{display:block;color:var(--text);font-size:16px;margin-bottom:4px}

@media(max-width:900px){
  .adm-support .layout{grid-template-columns:1fr}
  .adm-support .thread-list{max-height:360px}
}
`

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

  return (
    <div className="adm-support">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="page-hdr">
        <div>
          <h1>Поддержка</h1>
          <div className="sub">
            Всего: {threads.length} · открытых: {counts.open} · в работе:{" "}
            {counts.pending}
          </div>
        </div>
        <div>
          <Link href="/admin" className="btn btn-sm btn-secondary">
            ← На главную
          </Link>
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
                  : "В этой категории тикетов нет"}
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
                <b>Выберите тикет</b>
                Кликните на тикет слева, чтобы открыть переписку
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
