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
  lessonNumber?: number
  studentLevel?: string
  teacherRating?: number
  nextLessonAt?: string | null
}

interface ChatMsg { id: string; sender_id: string; message: string; created_at: string }
interface Material { id: string; title: string; content: string; file_url: string | null; created_at: string }

declare global { interface Window { JitsiMeetExternalAPI: any } }

const CSS = `
:root{--red:#E63946;--lime:#D8F26A;--black:#0A0A0A;--bg:#F5F5F3;--surface:#FFFFFF;--surface-2:#FAFAF7;--border:#EEEEEA;--muted:#8A8A86;--text:#0A0A0A}
.lr{font-family:'Inter',sans-serif;display:flex;flex-direction:column;height:100vh;background:var(--bg);overflow:hidden;margin:-60px;color:var(--text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.lr *{box-sizing:border-box}.lr a{color:inherit;text-decoration:none}.lr button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.lr .lh{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:var(--black);color:#fff;flex-shrink:0}
.lr .logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px}
.lr .logo .mark{width:34px;height:34px;background:var(--red);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:800;font-style:italic;font-family:Georgia,serif;transform:rotate(-8deg)}
.lr .li{display:flex;align-items:center;gap:20px}
.lr .li .title{color:#A0A09A;font-size:14px}.lr .li .title strong{color:#fff;font-weight:600;margin-left:4px}
.lr .tmr{background:var(--lime);color:var(--black);padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
.lr .tmr .dot{width:7px;height:7px;background:var(--black);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.lr .btn-exit{border-radius:999px;padding:9px 18px;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);transition:transform .1s ease}
.lr .btn-exit:hover{background:rgba(255,255,255,0.18)}.lr .btn-exit:active{transform:scale(0.97)}
.lr .lm{flex:1;display:flex;flex-direction:column;gap:14px;padding:16px;overflow:hidden}
.lr .lesson-stats{display:grid;grid-template-columns:repeat(3,1fr) 1.3fr;gap:12px;flex-shrink:0}
.lr .stat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.lr .stat .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.lr .stat .value{font-size:28px;font-weight:800;margin-top:6px;letter-spacing:-0.5px}
.lr .stat .value small{font-size:14px;color:var(--muted);font-weight:500;margin-left:2px}
.lr .stat-dark{background:var(--black);color:#fff;border-color:var(--black)}.lr .stat-dark .label{color:#A0A09A}.lr .stat-dark .value small{color:#A0A09A}
.lr .stat-lime{background:var(--lime);border-color:var(--lime)}.lr .stat-lime .label{opacity:.7}.lr .stat-lime .value small{opacity:.7}
.lr .stat-teacher{display:flex;align-items:center;gap:12px;padding:12px 14px}
.lr .av{width:44px;height:44px;background:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
.lr .stat-teacher .info{flex:1;min-width:0}.lr .stat-teacher .name{font-weight:700;font-size:14px}.lr .stat-teacher .sub{font-size:11px;color:var(--muted)}
.lr .rating{background:var(--lime);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}
.lr .lb{flex:1;display:grid;grid-template-columns:1fr 400px;gap:16px;min-height:0;transition:grid-template-columns .2s ease}
.lr .lb.no-sidebar{grid-template-columns:1fr}
.lr .va{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
.lr .vm{position:relative;flex:1;background:#1a1a1a;border-radius:12px;overflow:hidden;min-height:0}
.lr .live-badge{position:absolute;top:16px;left:16px;background:var(--red);color:#fff;padding:6px 12px;border-radius:999px;font-size:10px;letter-spacing:1.5px;font-weight:800;display:flex;align-items:center;gap:6px;z-index:10;pointer-events:none}
.lr .live-badge .blink{width:6px;height:6px;background:#fff;border-radius:50%;animation:blink 1.5s infinite}
@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:.3}}
.lr .quality-badge{position:absolute;top:16px;right:16px;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);color:#fff;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;z-index:10;pointer-events:none}
.lr .vc{display:flex;justify-content:center;gap:12px;padding:6px 0 2px;flex-shrink:0}
.lr .cb{width:52px;height:52px;background:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all .15s ease;color:var(--text)}
.lr .cb:hover{background:#e8e8e4}.lr .cb.active{background:var(--lime)}.lr .cb.danger{background:var(--red);color:#fff;transform:rotate(135deg)}.lr .cb.danger:hover{opacity:.9}
.lr .cb svg{width:22px;height:22px}
.lr .ls{background:var(--surface);border:1px solid var(--border);border-radius:16px;display:flex;flex-direction:column;overflow:hidden}
.lr .lt{display:flex;padding:8px;gap:4px;border-bottom:1px solid var(--border);flex-shrink:0}
.lr .ltb{flex:1;padding:11px;text-align:center;font-size:13px;font-weight:600;color:var(--muted);border-radius:10px;transition:all .15s ease}
.lr .ltb:hover{background:var(--bg)}.lr .ltb.active{background:var(--black);color:#fff;font-weight:700}
.lr .lc{flex:1;display:flex;flex-direction:column;min-height:0}
.lr .cms{flex:1;padding:18px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
.lr .cm{display:flex;gap:10px;align-items:flex-start}
.lr .cm .ma{width:32px;height:32px;background:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0}
.lr .cm .mb{flex:1;min-width:0}.lr .cm .au{font-weight:700;font-size:12px;margin-bottom:4px}
.lr .cm .tx{background:var(--bg);border-radius:14px 14px 14px 4px;padding:10px 14px;font-size:13px;line-height:1.5}
.lr .cm.me{flex-direction:row-reverse}.lr .cm.me .ma{background:var(--red);color:#fff}
.lr .cm.me .mb{display:flex;flex-direction:column;align-items:flex-end}.lr .cm.me .au{color:var(--muted)}
.lr .cm.me .tx{background:var(--lime);border-radius:14px 14px 4px 14px;max-width:85%}
.lr .ci{padding:12px;border-top:1px solid var(--border);background:var(--surface-2);display:flex;gap:8px;align-items:center;flex-shrink:0}
.lr .ci input{flex:1;background:#fff;border:1px solid var(--border);border-radius:999px;padding:11px 18px;font-size:13px;color:var(--text);outline:none;font-family:inherit}
.lr .ci input:focus{border-color:var(--black)}.lr .ci input::placeholder{color:var(--muted)}
.lr .ci .sb{width:40px;height:40px;background:var(--black);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s ease}
.lr .ci .sb:hover{background:var(--red)}.lr .ci .sb svg{width:16px;height:16px}
.lr .notes-area{flex:1;padding:18px;display:flex;flex-direction:column}
.lr .notes-area textarea{flex:1;width:100%;resize:none;border:1px solid var(--border);border-radius:12px;padding:14px;font-size:13px;font-family:inherit;outline:none;background:var(--bg)}
.lr .notes-area textarea:focus{border-color:var(--black)}
.lr .notes-area .ns{margin-top:8px;text-align:right}
.lr .notes-area .ns button{background:var(--black);color:#fff;border-radius:999px;padding:8px 20px;font-size:12px;font-weight:600}
.lr .mats-list{flex:1;padding:18px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.lr .lesson-bottom{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;flex-shrink:0}
.lr .bb-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s ease,transform .1s ease}
.lr .bb-card:hover{border-color:var(--black)}.lr .bb-card:active{transform:scale(0.99)}
.lr .bb-card.dark{background:var(--black);color:#fff;border-color:var(--black)}.lr .bb-card.dark .sub{color:#A0A09A}.lr .bb-card.dark:hover{border-color:var(--red)}
.lr .bb-icon{width:38px;height:38px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text)}
.lr .bb-icon.lime{background:var(--lime);color:var(--black)}.lr .bb-icon.red{background:var(--red);color:#fff}
.lr .bb-icon svg{width:18px;height:18px}
.lr .bb-card .title{font-weight:700;font-size:13px}.lr .bb-card .sub{font-size:11px;color:var(--muted);margin-top:2px}
@media(max-width:1000px){.lr .lb{grid-template-columns:1fr;grid-template-rows:1fr auto}.lr .ls{height:320px}.lr .lesson-bottom{grid-template-columns:1fr}}
@media(max-width:900px){.lr .lesson-stats{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.lr .lh{padding:12px 14px;flex-wrap:wrap;gap:10px}.lr .li{order:3;width:100%;justify-content:space-between}.lr .lm{padding:10px;gap:10px}.lr .cb{width:44px;height:44px}.lr .cb svg{width:18px;height:18px}}
`

