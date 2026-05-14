"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useLessonRecorder } from "@/components/lesson/use-lesson-recorder"
import { useModalA11y } from "@/hooks/use-modal-a11y"
import { useLessonChat } from "@/hooks/use-lesson-chat"
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog"

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
  studentId?: string
}

interface Material { id: string; title: string; content: string; file_url: string | null; created_at: string }

declare global { interface Window { JitsiMeetExternalAPI: any } }

const CSS = `
:root{--red:#E63946;--lime:#D8F26A;--black:#0A0A0A;--bg:#F5F5F3;--surface:#FFFFFF;--surface-2:#FAFAF7;--border:#EEEEEA;--muted:#8A8A86;--text:#0A0A0A}
.lr{font-family:'Inter',sans-serif;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;color:var(--text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;margin:-24px -28px;height:calc(100vh - 0px);max-width:100vw;box-sizing:border-box}
.lr *{box-sizing:border-box}.lr a{color:inherit;text-decoration:none}.lr button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.lr .lh{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:14px 24px;background:var(--black);color:#fff;flex-shrink:0;padding-top:max(14px,env(safe-area-inset-top));padding-left:max(24px,env(safe-area-inset-left));padding-right:max(24px,env(safe-area-inset-right))}
.lr .lh-side{display:flex;align-items:center}.lr .lh-right{justify-content:flex-end}
.lr .lh-center{display:flex;align-items:center;justify-content:center}
.lr .lh-center .title{color:#A0A09A;font-size:14px}.lr .lh-center .title strong{color:#fff;font-weight:600;margin-left:4px}
.lr .tmr{background:var(--lime);color:var(--black);padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
.lr .tmr .dot{width:7px;height:7px;background:var(--black);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.lr .btn-exit{border-radius:999px;padding:9px 18px;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);transition:transform .1s ease}
.lr .btn-exit:hover{background:rgba(255,255,255,0.18)}.lr .btn-exit:active{transform:scale(0.97)}
.lr .lm{flex:1;display:flex;flex-direction:column;gap:14px;padding:16px;overflow:hidden}
.lr .lesson-stats{display:grid;grid-template-columns:repeat(3,1fr) 1.3fr;gap:12px;flex-shrink:0}
.lr .stat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.lr .stat .stat-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.lr .stat .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.lr .stat .value{font-size:28px;font-weight:800;margin-top:6px;letter-spacing:-0.5px}
.lr .stat .value small{font-size:14px;color:var(--muted);font-weight:500;margin-left:2px}
.lr .stat-dark .value{font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lr .stat-dark{background:var(--black);color:#fff;border-color:var(--black)}.lr .stat-dark .label{color:#A0A09A}.lr .stat-dark .value small{color:#A0A09A}
.lr .stat-lime{background:var(--lime);border-color:var(--lime)}.lr .stat-lime .label{opacity:.7}.lr .stat-lime .value small{opacity:.7}
.lr .stat-teacher{display:flex;align-items:center;gap:12px;padding:12px 14px}
.lr .av{width:44px;height:44px;background:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
.lr .stat-teacher .info{flex:1;min-width:0}.lr .stat-teacher .name{font-weight:700;font-size:14px}.lr .stat-teacher .sub{font-size:11px;color:var(--muted)}
.lr .rating{background:var(--lime);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}
.lr .lb{flex:1;display:grid;grid-template-columns:1fr 400px;gap:16px;min-height:0;transition:grid-template-columns .2s ease}
.lr .lb.no-sidebar{grid-template-columns:1fr}
.lr .stage{display:flex;flex-direction:column;gap:12px;min-height:0;min-width:0}
.lr .va{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:14px;overflow:hidden;min-height:0}
.lr .vm{position:relative;flex:1;background:#1a1a1a;border-radius:12px;overflow:hidden;min-height:0}
.lr .vm .jitsi-mount{position:absolute;inset:0}
.lr .vm .jitsi-mount > div{width:100%;height:100%}
.lr .vm .jitsi-mount iframe{width:100%;height:100%;border:0;display:block}
.lr .live-badge{position:absolute;top:16px;left:16px;background:var(--red);color:#fff;padding:6px 12px;border-radius:999px;font-size:10px;letter-spacing:1.5px;font-weight:800;display:flex;align-items:center;gap:6px;z-index:10;pointer-events:none}
.lr .live-badge .blink{width:6px;height:6px;background:#fff;border-radius:50%;animation:blink 1.5s infinite}
@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:.3}}
.lr .quality-badge{position:absolute;top:16px;right:16px;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);color:#fff;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;z-index:10;pointer-events:none;display:inline-flex;align-items:center;gap:6px}
.lr .quality-badge .bar{display:inline-flex;align-items:flex-end;gap:2px;height:12px}
.lr .quality-badge .bar i{width:3px;background:#fff;border-radius:1px;opacity:.35}
.lr .quality-badge .bar i:nth-child(1){height:4px}
.lr .quality-badge .bar i:nth-child(2){height:8px}
.lr .quality-badge .bar i:nth-child(3){height:12px}
.lr .quality-badge.good .bar i{opacity:1}
.lr .quality-badge.fair .bar i:nth-child(1),.lr .quality-badge.fair .bar i:nth-child(2){opacity:1}
.lr .quality-badge.poor{background:rgba(230,57,70,.85)}
.lr .quality-badge.poor .bar i:nth-child(1){opacity:1}
.lr .quality-badge.lost{background:rgba(230,57,70,.95)}
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
.lr .rec-toast{position:fixed;top:80px;left:50%;transform:translateX(-50%);background:var(--black);color:#fff;border-radius:999px;padding:12px 22px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:10px;box-shadow:0 8px 28px rgba(0,0,0,.25);z-index:200;animation:rec-toast-in .35s ease both}
.lr .rec-toast .rec-dot{width:8px;height:8px;background:var(--red);border-radius:50%;animation:pulse 1.4s infinite}
@keyframes rec-toast-in{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}

/* Recording status pill в левом слоте шапки. */
.lr .rec-pill{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;color:#fff;letter-spacing:.2px;line-height:1;max-width:100%}
.lr .rec-pill .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.lr .rec-pill.rec .dot{background:var(--red);animation:pulse 1.4s infinite}
.lr .rec-pill.paused .dot{background:#A0A09A}
.lr .rec-pill.start .dot{background:var(--lime);animation:pulse 1.4s infinite}
.lr .rec-pill.off .dot{background:#666}
.lr .rec-pill.err{background:rgba(230,57,70,.18);border-color:rgba(230,57,70,.5)}
.lr .rec-pill.err .dot{background:var(--red)}
.lr .rec-pill .stop{margin-left:2px;background:transparent;color:rgba(255,255,255,.65);border:0;font-size:14px;padding:0 2px;cursor:pointer;line-height:1}
.lr .rec-pill .stop:hover{color:#fff}

/* Duplicate-tab блокировка */
.lr .dup-tab{position:fixed;inset:0;background:rgba(10,10,10,.85);backdrop-filter:blur(4px);z-index:300;display:flex;align-items:center;justify-content:center;padding:24px}
.lr .dup-tab .box{background:var(--surface);border-radius:20px;padding:32px;max-width:420px;text-align:center;display:flex;flex-direction:column;gap:14px}
.lr .dup-tab h3{font-size:18px;font-weight:800;letter-spacing:-.3px}
.lr .dup-tab p{font-size:14px;color:var(--muted);line-height:1.5}
.lr .dup-tab .actions{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.lr .dup-tab .actions .btn{background:var(--black);color:#fff;padding:11px;border-radius:999px;font-size:13px;font-weight:600;border:0;cursor:pointer}
.lr .dup-tab .actions .btn:hover{background:var(--red)}
.lr .dup-tab .actions .btn.sec{background:var(--bg);color:var(--text)}

/* Slow network hint — жёлтый баннер с крестиком */
.lr .net-hint{display:flex;align-items:center;gap:10px;background:#FFFBEB;color:#78350F;border-bottom:1px solid #FDE68A;padding:10px 24px;font-size:13px;font-weight:500;flex-shrink:0}
.lr .net-hint .icon{flex-shrink:0;font-size:16px}
.lr .net-hint .msg{flex:1}
.lr .net-hint .close{background:transparent;color:#78350F;border:0;cursor:pointer;font-size:18px;padding:0 4px;line-height:1;opacity:.7}
.lr .net-hint .close:hover{opacity:1}

/* Persistent error banner под header'ом */
.lr .rec-error{display:flex;align-items:center;gap:10px;background:#FEF2F2;color:#7F1D1D;border-bottom:1px solid #FECACA;padding:10px 24px;font-size:13px;font-weight:500;flex-shrink:0}
.lr .rec-error .icon{flex-shrink:0;font-size:16px}
.lr .rec-error .msg{flex:1;min-width:0}
.lr .rec-error .close{background:transparent;color:#7F1D1D;border:0;cursor:pointer;font-size:18px;padding:0 4px;line-height:1;opacity:.7}
.lr .rec-error .close:hover{opacity:1}
@media(max-width:1000px){.lr .lb{grid-template-columns:1fr;grid-template-rows:1fr auto}.lr .ls{height:320px;order:2}.lr .stage{order:1}.lr .lesson-bottom{grid-template-columns:1fr}}
@media(max-width:900px){.lr .lesson-stats{grid-template-columns:1fr 1fr}}
@media(max-width:640px){
  /* Сбрасываем негативные margin'ы — иначе ширина > viewport. */
  .lr{margin:0;width:100%;max-width:100%}
  .lr .lh{padding:max(12px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-left)) 12px max(14px,env(safe-area-inset-right));grid-template-columns:auto 1fr;gap:10px}
  .lr .lh-center{display:none}
  .lr .lh-left{display:flex;align-items:center}
  /* Компактный pill: только dot. */
  .lr .rec-pill{padding:6px 9px}
  .lr .rec-pill > span:not(.dot){display:none}
  .lr .rec-pill .stop{display:none}
  .lr .lm{padding:10px;gap:10px}
  .lr .cb{width:44px;height:44px}
  .lr .cb svg{width:18px;height:18px}
  /* toast вниз — иначе перекрывает «Выйти» */
  .lr .rec-toast{top:auto;bottom:calc(24px + env(safe-area-inset-bottom));font-size:12px;padding:10px 16px}
}
`

