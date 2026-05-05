// @ts-nocheck
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client"

const CSS = `
.sup-page{max-width:1280px;margin:0 auto}
.sup-page *{box-sizing:border-box}
.sup-page .sp-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.sup-page .sp-hdr h1{font-size:28px;font-weight:800;letter-spacing:-.8px;line-height:1.1}
.sup-page .sp-hdr h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.sup-page .sp-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}

.sup-page .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:100px;font-size:12px;font-weight:700;transition:all .15s;cursor:pointer;border:none;text-decoration:none;font-family:inherit}
.sup-page .btn:active{transform:scale(.97)}
.sup-page .btn:disabled{opacity:.55;cursor:not-allowed}
.sup-page .btn-sm{padding:6px 12px;font-size:11px}
.sup-page .btn-red{background:var(--red);color:#fff}
.sup-page .btn-red:hover{filter:brightness(.92)}
.sup-page .btn-lime{background:var(--lime);color:#0A0A0A}
.sup-page .btn-lime:hover{filter:brightness(.95)}
.sup-page .btn-dark{background:var(--accent-dark);color:#fff}
.sup-page .btn-dark:hover{background:var(--red)}
[data-theme="dark"] .sup-page .btn-dark{background:var(--surface-2)}
.sup-page .btn-outline{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.sup-page .btn-outline:hover{border-color:var(--text)}

/* LAYOUT */
.sup-page .sp-grid{display:grid;grid-template-columns:340px 1fr;gap:16px;height:calc(100vh - 160px);min-height:560px}
@media(max-width:1024px){.sup-page .sp-grid{grid-template-columns:1fr;height:auto;min-height:0}}

/* THREAD LIST */
.sup-page .sp-list{background:var(--surface);border:1px solid var(--border);border-radius:18px;display:flex;flex-direction:column;overflow:hidden}
.sup-page .sp-list-head{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0}
.sup-page .sp-list-head h3{font-size:14px;font-weight:800;letter-spacing:-.2px}
.sup-page .sp-list-head .count{font-size:11px;color:var(--muted);font-weight:600}
.sup-page .sp-search{padding:10px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
.sup-page .sp-search input{width:100%;padding:9px 12px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);font-size:13px;color:var(--text);font-family:inherit;outline:none;transition:border-color .15s}
.sup-page .sp-search input:focus{border-color:var(--text)}
.sup-page .sp-list-body{flex:1;overflow-y:auto;padding:6px}
.sup-page .sp-thread{display:block;width:100%;text-align:left;padding:12px 14px;border-radius:12px;border:1px solid transparent;cursor:pointer;background:none;font-family:inherit;color:inherit;transition:all .12s;margin-bottom:2px}
.sup-page .sp-thread:hover{background:var(--bg)}
.sup-page .sp-thread.active{background:var(--bg);border-color:var(--border)}
.sup-page .sp-thread-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
.sup-page .sp-thread-subj{font-size:13px;font-weight:800;letter-spacing:-.2px;line-height:1.25;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.sup-page .sp-thread-time{font-size:10px;color:var(--muted);font-weight:600;flex-shrink:0;white-space:nowrap}
.sup-page .sp-thread-preview{font-size:11.5px;color:var(--muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px}
.sup-page .sp-thread-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.sup-page .pill{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:100px;font-size:10px;font-weight:700;letter-spacing:.2px}
.sup-page .pill.open{background:rgba(216,242,106,.22);color:#5A7A00}
[data-theme="dark"] .sup-page .pill.open{background:rgba(216,242,106,.18);color:var(--lime)}
.sup-page .pill.pending{background:rgba(245,158,11,.14);color:#B45309}
[data-theme="dark"] .sup-page .pill.pending{background:rgba(245,158,11,.18);color:#FDBA74}
.sup-page .pill.closed{background:rgba(10,10,10,.06);color:var(--muted)}
[data-theme="dark"] .sup-page .pill.closed{background:rgba(255,255,255,.08)}
.sup-page .pill.high{background:rgba(230,57,70,.12);color:var(--red)}
.sup-page .pill.urgent{background:var(--red);color:#fff}
.sup-page .sp-empty{padding:40px 20px;text-align:center;color:var(--muted);font-size:12px}
.sup-page .sp-skel{padding:12px 14px}
.sup-page .sp-skel-line{height:10px;background:var(--bg);border-radius:6px;margin-bottom:8px;animation:spSkel 1.4s infinite}
@keyframes spSkel{0%,100%{opacity:.6}50%{opacity:.3}}

/* CHAT PANE */
.sup-page .sp-chat{background:var(--surface);border:1px solid var(--border);border-radius:18px;display:flex;flex-direction:column;overflow:hidden;min-height:0}
.sup-page .sp-chat-head{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0}
.sup-page .sp-chat-title{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.sup-page .sp-chat-subj{font-size:15px;font-weight:800;letter-spacing:-.3px;line-height:1.2;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sup-page .sp-chat-meta{font-size:11px;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sup-page .sp-chat-body{flex:1;overflow-y:auto;padding:18px 20px;background:var(--bg);display:flex;flex-direction:column;gap:10px;min-height:0}
.sup-page .sp-day{align-self:center;background:var(--surface-2);border:1px solid var(--border);padding:4px 12px;border-radius:100px;font-size:10px;font-weight:700;color:var(--muted);margin:6px 0;text-transform:uppercase;letter-spacing:.5px}
.sup-page .sp-msg{max-width:70%;display:flex;flex-direction:column;gap:3px}
.sup-page .sp-msg.mine{align-self:flex-end;align-items:flex-end}
.sup-page .sp-msg.theirs{align-self:flex-start;align-items:flex-start}
.sup-page .sp-msg.system{align-self:center;max-width:85%}
.sup-page .sp-bubble{padding:10px 14px;border-radius:16px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}
.sup-page .sp-msg.mine .sp-bubble{background:var(--accent-dark);color:#fff;border-bottom-right-radius:4px}
[data-theme="dark"] .sup-page .sp-msg.mine .sp-bubble{background:var(--red)}
.sup-page .sp-msg.theirs .sp-bubble{background:var(--surface);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px}
.sup-page .sp-msg.system .sp-bubble{background:rgba(216,242,106,.18);border:1px dashed rgba(90,122,0,.25);color:#5A7A00;font-style:italic;font-size:12.5px;text-align:center}
[data-theme="dark"] .sup-page .sp-msg.system .sp-bubble{background:rgba(216,242,106,.1);border-color:rgba(216,242,106,.3);color:var(--lime)}
.sup-page .sp-msg-meta{font-size:10px;color:var(--muted);padding:0 4px;display:flex;gap:6px}
.sup-page .sp-msg-author{font-weight:700;color:var(--text)}
.sup-page .sp-chat-foot{padding:12px 14px;border-top:1px solid var(--border);background:var(--surface);flex-shrink:0}
.sup-page .sp-composer{display:flex;gap:8px;align-items:flex-end;background:var(--surface-2);border:1px solid var(--border);border-radius:18px;padding:8px 10px;transition:border-color .15s}
.sup-page .sp-composer:focus-within{border-color:var(--text)}
.sup-page .sp-composer textarea{flex:1;background:none;border:none;resize:none;outline:none;font-family:inherit;font-size:13.5px;color:var(--text);line-height:1.45;max-height:140px;min-height:22px;padding:6px 4px}
.sup-page .sp-composer textarea::placeholder{color:var(--muted)}
.sup-page .sp-send{width:36px;height:36px;border-radius:50%;background:var(--accent-dark);color:#fff;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;flex-shrink:0;transition:all .15s}
.sup-page .sp-send:hover{background:var(--red)}
.sup-page .sp-send:disabled{opacity:.45;cursor:not-allowed}
.sup-page .sp-send svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

.sup-page .sp-blank{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px;text-align:center;color:var(--muted)}
.sup-page .sp-blank .sp-blank-ico{width:64px;height:64px;border-radius:18px;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--red)}
.sup-page .sp-blank .sp-blank-ico svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.sup-page .sp-blank h3{font-size:16px;font-weight:800;color:var(--text);letter-spacing:-.3px}
.sup-page .sp-blank p{font-size:13px;max-width:340px;line-height:1.5}

/* MODAL */
.sup-page-modal{position:fixed;inset:0;background:rgba(10,10,10,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1000}
.sup-page-modal .m-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;width:100%;max-width:520px;padding:22px 24px;box-shadow:0 30px 80px rgba(0,0,0,.2)}
.sup-page-modal h2{font-size:20px;font-weight:800;letter-spacing:-.5px;margin-bottom:6px}
.sup-page-modal p.sub{font-size:13px;color:var(--muted);margin-bottom:18px}
.sup-page-modal label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin-bottom:6px}
.sup-page-modal input,.sup-page-modal textarea{width:100%;padding:11px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);font-size:13.5px;color:var(--text);font-family:inherit;outline:none;transition:border-color .15s;margin-bottom:14px}
.sup-page-modal input:focus,.sup-page-modal textarea:focus{border-color:var(--text)}
.sup-page-modal textarea{resize:vertical;min-height:130px;line-height:1.5}
.sup-page-modal .m-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
`