export function LessonRoomClient({
  lessonId, scheduledAt, durationMinutes, userId, userName, teacherName,
  jitsiDomain, jitsiToken, jitsiRoom, isTeacher = false, lessonNumber = 1, studentLevel = "—",
  teacherRating = 0, nextLessonAt = null,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"chat"|"materials"|"notes">("chat")
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
  const [sidebarOn, setSidebarOn] = useState(true)
  const msgsEndRef = useRef<HTMLDivElement>(null)
  const jitsiRef = useRef<HTMLDivElement>(null)
  const jitsiApi = useRef<any>(null)
  const pollRef = useRef<any>(null)

  const myInitials = userName.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)
  const otherInitials = teacherName.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)

  // Timer
  useEffect(() => {
    const start = new Date(scheduledAt).getTime()
    const iv = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now()-start)/1000))), 1000)
    return () => clearInterval(iv)
  }, [scheduledAt])
  const mm = String(Math.floor(elapsed/60)).padStart(2,"0")
  const ss = String(elapsed%60).padStart(2,"0")

  // Jitsi
  useEffect(() => {
    if (!jitsiRef.current) return
    let disposed = false
    async function init() {
      if (!window.JitsiMeetExternalAPI) {
        await new Promise<void>((res,rej) => {
          const s = document.createElement("script"); s.src=`https://${jitsiDomain}/external_api.js`; s.async=true; s.onload=()=>res(); s.onerror=()=>rej(); document.head.appendChild(s)
        })
      }
      if (disposed||!jitsiRef.current) return
      jitsiApi.current = new window.JitsiMeetExternalAPI(jitsiDomain, {
        roomName: jitsiRoom, parentNode: jitsiRef.current, width:"100%", height:"100%",
        ...(jitsiToken?{jwt:jitsiToken}:{}),
        configOverwrite:{prejoinPageEnabled:false,disableDeepLinking:true,hideConferenceSubject:true,disableInviteFunctions:true,toolbarButtons:[],notifications:[],disableThirdPartyRequests:true},
        interfaceConfigOverwrite:{SHOW_JITSI_WATERMARK:false,SHOW_WATERMARK_FOR_GUESTS:false,TOOLBAR_ALWAYS_VISIBLE:false,MOBILE_APP_PROMO:false,HIDE_INVITE_MORE_HEADER:true,DISABLE_FOCUS_INDICATOR:true},
        userInfo:{displayName:userName},
      })
    }
    init().catch(()=>{})
    return()=>{disposed=true;try{jitsiApi.current?.dispose()}catch{};jitsiApi.current=null}
  }, [jitsiDomain,jitsiRoom,jitsiToken,userName])

  // Chat
  const loadMessages = useCallback(async()=>{
    try{const r=await fetch(`/api/lesson/messages?lessonId=${lessonId}`);if(r.ok)setMessages(await r.json())}catch{}
  },[lessonId])
  useEffect(()=>{loadMessages();pollRef.current=setInterval(loadMessages,3000);return()=>clearInterval(pollRef.current)},[loadMessages])
  useEffect(()=>{msgsEndRef.current?.scrollIntoView({behavior:"smooth"})},[messages])

  // Notes
  useEffect(()=>{fetch(`/api/lesson/notes?lessonId=${lessonId}&userId=${userId}`).then(r=>r.json()).then(d=>setNotes(d.content??"")).catch(()=>{})},[lessonId,userId])

  // Materials
  const loadMats = useCallback(async()=>{try{const r=await fetch(`/api/lesson/materials?lessonId=${lessonId}`);if(r.ok)setMaterials(await r.json())}catch{}},[lessonId])
  useEffect(()=>{loadMats()},[loadMats])

  const sendMsg = useCallback(async()=>{
    if(!newMsg.trim())return;const t=newMsg.trim();setNewMsg("")
    setMessages(p=>[...p,{id:Date.now().toString(),sender_id:userId,message:t,created_at:new Date().toISOString()}])
    await fetch("/api/lesson/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lessonId,userId,message:t})})
  },[newMsg,lessonId,userId])

  const saveNotes = useCallback(async()=>{
    await fetch("/api/lesson/notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lessonId,userId,content:notes})})
  },[notes,lessonId,userId])

  const addMat = useCallback(async()=>{
    if(!matTitle.trim())return
    await fetch("/api/lesson/materials",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lessonId,userId,title:matTitle.trim(),content:matContent.trim(),fileUrl:matLink.trim()||null})})
    setMatTitle("");setMatContent("");setMatLink("");loadMats()
  },[matTitle,matContent,matLink,lessonId,userId,loadMats])

  const toggleMic=()=>{jitsiApi.current?.executeCommand("toggleAudio");setMicOn(v=>!v)}
  const toggleCam=()=>{jitsiApi.current?.executeCommand("toggleVideo");setCamOn(v=>!v)}
  const toggleScreen=()=>{jitsiApi.current?.executeCommand("toggleShareScreen");setScreenOn(v=>!v)}
  const handleEnd=()=>{if(confirm("Завершить урок?")){jitsiApi.current?.executeCommand("hangup");router.push(isTeacher?"/teacher":"/student")}}

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:CSS}} />
      <div className="lr">
        {/* Header */}
        <header className="lh">
          <a href="/" className="logo"><span className="mark">R</span><span>Raw English</span></a>
          <div className="li">
            <span className="title">Урок с <strong>{teacherName}</strong></span>
            <div className="tmr"><span className="dot"/><span>{mm}:{ss}</span></div>
          </div>
          <div><button className="btn-exit" onClick={handleEnd}>Выйти из урока</button></div>
        </header>

        <div className="lm">
          {/* Stats bar */}
          <div className="lesson-stats">
            <div className="stat">
              <div className="label">Длительность</div>
              <div className="value">{durationMinutes}<small>/мин</small></div>
            </div>
            <div className="stat stat-dark">
              <div className="label">Уровень</div>
              <div className="value">{studentLevel}<small> · Intermediate</small></div>
            </div>
            <div className="stat stat-lime">
              <div className="label">Урок №</div>
              <div className="value">{lessonNumber}<small>/48</small></div>
            </div>
            <div className="stat stat-teacher">
              <div className="av">{otherInitials}</div>
              <div className="info">
                <div className="name">{teacherName}</div>
                <div className="sub">{isTeacher?"ученик":"teacher"}</div>
              </div>
              {teacherRating > 0 && <div className="rating">★ {teacherRating.toFixed(1)}</div>}
            </div>
          </div>

          {/* Body */}
          <div className={`lb ${sidebarOn?"":"no-sidebar"}`}>
            <div className="va">
              <div className="vm">
                <div ref={jitsiRef} style={{width:"100%",height:"100%"}} />
                <div className="live-badge"><span className="blink"/>LIVE</div>
                <div className="quality-badge">Wi-Fi</div>
              </div>
              <div className="vc">
                <button className={`cb ${micOn?"active":""}`} title="Микрофон" onClick={toggleMic}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>
                </button>
                <button className={`cb ${camOn?"active":""}`} title="Камера" onClick={toggleCam}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
                </button>
                <button className={`cb ${screenOn?"active":""}`} title="Демонстрация" onClick={toggleScreen}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                </button>
                <button className={`cb ${sidebarOn?"active":""}`} title="Показать/скрыть чат" onClick={()=>setSidebarOn(v=>!v)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
                </button>
                <button className="cb danger" title="Завершить" onClick={handleEnd}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </button>
              </div>
            </div>

            {sidebarOn && (
              <aside className="ls">
                <div className="lt">
                  <button className={`ltb ${tab==="chat"?"active":""}`} onClick={()=>setTab("chat")}>Чат</button>
                  <button className={`ltb ${tab==="materials"?"active":""}`} onClick={()=>setTab("materials")}>Материалы</button>
                  <button className={`ltb ${tab==="notes"?"active":""}`} onClick={()=>setTab("notes")}>Заметки</button>
                </div>

                {tab==="chat"&&(
                  <div className="lc">
                    <div className="cms">
                      {messages.map(m=>{const isMe=m.sender_id===userId;return(
                        <div key={m.id} className={`cm ${isMe?"me":""}`}>
                          <div className="ma">{isMe?myInitials:otherInitials}</div>
                          <div className="mb"><div className="au">{isMe?"Вы":teacherName}</div><div className="tx">{m.message}</div></div>
                        </div>
                      )})}
                      <div ref={msgsEndRef}/>
                    </div>
                    <div className="ci">
                      <input type="text" value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Написать сообщение..." autoComplete="off"/>
                      <button className="sb" onClick={sendMsg}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                      </button>
                    </div>
                  </div>
                )}

                {tab==="materials"&&(
                  <div className="lc">
                    <div className="mats-list">
                      {materials.length===0&&!isTeacher&&<div style={{color:"var(--muted)",textAlign:"center",padding:"40px 0",fontSize:13}}>Материалы появятся здесь</div>}
                      {materials.map(m=>(
                        <div key={m.id} style={{background:"var(--bg)",borderRadius:12,padding:14}}>
                          <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{m.title}</div>
                          {m.content&&<div style={{fontSize:13,color:"var(--muted)",whiteSpace:"pre-wrap",marginBottom:4}}>{m.content}</div>}
                          {m.file_url&&<a href={m.file_url} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:"var(--red)",fontWeight:600,textDecoration:"underline"}}>Открыть ссылку</a>}
                        </div>
                      ))}
                    </div>
                    {isTeacher&&(
                      <div className="ci" style={{flexDirection:"column",gap:8,alignItems:"stretch"}}>
                        <input type="text" value={matTitle} onChange={e=>setMatTitle(e.target.value)} placeholder="Название..." style={{borderRadius:12}}/>
                        <input type="text" value={matContent} onChange={e=>setMatContent(e.target.value)} placeholder="Описание..." style={{borderRadius:12}}/>
                        <input type="url" value={matLink} onChange={e=>setMatLink(e.target.value)} placeholder="Ссылка (необязательно)..." style={{borderRadius:12}}/>
                        <button onClick={addMat} className="sb" style={{width:"100%",borderRadius:999,height:"auto",padding:"10px 0",fontSize:13,fontWeight:600}}>Добавить</button>
                      </div>
                    )}
                  </div>
                )}

                {tab==="notes"&&(
                  <div className="notes-area">
                    <textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={saveNotes} placeholder="Ваши заметки..."/>
                    <div className="ns"><button onClick={saveNotes}>Сохранить</button></div>
                  </div>
                )}
              </aside>
            )}
          </div>

          {/* Bottom bar */}
          <div className="lesson-bottom">
            <div className="bb-card">
              <div className="bb-icon lime">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <div>
                <div className="title">Домашнее задание</div>
                <div className="sub">Будет назначено после урока</div>
              </div>
            </div>
            <div className="bb-card" onClick={()=>{setTab("materials");setSidebarOn(true)}}>
              <div className="bb-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div>
                <div className="title">Материалы урока</div>
                <div className="sub">{materials.length} файл(ов)</div>
              </div>
            </div>
            <div className="bb-card dark">
              <div className="bb-icon red">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <div className="title">Следующий урок</div>
                <div className="sub">{nextLessonAt ? new Date(nextLessonAt).toLocaleDateString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "Нет запланированных"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