export function LessonRoomClient({
  lessonId, scheduledAt, durationMinutes, userId, userName, teacherName,
  jitsiDomain, jitsiToken, jitsiRoom, isTeacher = false, lessonNumber = 1, studentLevel = "—",
  teacherRating = 0, nextLessonAt = null, studentId = "",
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"chat"|"materials"|"notes">("chat")
  const [newMsg, setNewMsg] = useState("")
  const [notesList, setNotesList] = useState<{id:string;content:string;created_at:string}[]>([])
  const [noteInput, setNoteInput] = useState("")
  const [materials, setMaterials] = useState<Material[]>([])
  const [matTitle, setMatTitle] = useState("")
  const [matContent, setMatContent] = useState("")
  const [matLink, setMatLink] = useState("")
  const [uploading, setUploading] = useState(false)
  const [homework, setHomework] = useState<any[]>([])
  const [hwTitle, setHwTitle] = useState("")
  const [hwDesc, setHwDesc] = useState("")
  const [hwOpen, setHwOpen] = useState(false)
  const hwModalRef = useModalA11y(hwOpen, () => setHwOpen(false))
  // Брендированный confirm-диалог вместо нативного window.confirm().
  const { confirm, dialogProps: confirmDialogProps } = useConfirm()
  const [remaining, setRemaining] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [screenOn, setScreenOn] = useState(false)
  const [sidebarOn, setSidebarOn] = useState(true)
  const msgsEndRef = useRef<HTMLDivElement>(null)
  const jitsiRef = useRef<HTMLDivElement>(null)
  const jitsiApi = useRef<any>(null)
  // Stateful копия для useLessonRecorder — ref не триггерит его useEffect.
  const [jitsiApiState, setJitsiApiState] = useState<any>(null)
  const [recordingToast, setRecordingToast] = useState(false)
  // Пользовательский тогл записи. Повторный запуск не поддержан.
  const [recorderEnabled, setRecorderEnabled] = useState(true)
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [duplicateTab, setDuplicateTab] = useState(false)
  const [recorderRetryToken, setRecorderRetryToken] = useState(0)
  type ConnQuality = "good" | "fair" | "poor" | "lost" | "unknown"
  const [connQuality, setConnQuality] = useState<ConnQuality>("unknown")
  const [slowNetworkHint, setSlowNetworkHint] = useState(false)

  const myInitials = userName.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)
  const otherInitials = teacherName.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)

  // Timer — countdown
  useEffect(() => {
    const end = new Date(scheduledAt).getTime() + durationMinutes * 60 * 1000
    const iv = setInterval(() => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000))
      setRemaining(left)
    }, 1000)
    setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)))
    return () => clearInterval(iv)
  }, [scheduledAt, durationMinutes])
  const mm = String(Math.floor(remaining/60)).padStart(2,"0")
  const ss = String(remaining%60).padStart(2,"0")

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
      const api = new window.JitsiMeetExternalAPI(jitsiDomain, {
        roomName: jitsiRoom, parentNode: jitsiRef.current, width:"100%", height:"100%",
        ...(jitsiToken?{jwt:jitsiToken}:{}),
        configOverwrite:{
          prejoinPageEnabled:false,
          disableDeepLinking:true,
          hideConferenceSubject:true,
          disableInviteFunctions:true,
          // Пустой toolbar — управляем через executeCommand из своего bottom bar.
          toolbarButtons:[],
          notifications:[],
          disableThirdPartyRequests:true,
          hideConferenceTimer:true,
          hideParticipantsStats:true,
          connectionIndicators:{autoHide:true,disabled:true},
          // Tile view: одинаковые тайлы для всех включая себя.
          startWithTileView:true,
          disableTileView:false,
        },
        interfaceConfigOverwrite:{
          SHOW_JITSI_WATERMARK:false,
          SHOW_WATERMARK_FOR_GUESTS:false,
          TOOLBAR_ALWAYS_VISIBLE:false,
          MOBILE_APP_PROMO:false,
          HIDE_INVITE_MORE_HEADER:true,
          DISABLE_FOCUS_INDICATOR:true,
          VERTICAL_FILMSTRIP:false,
          TILE_VIEW_MAX_COLUMNS:2,
          TOOLBAR_BUTTONS:[],
          CONNECTION_INDICATOR_DISABLED:true,
          VIDEO_QUALITY_LABEL_DISABLED:true,
          DISABLE_DOMINANT_SPEAKER_INDICATOR:true,
          DISABLE_VIDEO_BACKGROUND:true,
          RECENT_LIST_ENABLED:false,
        },
        userInfo:{displayName:userName},
      })
      jitsiApi.current = api
      setJitsiApiState(api)

      // a11y: title для iframe — Jitsi сам создаёт его без названия.
      const setIframeTitle = () => {
        const iframe = jitsiRef.current?.querySelector("iframe")
        if (iframe && !iframe.hasAttribute("title")) {
          iframe.setAttribute("title", "Видеоконференция урока")
        }
      }
      setTimeout(setIframeTitle, 100)
      setTimeout(setIframeTitle, 800)

      // Форсим tile view: startWithTileView иногда игнорируется,
      // если кто-то уже в комнате.
      const forceTile = () => {
        try { jitsiApi.current?.executeCommand("setTileView", true) } catch {}
        try { jitsiApi.current?.executeCommand("pinParticipant", null) } catch {}
      }
      jitsiApi.current?.addListener("videoConferenceJoined", () => {
        setTimeout(forceTile, 200)
        setConnQuality("good")
      })
      jitsiApi.current?.addListener("participantConnectionStatusChanged", (e: any) => {
        const st = String(e?.connectionStatus ?? "").toLowerCase()
        if (st === "active") setConnQuality((q) => (q === "lost" ? "fair" : "good"))
        else if (st === "interrupted") setConnQuality("poor")
        else if (st === "inactive") setConnQuality("fair")
      })
      jitsiApi.current?.addListener("connectionFailed", () => setConnQuality("lost"))
      jitsiApi.current?.addListener("connectionEstablished", () => setConnQuality("good"))
      jitsiApi.current?.addListener("participantJoined", () => {
        setTimeout(forceTile, 100)
      })
      jitsiApi.current?.addListener("tileViewChanged", (e: any) => {
        if (e && e.enabled === false) {
          setTimeout(forceTile, 50)
        }
      })
      jitsiApi.current?.addListener("dominantSpeakerChanged", () => {
        setTimeout(forceTile, 100)
      })
      // safety на случай если listeners не сработали
      setTimeout(forceTile, 1500)
    }
    init().catch(()=>{})
    return()=>{disposed=true;try{jitsiApi.current?.dispose()}catch{};jitsiApi.current=null;setJitsiApiState(null)}
  }, [jitsiDomain,jitsiRoom,jitsiToken,userName])

  // Pre-call hint про слабую сеть. navigator.connection — Chromium-only.
  useEffect(() => {
    if (typeof navigator === "undefined") return
    const conn = (navigator as any).connection
    if (!conn) return
    const t = conn.effectiveType
    if (t === "slow-2g" || t === "2g" || t === "3g") setSlowNetworkHint(true)
  }, [])

  // Two-tab guard через localStorage heartbeat: claim-and-watch.
  // Иначе чат и MediaRecorder ломаются от двух конференций на один user_id.
  useEffect(() => {
    if (typeof window === "undefined") return
    const KEY = `lesson:${lessonId}:tab`
    const STALE_MS = 12_000
    const HEARTBEAT_MS = 5_000
    const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

    function read(): { tabId: string; ts: number } | null {
      try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return null
        return JSON.parse(raw)
      } catch {
        return null
      }
    }
    function write() {
      try { localStorage.setItem(KEY, JSON.stringify({ tabId, ts: Date.now() })) } catch {}
    }

    const existing = read()
    if (existing && existing.tabId !== tabId && Date.now() - existing.ts < STALE_MS) {
      setDuplicateTab(true)
      return
    }
    write()
    const iv = setInterval(write, HEARTBEAT_MS)

    function onStorage(e: StorageEvent) {
      if (e.key !== KEY) return
      const v = read()
      if (v && v.tabId !== tabId && Date.now() - v.ts < STALE_MS) {
        setDuplicateTab(true)
      }
    }
    window.addEventListener("storage", onStorage)

    return () => {
      clearInterval(iv)
      window.removeEventListener("storage", onStorage)
      // Освобождаем slot только если он всё ещё наш.
      const cur = read()
      if (cur?.tabId === tabId) {
        try { localStorage.removeItem(KEY) } catch {}
      }
    }
  }, [lessonId])

  // Авто-запись урока. Hook сам разбирается: teacher → /init,
  // student → polls /active. При duplicateTab выключаем — иначе
  // два браузера конкурируют за один chunk-NNNNN.
  const recorder = useLessonRecorder({
    lessonId,
    isTeacher,
    jitsiApi: jitsiApiState,
    enabled: recorderEnabled && !duplicateTab,
    retryToken: recorderRetryToken,
    onStarted: () => {
      setRecordingToast(true)
      setTimeout(() => setRecordingToast(false), 3500)
    },
  })

  // Recorder в error (mic denied) + юзер разрешил mic в Jitsi → retry.
  useEffect(() => {
    if (!jitsiApiState) return
    const onMute = (data: any) => {
      if (data?.muted === false && recorder.status === "error") {
        setRecorderRetryToken((n) => n + 1)
      }
    }
    try { jitsiApiState.addListener?.("audioMuteStatusChanged", onMute) } catch {}
    return () => {
      try { jitsiApiState.removeListener?.("audioMuteStatusChanged", onMute) } catch {}
    }
  }, [jitsiApiState, recorder.status])

  // Чат: Supabase Realtime postgres_changes. См. use-lesson-chat.ts.
  const { messages, sendMessage } = useLessonChat({ lessonId, userId, optimistic: true })
  useEffect(()=>{msgsEndRef.current?.scrollIntoView({behavior:"smooth"})},[messages])

  // Notes — load as list
  const notesEndRef = useRef<HTMLDivElement>(null)
  const loadNotes = useCallback(async()=>{
    try{const r=await fetch(`/api/lesson/notes?lessonId=${lessonId}&userId=${userId}`);if(r.ok)setNotesList(await r.json())}catch{}
  },[lessonId,userId])
  useEffect(()=>{loadNotes()},[loadNotes])
  useEffect(()=>{notesEndRef.current?.scrollIntoView({behavior:"smooth"})},[notesList])

  // Materials
  const loadMats = useCallback(async()=>{try{const r=await fetch(`/api/lesson/materials?lessonId=${lessonId}`);if(r.ok)setMaterials(await r.json())}catch{}},[lessonId])
  useEffect(()=>{loadMats()},[loadMats])

  const sendMsg = useCallback(async()=>{
    if(!newMsg.trim())return;const t=newMsg.trim();setNewMsg("")
    await sendMessage(t)
  },[newMsg,sendMessage])

  const sendNote = useCallback(async()=>{
    if(!noteInput.trim())return;const t=noteInput.trim();setNoteInput("")
    setNotesList(p=>[...p,{id:Date.now().toString(),content:t,created_at:new Date().toISOString()}])
    await fetch("/api/lesson/notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lessonId,userId,content:t})})
  },[noteInput,lessonId,userId])

  const addMat = useCallback(async()=>{
    if(!matTitle.trim())return
    await fetch("/api/lesson/materials",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lessonId,userId,title:matTitle.trim(),content:matContent.trim(),fileUrl:matLink.trim()||null})})
    setMatTitle("");setMatContent("");setMatLink("");loadMats()
  },[matTitle,matContent,matLink,lessonId,userId,loadMats])

  // Homework
  const loadHw = useCallback(async()=>{
    try{const r=await fetch(`/api/lesson/homework?lessonId=${lessonId}&studentId=${studentId||userId}`);if(r.ok)setHomework(await r.json())}catch{}
  },[lessonId,studentId,userId])
  useEffect(()=>{loadHw()},[loadHw])

  const addHw = useCallback(async()=>{
    if(!hwTitle.trim())return
    await fetch("/api/lesson/homework",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({lessonId,teacherId:userId,studentId,title:hwTitle.trim(),description:hwDesc.trim()})})
    setHwTitle("");setHwDesc("");setHwOpen(false);loadHw()
  },[hwTitle,hwDesc,lessonId,userId,studentId,loadHw])

  // Direct-to-Storage upload в обход Vercel 4.5MB cap'а; затем
  // регистрируем строку через /api/lesson/materials.
  const uploadFile = useCallback(async(file:File)=>{
    setUploading(true)
    try {
      if (file.size > 50 * 1024 * 1024) {
        alert(`Файл «${file.name}» больше 50 МБ. Загрузи поменьше.`)
        return
      }

      const supabase = createClient()
      // Storage key — только ASCII; полное имя кладём в title колонку.
      const ext = (file.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "bin"
      const rand = Math.random().toString(36).slice(2, 10)
      const path = `lessons/${lessonId}/${Date.now()}-${rand}.${ext}`

      const up = await supabase.storage
        .from("lesson-files")
        .upload(path, file, { contentType: file.type, upsert: false })
      if (up.error) {
        console.error("[lesson-room] storage upload failed", up.error)
        alert(`Не удалось загрузить файл: ${up.error.message}`)
        return
      }

      const { data: urlData } = supabase.storage.from("lesson-files").getPublicUrl(path)

      // Регистрируем строку в materials — RLS открывает её студенту
      // через lesson.student_id = auth.uid(), файл появится в /student/materials.
      const res = await fetch("/api/lesson/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          userId,
          title: file.name,
          fileUrl: urlData.publicUrl,
          storagePath: path,
          mimeType: file.type || null,
          fileSize: file.size,
          content: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        console.error("[lesson-room] /api/lesson/materials failed", res.status, text)
        alert(`Файл загружен, но карточка не создалась: ${text || res.status}`)
        return
      }
    } catch (e: any) {
      console.error("[lesson-room] uploadFile crashed", e)
      alert(`Ошибка загрузки: ${e?.message ?? "неизвестная"}`)
    } finally {
      setUploading(false)
      loadMats()
    }
  },[lessonId,userId,loadMats])

  const toggleMic=()=>{jitsiApi.current?.executeCommand("toggleAudio");setMicOn(v=>!v)}
  const toggleCam=()=>{jitsiApi.current?.executeCommand("toggleVideo");setCamOn(v=>!v)}
  const toggleScreen=()=>{jitsiApi.current?.executeCommand("toggleShareScreen");setScreenOn(v=>!v)}
  const openSettings=()=>{try{jitsiApi.current?.executeCommand("toggleSettings")}catch{/* noop */}}
  const toggleFullscreen=()=>{
    const el = jitsiRef.current?.parentElement as any
    if (!el) return
    const doc = document as any
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) doc.exitFullscreen()
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen()
        return
      }
      // iOS Safari исторически не поддерживает Fullscreen API для div.
      if (el.requestFullscreen) el.requestFullscreen()
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
      else alert("Полноэкранный режим не поддерживается этим браузером (попробуй на десктопе).")
    } catch {
      /* noop */
    }
  }
  const fullscreenSupported = (() => {
    if (typeof document === "undefined") return true
    const el = document.createElement("div") as any
    return Boolean(el.requestFullscreen || el.webkitRequestFullscreen)
  })()
  const handleEnd = async () => {
    const ok = await confirm({
      title: "Завершить урок?",
      message: "Вы выйдете из видеосвязи и вернётесь на главную.",
      confirmLabel: "Завершить",
      cancelLabel: "Остаться",
      danger: true,
    })
    if (!ok) return
    try { jitsiApi.current?.executeCommand("hangup") } catch { /* noop */ }
    router.push(isTeacher ? "/teacher" : "/student")
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:CSS}} />
      <div className="lr">
        {/* Header */}
        <header className="lh">
          <div className="lh-side lh-left">
            {/* Pill только у преподавателя — это его контрол AI-конспекта. */}
            {isTeacher && recorder.status === "recording" && (
              <span className="rec-pill rec" title="Урок записывается для AI-конспекта">
                <span className="dot" />
                <span>Запись</span>
                <button
                  className="stop"
                  title="Остановить запись"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Остановить AI-запись?",
                      message: "Конспект и квиз для этого урока не будут сгенерированы.",
                      confirmLabel: "Остановить",
                      cancelLabel: "Продолжить запись",
                      danger: true,
                    })
                    if (ok) setRecorderEnabled(false)
                  }}
                >×</button>
              </span>
            )}
            {isTeacher && recorder.status === "paused" && (
              <span className="rec-pill paused" title="Запись приостановлена — микрофон в Jitsi выключен">
                <span className="dot" /><span>Запись на паузе</span>
              </span>
            )}
            {isTeacher && (recorder.status === "starting" || recorder.status === "idle") && recorderEnabled && (
              <span className="rec-pill start" title="Готовим AI-запись урока">
                <span className="dot" /><span>Запускаем запись…</span>
              </span>
            )}
            {isTeacher && recorder.status === "stopped" && (
              <span className="rec-pill off" title="Запись остановлена">
                <span className="dot" /><span>Запись остановлена</span>
              </span>
            )}
            {isTeacher && recorder.status === "error" && (
              <span className="rec-pill err" title={recorder.error ?? "Запись недоступна"}>
                <span className="dot" /><span>Микрофон недоступен</span>
                <button
                  className="stop"
                  title="Попробовать снова"
                  onClick={() => {
                    setErrorDismissed(false)
                    setRecorderRetryToken((n) => n + 1)
                  }}
                >↻</button>
              </span>
            )}
          </div>
          <div className="lh-center">
            <span className="title">Урок с <strong>{teacherName}</strong></span>
          </div>
          <div className="lh-side lh-right"><button className="btn-exit" onClick={handleEnd}>Выйти из урока</button></div>
        </header>

        {slowNetworkHint && (
          <div className="net-hint">
            <span className="icon">📶</span>
            <span className="msg">
              Сеть медленная (мобильный 2G/3G). Возможны лаги — лучше подключиться к Wi-Fi.
            </span>
            <button className="close" onClick={() => setSlowNetworkHint(false)} title="Скрыть">×</button>
          </div>
        )}

        {isTeacher && recorder.status === "error" && recorder.error && !errorDismissed && (
          <div className="rec-error">
            <span className="icon">⚠️</span>
            <span className="msg">
              AI-конспект урока не записывается. {recorder.error}
            </span>
            <button className="close" onClick={() => setErrorDismissed(true)} title="Скрыть">×</button>
          </div>
        )}

        <div className="lm">
          {/* Stats bar */}
          <div className="lesson-stats">
            <div className="stat stat-duration">
              <div className="stat-top">
                <div className="label">Длительность</div>
                <div className="tmr"><span className="dot"/><span>{mm}:{ss}</span></div>
              </div>
              <div className="value">{durationMinutes}<small>мин</small></div>
            </div>
            <div className="stat stat-dark">
              <div className="label">Уровень</div>
              <div className="value">{studentLevel}</div>
            </div>
            <div className="stat stat-lime">
              <div className="label">Урок №</div>
              <div className="value">{lessonNumber}<small>/48</small></div>
            </div>
            <div className="stat stat-teacher">
              <div className="av">{otherInitials}</div>
              <div className="info">
                <div className="name">{teacherName}</div>
                <div className="sub">{isTeacher?"Ученик":"Преподаватель"}</div>
              </div>
              {teacherRating > 0 && <div className="rating">★ {teacherRating.toFixed(1)}</div>}
            </div>
          </div>

          {/* Body */}
          <div className={`lb ${sidebarOn?"":"no-sidebar"}`}>
            <div className="stage">
            <div className="va">
              <div className="vm">
                <div className="jitsi-mount" ref={jitsiRef} />
                <div className="live-badge"><span className="blink"/>LIVE</div>
                {connQuality !== "unknown" && (
                  <div className={`quality-badge ${connQuality}`}>
                    <span className="bar"><i/><i/><i/></span>
                    <span>
                      {connQuality === "good" ? "Связь" :
                       connQuality === "fair" ? "Средне" :
                       connQuality === "poor" ? "Слабо" : "Нет связи"}
                    </span>
                  </div>
                )}
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
                {fullscreenSupported && (
                  <button className="cb" title="Полноэкранный режим" onClick={toggleFullscreen}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                  </button>
                )}
                <button className="cb danger" title="Завершить" onClick={handleEnd}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </button>
              </div>
            </div>

            {/* Bottom bar — only under video column */}
            <div className="lesson-bottom">
              <div className="bb-card" onClick={()=>setHwOpen(!hwOpen)}>
                <div className="bb-icon lime">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div>
                  <div className="title">Домашнее задание</div>
                  <div className="sub">{homework.length > 0 ? `${homework.length} задание(й)` : isTeacher ? "Нажмите чтобы назначить" : "Пока не назначено"}</div>
                </div>
              </div>
              <div className="bb-card" onClick={()=>{setTab("materials");setSidebarOn(true)}}>
                <div className="bb-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div>
                  <div className="title">Материалы урока</div>
                  <div className="sub">{(() => {
                    const n = materials.length;
                    const mod10 = n % 10;
                    const mod100 = n % 100;
                    const word = mod10 === 1 && mod100 !== 11 ? "файл" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "файла" : "файлов";
                    return `${n} ${word}`;
                  })()}</div>
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
                      <button className="sb" onClick={sendMsg} aria-label="Отправить сообщение">
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
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={addMat} className="sb" style={{flex:1,borderRadius:999,height:"auto",padding:"10px 0",fontSize:13,fontWeight:600}}>Добавить</button>
                          <label style={{flex:1,borderRadius:999,height:"auto",padding:"10px 0",fontSize:13,fontWeight:600,background:"var(--bg)",color:"var(--text)",textAlign:"center",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                            {uploading?"Загрузка...":"📎 Файл"}
                            <input type="file" accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.ogg,.jpg,.png,.pptx,.xlsx" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadFile(f);e.target.value=""}} disabled={uploading}/>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tab==="notes"&&(
                  <div className="lc">
                    <div className="cms">
                      {notesList.length===0&&<div style={{color:"var(--muted)",textAlign:"center",padding:"40px 0",fontSize:13}}>Напишите заметку...</div>}
                      {notesList.map(n=>(
                        <div key={n.id} className="cm me">
                          <div className="ma">{myInitials}</div>
                          <div className="mb">
                            <div className="au">Вы</div>
                            <div className="tx">{n.content}</div>
                          </div>
                        </div>
                      ))}
                      <div ref={notesEndRef}/>
                    </div>
                    <div className="ci">
                      <input type="text" value={noteInput} onChange={e=>setNoteInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendNote()} placeholder="Написать заметку..." autoComplete="off"/>
                      <button className="sb" onClick={sendNote} aria-label="Сохранить заметку">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      </div>

      {isTeacher && recordingToast && (
        <div className="rec-toast">
          <span className="rec-dot" />
          <span>Урок записывается для AI-конспекта</span>
        </div>
      )}

      {duplicateTab && (
        <div className="dup-tab">
          <div className="box">
            <h3>Урок уже открыт</h3>
            <p>
              Эта же учётная запись подключена к уроку в другой вкладке.
              Используй её — если открыть две, чат, запись и AI-конспект
              перестанут работать.
            </p>
            <div className="actions">
              <button className="btn" onClick={() => window.close()}>
                Закрыть эту вкладку
              </button>
              <button
                className="btn sec"
                onClick={() => router.push(isTeacher ? "/teacher" : "/student")}
              >
                На главную
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Homework panel */}
      {hwOpen && (
        <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.4)"}} onClick={()=>setHwOpen(false)} role="presentation">
          <div ref={hwModalRef} role="dialog" aria-modal="true" aria-label="Домашнее задание" style={{background:"var(--surface)",borderRadius:20,padding:32,width:"100%",maxWidth:480,maxHeight:"80vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:20,fontWeight:800,marginBottom:20}}>Домашнее задание</h3>
            {homework.length > 0 && (
              <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
                {homework.map((hw:any)=>(
                  <div key={hw.id} style={{background:"var(--bg)",borderRadius:12,padding:14}}>
                    <div style={{fontWeight:700,fontSize:14}}>{hw.title}</div>
                    {hw.description && <div style={{fontSize:13,color:"var(--muted)",marginTop:4,whiteSpace:"pre-wrap"}}>{hw.description}</div>}
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:6}}>
                      Срок: {new Date(hw.due_date).toLocaleDateString("ru-RU",{day:"numeric",month:"long"})} ·
                      <span style={{color:hw.status==="pending"?"var(--red)":"#059669",fontWeight:600,marginLeft:4}}>
                        {({pending:"Ожидает",in_progress:"В работе",submitted:"Сдано",reviewed:"Проверено",overdue:"Просрочено"} as any)[hw.status]??hw.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isTeacher && (
              <div style={{display:"flex",flexDirection:"column",gap:10,borderTop:"1px solid var(--border)",paddingTop:16}}>
                <div style={{fontSize:13,fontWeight:700}}>Назначить задание</div>
                <input type="text" value={hwTitle} onChange={e=>setHwTitle(e.target.value)} placeholder="Название задания..."
                  style={{border:"1px solid var(--border)",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none",fontFamily:"inherit"}} />
                <textarea value={hwDesc} onChange={e=>setHwDesc(e.target.value)} placeholder="Описание задания..."
                  style={{border:"1px solid var(--border)",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none",fontFamily:"inherit",resize:"none",height:80}} />
                <button onClick={addHw} style={{background:"var(--black)",color:"#fff",borderRadius:999,padding:"10px 0",fontSize:13,fontWeight:600,border:"none",cursor:"pointer"}}>
                  Назначить
                </button>
              </div>
            )}
            {!isTeacher && homework.length===0 && (
              <div style={{textAlign:"center",color:"var(--muted)",padding:"20px 0"}}>Преподаватель пока не назначил задание</div>
            )}
            <button onClick={()=>setHwOpen(false)} style={{marginTop:16,width:"100%",background:"var(--bg)",borderRadius:999,padding:"10px 0",fontSize:13,fontWeight:600,border:"none",cursor:"pointer"}}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </>
  )
}