type Thread = {
  id: string
  subject: string
  last_message?: string | null
  last_message_at?: string | null
  status?: "open" | "pending" | "closed" | string
  priority?: "low" | "normal" | "high" | "urgent" | string | null
  unread_count?: number
}

type Message = {
  id: string
  thread_id: string
  sender_id: string | null
  author_role?: "student" | "teacher" | "admin" | "system" | string | null
  body: string
  created_at: string
}

type Role = "student" | "teacher"

export default function SupportClient({
  userId,
  userName,
  role,
}: {
  userId: string
  userName: string
  role: Role
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const [threads, setThreads] = useState<Thread[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [subject, setSubject] = useState("")
  const [firstBody, setFirstBody] = useState("")
  const [creating, setCreating] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Load threads
  const loadThreads = useCallback(async () => {
    setLoadingThreads(true)
    try {
      const res = await fetch("/api/support/threads", { cache: "no-store" })
      if (!res.ok) throw new Error("failed")
      const json = await res.json()
      const list: Thread[] = Array.isArray(json?.threads) ? json.threads : []
      setThreads(list)
      if (list.length > 0 && !activeId) {
        setActiveId(list[0].id)
      }
    } catch {
      setThreads([])
    } finally {
      setLoadingThreads(false)
    }
  }, [activeId])

  useEffect(() => {
    loadThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load single thread
  const loadThread = useCallback(async (id: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/support/threads/${id}`, { cache: "no-store" })
      if (!res.ok) throw new Error("failed")
      const json = await res.json()
      setActiveThread(json?.thread ?? null)
      setMessages(Array.isArray(json?.messages) ? json.messages : [])
    } catch {
      setActiveThread(null)
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (!activeId) {
      setActiveThread(null)
      setMessages([])
      return
    }
    loadThread(activeId)
  }, [activeId, loadThread])

  // Autoscroll on new messages
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages])

  // Realtime subscription for active thread
  useEffect(() => {
    if (!activeId) return
    const channel = supabase
      .channel(`support-thread-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `thread_id=eq.${activeId}`,
        },
        (payload: any) => {
          const m = payload?.new as Message
          if (!m) return
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeId, supabase])

  // Auto-resize composer
  const autoSize = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(140, ta.scrollHeight) + "px"
  }, [])

  useEffect(() => {
    autoSize()
  }, [draft, autoSize])

  const handleSend = useCallback(async () => {
    const body = draft.trim()
    if (!body || !activeId || sending) return
    setSending(true)
    // Optimistic
    const tempId = `tmp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      thread_id: activeId,
      sender_id: userId,
      author_role: role,
      body,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft("")
    try {
      const res = await fetch(`/api/support/threads/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error("failed")
      const json = await res.json()
      const real = json?.message as Message | undefined
      if (real) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? real : m)).filter((m, i, arr) =>
            arr.findIndex((x) => x.id === m.id) === i
          )
        )
      }
      // Refresh thread list last_message preview
      loadThreads()
    } catch {
      toast.error("Не удалось отправить сообщение")
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setDraft(body)
    } finally {
      setSending(false)
    }
  }, [draft, activeId, sending, userId, role, loadThreads])

  const handleCreate = useCallback(async () => {
    const s = subject.trim()
    const b = firstBody.trim()
    if (!s || !b || creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/support/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: s, body: b }),
      })
      if (!res.ok) throw new Error("failed")
      const json = await res.json()
      const t = json?.thread as Thread | undefined
      toast.success("Тикет создан")
      setModalOpen(false)
      setSubject("")
      setFirstBody("")
      await loadThreads()
      if (t?.id) setActiveId(t.id)
    } catch {
      toast.error("Не удалось создать тикет")
    } finally {
      setCreating(false)
    }
  }, [subject, firstBody, creating, loadThreads])

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads
    const q = search.trim().toLowerCase()
    return threads.filter(
      (t) =>
        (t.subject ?? "").toLowerCase().includes(q) ||
        (t.last_message ?? "").toLowerCase().includes(q)
    )
  }, [threads, search])

  const messagesGrouped = useMemo(() => {
    const groups: Array<{ dateLabel: string; items: Message[] }> = []
    let lastKey = ""
    for (const m of messages) {
      const d = new Date(m.created_at)
      const key = format(d, "yyyy-MM-dd")
      if (key !== lastKey) {
        groups.push({ dateLabel: format(d, "d MMMM yyyy", { locale: ru }), items: [] })
        lastKey = key
      }
      groups[groups.length - 1].items.push(m)
    }
    return groups
  }, [messages])

  const roleLabel = role === "teacher" ? "преподавателя" : "ученика"

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sup-page">
        <div className="sp-hdr">
          <div>
            <h1>
              Центр <span className="gl">support</span>
            </h1>
            <div className="sub">
              Напишите нам, если что-то не работает или нужен совет. Мы отвечаем в течение рабочего дня.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-red"
            onClick={() => setModalOpen(true)}
          >
            + Новый тикет
          </button>
        </div>

        <div className="sp-grid">
          {/* LIST */}
          <aside className="sp-list">
            <div className="sp-list-head">
              <h3>Мои тикеты</h3>
              <span className="count">
                {threads.length > 0 ? `${threads.length} шт.` : "0 шт."}
              </span>
            </div>
            <div className="sp-search">
              <input
                type="text"
                placeholder="Поиск по теме"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="sp-list-body">
              {loadingThreads ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="sp-skel">
                      <div className="sp-skel-line" style={{ width: "70%" }} />
                      <div className="sp-skel-line" style={{ width: "90%" }} />
                      <div className="sp-skel-line" style={{ width: "40%" }} />
                    </div>
                  ))}
                </>
              ) : filteredThreads.length === 0 ? (
                <div className="sp-empty">
                  {search
                    ? "По запросу ничего не найдено."
                    : `Пока нет обращений. Создайте тикет, чтобы связаться с поддержкой ${roleLabel}.`}
                </div>
              ) : (
                filteredThreads.map((t) => {
                  const timeLabel = t.last_message_at
                    ? formatDistanceToNow(new Date(t.last_message_at), {
                        addSuffix: false,
                        locale: ru,
                      })
                    : ""
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`sp-thread${activeId === t.id ? " active" : ""}`}
                      onClick={() => setActiveId(t.id)}
                    >
                      <div className="sp-thread-top">
                        <span className="sp-thread-subj">{t.subject || "Без темы"}</span>
                        {timeLabel ? <span className="sp-thread-time">{timeLabel}</span> : null}
                      </div>
                      {t.last_message ? (
                        <div className="sp-thread-preview">{t.last_message}</div>
                      ) : null}
                      <div className="sp-thread-meta">
                        <span className={`pill ${t.status ?? "open"}`}>
                          {t.status === "closed"
                            ? "Закрыт"
                            : t.status === "pending"
                              ? "Ждёт ответа"
                              : "Открыт"}
                        </span>
                        {t.priority && t.priority !== "normal" && t.priority !== "low" ? (
                          <span className={`pill ${t.priority}`}>
                            {t.priority === "urgent" ? "Срочно" : "Приоритет"}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          {/* CHAT */}
          <section className="sp-chat">
            {!activeId ? (
              <div className="sp-blank">
                <div className="sp-blank-ico">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3>Выберите тикет</h3>
                <p>
                  Откройте существующее обращение слева или создайте новое, чтобы начать переписку с командой
                  поддержки.
                </p>
                <button
                  type="button"
                  className="btn btn-dark"
                  onClick={() => setModalOpen(true)}
                >
                  + Новый тикет
                </button>
              </div>
            ) : (
              <>
                <div className="sp-chat-head">
                  <div className="sp-chat-title">
                    <span className="sp-chat-subj">
                      {activeThread?.subject ?? "Загрузка..."}
                    </span>
                    <span className="sp-chat-meta">
                      {activeThread?.status ? (
                        <span className={`pill ${activeThread.status}`}>
                          {activeThread.status === "closed"
                            ? "Закрыт"
                            : activeThread.status === "pending"
                              ? "Ждёт ответа"
                              : "Открыт"}
                        </span>
                      ) : null}
                      {activeThread?.last_message_at ? (
                        <span>
                          Обновлён{" "}
                          {formatDistanceToNow(new Date(activeThread.last_message_at), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>

                <div className="sp-chat-body" ref={bodyRef}>
                  {loadingMessages ? (
                    <div className="sp-empty" style={{ margin: "auto" }}>
                      Загружаю сообщения...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="sp-empty" style={{ margin: "auto" }}>
                      Здесь пока нет сообщений.
                    </div>
                  ) : (
                    messagesGrouped.map((group) => (
                      <div key={group.dateLabel} style={{ display: "contents" }}>
                        <div className="sp-day">{group.dateLabel}</div>
                        {group.items.map((m) => {
                          const mine = m.sender_id === userId
                          const system = m.author_role === "system"
                          const cls = system ? "system" : mine ? "mine" : "theirs"
                          const time = format(new Date(m.created_at), "HH:mm")
                          const authorLabel = system
                            ? "Система"
                            : m.author_role === "admin"
                              ? "Поддержка"
                              : m.author_role === "teacher"
                                ? "Преподаватель"
                                : mine
                                  ? "Вы"
                                  : "Собеседник"
                          return (
                            <div key={m.id} className={`sp-msg ${cls}`}>
                              <div className="sp-bubble">{m.body}</div>
                              <div className="sp-msg-meta">
                                <span className="sp-msg-author">{authorLabel}</span>
                                <span>·</span>
                                <span>{time}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>

                <div className="sp-chat-foot">
                  <div className="sp-composer">
                    <textarea
                      ref={taRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={
                        activeThread?.status === "closed"
                          ? "Тикет закрыт. Создайте новый, чтобы продолжить."
                          : "Напишите сообщение..."
                      }
                      disabled={activeThread?.status === "closed" || sending}
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="sp-send"
                      onClick={handleSend}
                      disabled={
                        !draft.trim() ||
                        sending ||
                        activeThread?.status === "closed"
                      }
                      aria-label="Отправить"
                    >
                      <svg viewBox="0 0 24 24">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {modalOpen ? (
        <div
          className="sup-page-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) setModalOpen(false)
          }}
        >
          <div className="m-card">
            <h2>Новый тикет</h2>
            <p className="sub">
              Опишите вопрос как можно подробнее — так мы ответим быстрее и точнее.
            </p>

            <label htmlFor="sp-subj">Тема</label>
            <input
              id="sp-subj"
              type="text"
              placeholder="Например: не получается забронировать урок"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={140}
              disabled={creating}
            />

            <label htmlFor="sp-body">Сообщение</label>
            <textarea
              id="sp-body"
              placeholder="Что случилось, какие шаги вы уже попробовали, какой ожидали результат?"
              value={firstBody}
              onChange={(e) => setFirstBody(e.target.value)}
              disabled={creating}
            />

            <div className="m-foot">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setModalOpen(false)}
                disabled={creating}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-red"
                onClick={handleCreate}
                disabled={!subject.trim() || !firstBody.trim() || creating}
              >
                {creating ? "Отправка..." : "Создать тикет"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
