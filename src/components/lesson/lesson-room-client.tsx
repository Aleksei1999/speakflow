"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

interface Props {
  lessonId: string
  scheduledAt: string
  durationMinutes: number
  userId: string
  userName: string
  teacherName: string
  jitsiDomain: string
  jitsiToken: string
  jitsiRoom: string
  isTeacher?: boolean
}

interface ChatMsg {
  id: string
  sender_id: string
  message: string
  created_at: string
}

interface Material {
  id: string
  title: string
  content: string
  file_url: string | null
  created_at: string
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any
  }
}

const CSS = `
:root{--red:#E63946;--lime:#D8F26A;--black:#0A0A0A;--bg:#F5F5F3;--surface:#FFFFFF;--surface-2:#FAFAF7;--border:#EEEEEA;--muted:#8A8A86;--text:#0A0A0A}
.lr{font-family:'Inter',sans-serif;display:flex;flex-direction:column;height:100vh;background:var(--bg);overflow:hidden;margin:-60px;color:var(--text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.lr *{box-sizing:border-box}
.lr a{color:inherit;text-decoration:none}
.lr button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.lr .lh{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:var(--black);color:#fff;flex-shrink:0}
.lr .logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px}
.lr .logo .mark{width:34px;height:34px;background:var(--red);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:800;font-style:italic;font-family:Georgia,serif;transform:rotate(-8deg)}
.lr .li{display:flex;align-items:center;gap:20px}
.lr .li .title{color:#A0A09A;font-size:14px}
.lr .li .title strong{color:#fff;font-weight:600;margin-left:4px}
.lr .tmr{background:var(--lime);color:var(--black);padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
.lr .tmr .dot{width:7px;height:7px;background:var(--black);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.lr .btn-exit{border-radius:999px;padding:9px 18px;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2)}
.lr .btn-exit:hover{background:rgba(255,255,255,0.18)}
.lr .btn-exit:active{transform:scale(0.97)}
.lr .lm{flex:1;display:grid;grid-template-columns:1fr 400px;gap:16px;padding:16px;overflow:hidden}
.lr .va{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
.lr .vm{position:relative;flex:1;background:#1a1a1a;border-radius:12px;overflow:hidden;min-height:0}
.lr .live-badge{position:absolute;top:16px;left:16px;background:var(--red);color:#fff;padding:6px 12px;border-radius:999px;font-size:10px;letter-spacing:1.5px;font-weight:800;display:flex;align-items:center;gap:6px;z-index:10;pointer-events:none}
.lr .live-badge .blink{width:6px;height:6px;background:#fff;border-radius:50%;animation:blink 1.5s infinite}
@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:.3}}
.lr .vc{display:flex;justify-content:center;gap:12px;padding:6px 0 2px;flex-shrink:0}
.lr .cb{width:52px;height:52px;background:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all .15s ease;color:var(--text)}
.lr .cb:hover{background:#e8e8e4}
.lr .cb.active{background:var(--lime)}
.lr .cb.danger{background:var(--red);color:#fff;transform:rotate(135deg)}
.lr .cb.danger:hover{opacity:.9}
.lr .cb svg{width:22px;height:22px}
.lr .ls{background:var(--surface);border:1px solid var(--border);border-radius:16px;display:flex;flex-direction:column;overflow:hidden}
.lr .lt{display:flex;padding:8px;gap:4px;border-bottom:1px solid var(--border);flex-shrink:0}
.lr .ltb{flex:1;padding:11px;text-align:center;font-size:13px;font-weight:600;color:var(--muted);border-radius:10px;transition:all .15s ease}
.lr .ltb:hover{background:var(--bg)}
.lr .ltb.active{background:var(--black);color:#fff;font-weight:700}
.lr .lc{flex:1;display:flex;flex-direction:column;min-height:0}
.lr .cms{flex:1;padding:18px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
.lr .cm{display:flex;gap:10px;align-items:flex-start}
.lr .cm .ma{width:32px;height:32px;background:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0}
.lr .cm .mb{flex:1;min-width:0}
.lr .cm .au{font-weight:700;font-size:12px;margin-bottom:4px}
.lr .cm .tx{background:var(--bg);border-radius:14px 14px 14px 4px;padding:10px 14px;font-size:13px;line-height:1.5}
.lr .cm.me{flex-direction:row-reverse}
.lr .cm.me .ma{background:var(--red);color:#fff}
.lr .cm.me .mb{display:flex;flex-direction:column;align-items:flex-end}
.lr .cm.me .au{color:var(--muted)}
.lr .cm.me .tx{background:var(--lime);border-radius:14px 14px 4px 14px;max-width:85%}
.lr .ci{padding:12px;border-top:1px solid var(--border);background:var(--surface-2);display:flex;gap:8px;align-items:center;flex-shrink:0}
.lr .ci input{flex:1;background:#fff;border:1px solid var(--border);border-radius:999px;padding:11px 18px;font-size:13px;color:var(--text);outline:none;font-family:inherit}
.lr .ci input:focus{border-color:var(--black)}
.lr .ci input::placeholder{color:var(--muted)}
.lr .ci .sb{width:40px;height:40px;background:var(--black);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s ease}
.lr .ci .sb:hover{background:var(--red)}
.lr .ci .sb svg{width:16px;height:16px}
.lr .notes-area{flex:1;padding:18px;display:flex;flex-direction:column}
.lr .notes-area textarea{flex:1;width:100%;resize:none;border:1px solid var(--border);border-radius:12px;padding:14px;font-size:13px;font-family:inherit;outline:none;background:var(--bg)}
.lr .notes-area textarea:focus{border-color:var(--black)}
.lr .notes-area .ns{margin-top:8px;text-align:right}
.lr .notes-area .ns button{background:var(--black);color:#fff;border-radius:999px;padding:8px 20px;font-size:12px;font-weight:600}
.lr .mats{flex:1;padding:18px;color:var(--muted);display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px}
@media(max-width:1000px){.lr .lm{grid-template-columns:1fr;grid-template-rows:1fr auto}.lr .ls{height:320px}}
@media(max-width:640px){.lr .lh{padding:12px 14px;flex-wrap:wrap;gap:10px}.lr .li{order:3;width:100%;justify-content:space-between}.lr .lm{padding:10px;gap:10px}.lr .cb{width:44px;height:44px}.lr .cb svg{width:18px;height:18px}}
`

