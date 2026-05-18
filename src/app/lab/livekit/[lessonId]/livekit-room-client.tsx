"use client"

import { useEffect, useRef, useState } from "react"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useRoomContext,
  useParticipants,
  VideoTrack,
} from "@livekit/components-react"
import { Track, ConnectionState } from "livekit-client"
import "@livekit/components-styles"

const CSS = `
:root{--red:#B63F37;--lime:#DDEA88;--black:#0A0A0A;--bg:#F5F5F3;--surface:#FFF;--border:#EEEEEA;--muted:#8A8A86}
.lk-wrap{font-family:'Inter',sans-serif;display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--black);overflow:hidden}
.lk-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:14px 24px;background:var(--black);color:#fff;flex-shrink:0}
.lk-head .title{color:#A0A09A;font-size:14px;text-align:center}
.lk-head .title strong{color:#fff;font-weight:600;margin-left:4px}
.lk-head .badge{background:var(--lime);color:var(--black);padding:6px 14px;border-radius:999px;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:8px;justify-self:start}
.lk-head .badge .dot{width:7px;height:7px;background:var(--black);border-radius:50%;animation:lkp 2s infinite}
@keyframes lkp{0%,100%{opacity:1}50%{opacity:.4}}
.lk-head .exit{justify-self:end;background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);padding:9px 18px;border-radius:999px;font-weight:600;font-size:13px;cursor:pointer;transition:transform .1s}
.lk-head .exit:hover{background:rgba(255,255,255,.18)}.lk-head .exit:active{transform:scale(.97)}
.lk-stage{flex:1;background:#1a1a1a;border-radius:0;overflow:hidden;display:grid;gap:8px;padding:16px;min-height:0}
.lk-stage[data-count="1"]{grid-template-columns:1fr}
.lk-stage[data-count="2"]{grid-template-columns:1fr 1fr}
.lk-stage[data-count="3"],.lk-stage[data-count="4"]{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
.lk-tile{position:relative;background:#0a0a0a;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.lk-tile video{width:100%;height:100%;object-fit:cover}
.lk-tile .name{position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,.6);color:#fff;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;backdrop-filter:blur(8px)}
.lk-tile .ph{width:120px;height:120px;background:#222;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#666;font-size:48px;font-weight:700}
.lk-bar{display:flex;justify-content:center;gap:14px;padding:14px 0;background:var(--bg);flex-shrink:0}
.lk-btn{width:54px;height:54px;background:#fff;border:1px solid var(--border);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,transform .1s;color:var(--black)}
.lk-btn:hover{background:#e8e8e4}.lk-btn:active{transform:scale(.95)}
.lk-btn.active{background:var(--lime);border-color:var(--lime)}
.lk-btn.danger{background:var(--red);color:#fff;border-color:var(--red)}.lk-btn.danger:hover{background:#9b3530;color:#fff}
.lk-btn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.lk-loading,.lk-error{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:12px;padding:24px;text-align:center}
.lk-error{color:var(--red)}
`

export function LiveKitRoomClient({ lessonId }: { lessonId: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disconnectReason, setDisconnectReason] = useState<string | null>(null)
  // Guard от двойной инициализации — React StrictMode / prefetch / hot-reload
  // могут запустить useEffect повторно, и второй setToken вызывает re-mount
  // <LiveKitRoom>, что выглядит как "Client initiated disconnect".
  const initStartedRef = useRef(false)

  useEffect(() => {
    if (initStartedRef.current) return
    initStartedRef.current = true
    let cancelled = false
    async function init() {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      })
      if (cancelled) return
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const j = (await res.json()) as { token: string; url: string }
      setToken(j.token)
      setServerUrl(j.url)
    }
    init().catch((e) => setError(String(e?.message ?? e)))
    return () => { cancelled = true }
  }, [lessonId])

  if (error) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="lk-error">
          <h2>LiveKit error</h2>
          <p>{error}</p>
          <a href="/student/schedule" style={{ color: "var(--red)" }}>← Назад</a>
        </div>
      </>
    )
  }

  if (!token || !serverUrl) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="lk-loading">Подключаемся к комнате…</div>
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {disconnectReason && (
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:99,background:"#B63F37",color:"#fff",padding:"10px 16px",fontSize:13,textAlign:"center"}}>
          Соединение разорвано: {disconnectReason}.{" "}
          <button onClick={() => location.reload()} style={{background:"#fff",color:"#B63F37",border:"none",padding:"4px 12px",borderRadius:6,fontWeight:700,cursor:"pointer",marginLeft:8}}>Переподключиться</button>
        </div>
      )}
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={true}
        audio={true}
        onConnected={() => {
          console.log("[livekit] connected")
          setDisconnectReason(null)
        }}
        onDisconnected={(reason) => {
          console.warn("[livekit] disconnected:", reason)
          setDisconnectReason(String(reason ?? "unknown"))
        }}
        onError={(e) => {
          console.error("[livekit] error:", e)
          setError(e?.message ?? "LiveKit error")
        }}
        data-lk-theme="default"
        style={{ height: "100vh" }}
      >
        <div className="lk-wrap">
          <div className="lk-head">
            <span className="badge"><span className="dot"/>LIVE · LiveKit</span>
            <div className="title">Урок с <strong>пользователем</strong></div>
            <a className="exit" href="/student/schedule">Выйти</a>
          </div>
          <Stage />
          <Controls />
        </div>
        <RoomAudioRenderer />
      </LiveKitRoom>
    </>
  )
}

function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
  const participants = useParticipants()
  const count = Math.min(4, Math.max(1, participants.length))

  return (
    <div className="lk-stage" data-count={count}>
      {tracks.map((tr) => {
        const p = tr.participant
        const name = p?.name || p?.identity || "Гость"
        const initials = name.split(" ").filter(Boolean).map(s => s[0]).join("").slice(0,2).toUpperCase()
        const hasVideo = !!tr.publication?.track && !tr.publication.isMuted
        return (
          <div className="lk-tile" key={`${p?.identity}-${tr.source}`}>
            {hasVideo && tr.publication ? (
              <VideoTrack trackRef={tr as Parameters<typeof VideoTrack>[0]["trackRef"]} />
            ) : (
              <div className="ph">{initials}</div>
            )}
            <span className="name">{name}</span>
          </div>
        )
      })}
    </div>
  )
}

function Controls() {
  const room = useRoomContext()
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } =
    useLocalParticipant()

  return (
    <div className="lk-bar">
      <button
        className={`lk-btn ${isMicrophoneEnabled ? "active" : ""}`}
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        title={isMicrophoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
      <button
        className={`lk-btn ${isCameraEnabled ? "active" : ""}`}
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        title={isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
      >
        <svg viewBox="0 0 24 24">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
      </button>
      <button
        className={`lk-btn ${isScreenShareEnabled ? "active" : ""}`}
        onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
        title={isScreenShareEnabled ? "Остановить демонстрацию" : "Демонстрация экрана"}
      >
        <svg viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </button>
      <button
        className="lk-btn danger"
        onClick={() => room?.disconnect()}
        title="Завершить"
      >
        <svg viewBox="0 0 24 24" style={{ transform: "rotate(135deg)" }}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/>
        </svg>
      </button>
    </div>
  )
}