export function LessonRoomClient({
  lessonId, scheduledAt, durationMinutes, userId, userName, teacherName,
  jitsiDomain, jitsiToken, jitsiRoom, isTeacher = false,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"chat" | "materials" | "notes">("chat")
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [newMsg, setNewMsg] = useState("")
  const [notes, setNotes] = useState("")
  const [materials, setMaterials] = useState<Material[]>([])
  const [matTitle, setMatTitle] = useState("")
  const [matContent, setMatContent] = useState("")
  const [matLink, setMatLink] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [screenOn, setScreenOn] = useState(false)
  const msgsEndRef = useRef<HTMLDivElement>(null)
  const jitsiContainerRef = useRef<HTMLDivElement>(null)
  const jitsiApiRef = useRef<any>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const userInitials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  const teacherInitials = teacherName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

  // Timer
  useEffect(() => {
    const start = new Date(scheduledAt).getTime()
    const iv = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    }, 1000)
    return () => clearInterval(iv)
  }, [scheduledAt])

  const timerText = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`

  // Load Jitsi IFrame API
  useEffect(() => {
    if (!jitsiContainerRef.current) return
    let disposed = false

    async function initJitsi() {
      if (!window.JitsiMeetExternalAPI) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script")
          s.src = `https://${jitsiDomain}/external_api.js`
          s.async = true
          s.onload = () => resolve()
          s.onerror = () => reject()
          document.head.appendChild(s)
        })
      }
      if (disposed || !jitsiContainerRef.current) return

      const api = new window.JitsiMeetExternalAPI(jitsiDomain, {
        roomName: jitsiRoom,
        parentNode: jitsiContainerRef.current,
        width: "100%",
        height: "100%",
        ...(jitsiToken ? { jwt: jitsiToken } : {}),
        configOverwrite: {
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          hideConferenceSubject: true,
          disableInviteFunctions: true,
          toolbarButtons: [],
          filmstrip: { disableResizable: true },
          notifications: [],
          disableThirdPartyRequests: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_ALWAYS_VISIBLE: false,
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true,
          DISABLE_FOCUS_INDICATOR: true,
          filmStripOnly: false,
        },
        userInfo: { displayName: userName },
      })
      jitsiApiRef.current = api
    }

    initJitsi().catch(() => {})
    return () => {
      disposed = true
      if (jitsiApiRef.current) {
        try { jitsiApiRef.current.dispose() } catch {}
        jitsiApiRef.current = null
      }
    }
  }, [jitsiDomain, jitsiRoom, jitsiToken, userName])

  // Chat: load + poll
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/lesson/messages?lessonId=${lessonId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch {}
  }, [lessonId])

  useEffect(() => {
    loadMessages()
    pollRef.current = setInterval(loadMessages, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadMessages])

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  // Load notes
  useEffect(() => {
    fetch(`/api/lesson/notes?lessonId=${lessonId}&userId=${userId}`)
      .then(r => r.json())
      .then(d => setNotes(d.content ?? ""))
      .catch(() => {})
  }, [lessonId, userId])

  // Load materials
  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch(`/api/lesson/materials?lessonId=${lessonId}`)
      if (res.ok) setMaterials(await res.json())
    } catch {}
  }, [lessonId])

  useEffect(() => { loadMaterials() }, [loadMaterials])

  const addMaterial = useCallback(async () => {
    if (!matTitle.trim()) return
    await fetch("/api/lesson/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, userId, title: matTitle.trim(), content: matContent.trim(), fileUrl: matLink.trim() || null }),
    })
    setMatTitle("")
    setMatContent("")
    setMatLink("")
    loadMaterials()
  }, [matTitle, matContent, matLink, lessonId, userId, loadMaterials])

  const sendMsg = useCallback(async () => {
    if (!newMsg.trim()) return
    const text = newMsg.trim()
    setNewMsg("")
    setMessages(prev => [...prev, { id: Date.now().toString(), sender_id: userId, message: text, created_at: new Date().toISOString() }])
    await fetch("/api/lesson/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, userId, message: text }),
    })
  }, [newMsg, lessonId, userId])

  const saveNotes = useCallback(async () => {
    await fetch("/api/lesson/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, userId, content: notes }),
    })
  }, [notes, lessonId, userId])

  // Jitsi controls
  const toggleMic = () => {
    jitsiApiRef.current?.executeCommand("toggleAudio")
    setMicOn(v => !v)
  }
  const toggleCam = () => {
    jitsiApiRef.current?.executeCommand("toggleVideo")
    setCamOn(v => !v)
  }
  const toggleScreen = () => {
    jitsiApiRef.current?.executeCommand("toggleShareScreen")
    setScreenOn(v => !v)
  }
  const handleEnd = () => {
    if (confirm("Завершить урок?")) {
      jitsiApiRef.current?.executeCommand("hangup")
      router.push(isTeacher ? "/teacher" : "/student")
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lr">
        <header className="lh">
          <a href="/" className="logo"><span className="mark">R</span><span>Raw English</span></a>
          <div className="li">
            <span className="title">Урок с <strong>{teacherName}</strong></span>
            <div className="tmr"><span className="dot" /><span>{timerText}</span></div>
          </div>
          <div><button className="btn-exit" onClick={handleEnd}>Выйти из урока</button></div>
        </header>

        <div className="lm">
          <div className="va">
            <div className="vm">
              <div ref={jitsiContainerRef} style={{ width: "100%", height: "100%" }} />
              <div className="live-badge"><span className="blink" />LIVE</div>
            </div>
            <div className="vc">
              <button className={`cb ${micOn ? "active" : ""}`} title="Микрофон" onClick={toggleMic}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>
              </button>
              <button className={`cb ${camOn ? "active" : ""}`} title="Камера" onClick={toggleCam}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
              </button>
              <button className={`cb ${screenOn ? "active" : ""}`} title="Демонстрация" onClick={toggleScreen}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
              </button>
              <button className="cb danger" title="Завершить" onClick={handleEnd}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </button>
            </div>
          </div>

          <aside className="ls">
            <div className="lt">
              <button className={`ltb ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>Чат</button>
              <button className={`ltb ${tab === "materials" ? "active" : ""}`} onClick={() => setTab("materials")}>Материалы</button>
              <button className={`ltb ${tab === "notes" ? "active" : ""}`} onClick={() => setTab("notes")}>Заметки</button>
            </div>

            {tab === "chat" && (
              <div className="lc">
                <div className="cms">
                  {messages.map((m) => {
                    const isMe = m.sender_id === userId
                    return (
                      <div key={m.id} className={`cm ${isMe ? "me" : ""}`}>
                        <div className="ma">{isMe ? userInitials : teacherInitials}</div>
                        <div className="mb">
                          <div className="au">{isMe ? "Вы" : teacherName}</div>
                          <div className="tx">{m.message}</div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={msgsEndRef} />
                </div>
                <div className="ci">
                  <input
                    type="text" value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMsg()}
                    placeholder="Написать сообщение..." autoComplete="off"
                  />
                  <button className="sb" onClick={sendMsg}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  </button>
                </div>
              </div>
            )}

            {tab === "materials" && (
              <div className="lc">
                <div className="cms">
                  {materials.length === 0 && !isTeacher && (
                    <div className="mats">Материалы урока появятся здесь</div>
                  )}
                  {materials.map((m) => (
                    <div key={m.id} style={{ background: "var(--bg)", borderRadius: 12, padding: 14, marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{m.title}</div>
                      {m.content && <div style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "pre-wrap", marginBottom: 6 }}>{m.content}</div>}
                      {m.file_url && (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--red)", fontWeight: 600, textDecoration: "underline" }}>
                          Открыть ссылку
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {isTeacher && (
                  <div className="ci" style={{ flexDirection: "column", gap: 8, alignItems: "stretch" }}>
                    <input
                      type="text" value={matTitle}
                      onChange={(e) => setMatTitle(e.target.value)}
                      placeholder="Название материала..."
                      style={{ borderRadius: 12 }}
                    />
                    <textarea
                      value={matContent}
                      onChange={(e) => setMatContent(e.target.value)}
                      placeholder="Описание или текст..."
                      style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", resize: "none", height: 50, outline: "none" }}
                    />
                    <input
                      type="url" value={matLink}
                      onChange={(e) => setMatLink(e.target.value)}
                      placeholder="Ссылка (необязательно)..."
                      style={{ borderRadius: 12 }}
                    />
                    <button onClick={addMaterial} className="sb" style={{ width: "100%", borderRadius: 999, height: "auto", padding: "10px 0", fontSize: 13, fontWeight: 600 }}>
                      Добавить материал
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === "notes" && (
              <div className="notes-area">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Ваши заметки по уроку..." />
                <div className="ns"><button onClick={saveNotes}>Сохранить</button></div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}
