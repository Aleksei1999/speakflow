"use client"

/**
 * LiveKit Stage + bottom-bar controls. Используется внутри `lesson-room-client.tsx`
 * как замена Jitsi iframe + .vc кнопок, когда NEXT_PUBLIC_VIDEO_PROVIDER=livekit.
 *
 * Сохраняем визуальный язык .vm/.vc — те же CSS-классы (`vm`, `vc`, `cb`,
 * `live-badge`, `quality-badge`), чтобы внешний layout (header, stats,
 * sidebar) остался без изменений.
 *
 * Recording-pipeline (useLessonRecorder) и two-tab guard живут в parent —
 * recorder работает через свой getUserMedia и не зависит от LiveKit.
 */

import { useEffect, useRef, useState } from "react"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useRoomContext,
  useParticipants,
  useConnectionQualityIndicator,
  VideoTrack,
  ParticipantContext,
} from "@livekit/components-react"
import { ConnectionQuality, Track } from "livekit-client"

interface Props {
  lessonId: string
  // Колбэки в parent — sidebar, fullscreen, end не управляются LiveKit'ом.
  sidebarOn: boolean
  onToggleSidebar: () => void
  onFullscreen?: () => void
  fullscreenSupported: boolean
  onEnd: () => void
  // Сообщаем parent'у о связи (для quality-badge — единая семантика с Jitsi).
  onQuality?: (q: "good" | "fair" | "poor" | "lost" | "unknown") => void
  // hangup извне (auto-hangup по closeAtMs). Parent инкрементит счётчик.
  hangupSignal?: number
}

export function LiveKitLessonStage({
  lessonId,
  sidebarOn,
  onToggleSidebar,
  onFullscreen,
  fullscreenSupported,
  onEnd,
  onQuality,
  hangupSignal,
}: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disconnectReason, setDisconnectReason] = useState<string | null>(null)
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
    return () => {
      cancelled = true
    }
  }, [lessonId])

  if (error) {
    return (
      <div className="vm" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#fff", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Не удалось подключиться</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>{error}</div>
      </div>
    )
  }

  if (!token || !serverUrl) {
    return (
      <div className="vm" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.7)", fontSize: 14 }}>
        Подключаемся к комнате…
      </div>
    )
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={true}
      audio={true}
      onConnected={() => {
        setDisconnectReason(null)
        onQuality?.("good")
      }}
      onDisconnected={(reason) => {
        setDisconnectReason(String(reason ?? "unknown"))
        onQuality?.("lost")
      }}
      onError={(e) => {
        setError(e?.message ?? "LiveKit error")
      }}
      data-lk-theme="default"
    >
      <StageInner
        sidebarOn={sidebarOn}
        onToggleSidebar={onToggleSidebar}
        onFullscreen={onFullscreen}
        fullscreenSupported={fullscreenSupported}
        onEnd={onEnd}
        onQuality={onQuality}
        hangupSignal={hangupSignal}
        disconnectReason={disconnectReason}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

interface StageInnerProps {
  sidebarOn: boolean
  onToggleSidebar: () => void
  onFullscreen?: () => void
  fullscreenSupported: boolean
  onEnd: () => void
  onQuality?: (q: "good" | "fair" | "poor" | "lost" | "unknown") => void
  hangupSignal?: number
  disconnectReason: string | null
}

function StageInner({
  sidebarOn,
  onToggleSidebar,
  onFullscreen,
  fullscreenSupported,
  onEnd,
  onQuality,
  hangupSignal,
  disconnectReason,
}: StageInnerProps) {
  const room = useRoomContext()

  // Auto-hangup сигнал из parent — отключаемся при достижении closeAtMs.
  useEffect(() => {
    if (!hangupSignal) return
    try {
      room?.disconnect()
    } catch {
      /* noop */
    }
  }, [hangupSignal, room])

  // Маппим LiveKit ConnectionQuality → наши категории и пробрасываем в parent
  // для рендера .quality-badge той же семантикой что Jitsi.
  // Явно передаём localParticipant — без него hook ищет ParticipantContext
  // и валит компонент с 'No participant provided'.
  const { localParticipant } = useLocalParticipant()
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant })
  useEffect(() => {
    if (!onQuality) return
    if (quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good) onQuality("good")
    else if (quality === ConnectionQuality.Poor) onQuality("poor")
    else if (quality === ConnectionQuality.Lost) onQuality("lost")
    else onQuality("unknown")
  }, [quality, onQuality])

  return (
    <>
      {disconnectReason && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            background: "rgba(182,63,55,.95)",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          Связь разорвана. <button onClick={() => location.reload()} style={{ background: "#fff", color: "var(--red)", border: 0, padding: "4px 10px", borderRadius: 999, fontWeight: 700, cursor: "pointer" }}>Переподключиться</button>
        </div>
      )}
      <Stage />
      <LiveKitControls
        sidebarOn={sidebarOn}
        onToggleSidebar={onToggleSidebar}
        onFullscreen={onFullscreen}
        fullscreenSupported={fullscreenSupported}
        onEnd={onEnd}
      />
    </>
  )
}

function Stage() {
  const participants = useParticipants()
  const screenShares = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false }
  )
  const cameras = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  )

  // Dedup по identity (защита от двух вкладок одного user'а).
  const cameraByIdentity = new Map<string, typeof cameras[number]>()
  for (const tr of cameras) {
    const id = tr.participant?.identity
    if (id && !cameraByIdentity.has(id)) cameraByIdentity.set(id, tr)
  }
  const cameraTiles = participants
    .map((p) => cameraByIdentity.get(p.identity))
    .filter(Boolean) as typeof cameras

  // Presentation mode — кто-то шарит экран. Filmstrip камер + основной screen.
  if (screenShares.length > 0) {
    return (
      <div className="lk-stage-presentation">
        <div className="lk-filmstrip">
          {cameraTiles.map((tr) => (
            <Tile key={`${tr.participant?.identity}-cam`} tr={tr} />
          ))}
        </div>
        <div className="lk-screen" data-screens={Math.min(4, screenShares.length)}>
          {screenShares.map((tr) => (
            <ScreenTile key={`${tr.participant?.identity}-screen`} tr={tr} />
          ))}
        </div>
      </div>
    )
  }

  // Обычная tile-сетка. До 6 участников.
  const count = Math.min(6, Math.max(1, cameraTiles.length))
  return (
    <div className="lk-stage-grid" data-count={count}>
      {cameraTiles.map((tr) => (
        <Tile key={`${tr.participant?.identity}-cam`} tr={tr} />
      ))}
    </div>
  )
}

function Tile({ tr }: { tr: ReturnType<typeof useTracks>[number] }) {
  const p = tr.participant
  const name = p?.name || p?.identity || "Гость"
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const hasVideo = !!tr.publication?.track && !tr.publication.isMuted
  const participant = tr.participant
  const body = (
    <div className="lk-tile">
      {hasVideo && tr.publication && participant ? (
        <VideoTrack trackRef={tr as Parameters<typeof VideoTrack>[0]["trackRef"]} />
      ) : (
        <div className="lk-ph">{initials}</div>
      )}
      <span className="lk-name">{name}</span>
    </div>
  )
  if (!participant) return body
  return <ParticipantContext.Provider value={participant}>{body}</ParticipantContext.Provider>
}

function ScreenTile({ tr }: { tr: ReturnType<typeof useTracks>[number] }) {
  const p = tr.participant
  const name = p?.name || p?.identity || "Гость"
  const ref = useRef<HTMLDivElement>(null)
  const [isFs, setIsFs] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      ref.current?.requestFullscreen().catch(() => {})
    }
  }

  const participant = tr.participant
  const body = (
    <div ref={ref} className={`lk-tile lk-screen-tile ${isFs ? "lk-fs" : ""}`} onClick={toggle}>
      <VideoTrack trackRef={tr as Parameters<typeof VideoTrack>[0]["trackRef"]} />
      <span className="lk-name">{name} · экран</span>
      <span className="lk-fs-hint">{isFs ? "ESC — выйти" : "Клик — на весь экран"}</span>
    </div>
  )
  if (!participant) return body
  return <ParticipantContext.Provider value={participant}>{body}</ParticipantContext.Provider>
}

interface ControlsProps {
  sidebarOn: boolean
  onToggleSidebar: () => void
  onFullscreen?: () => void
  fullscreenSupported: boolean
  onEnd: () => void
}

function LiveKitControls({
  sidebarOn,
  onToggleSidebar,
  onFullscreen,
  fullscreenSupported,
  onEnd,
}: ControlsProps) {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } =
    useLocalParticipant()

  return (
    <div className="vc">
      <button
        className={`cb ${isMicrophoneEnabled ? "active" : ""}`}
        title="Микрофон"
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <path d="M12 19v3" />
        </svg>
      </button>
      <button
        className={`cb ${isCameraEnabled ? "active" : ""}`}
        title="Камера"
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m22 8-6 4 6 4V8Z" />
          <rect width="14" height="12" x="2" y="6" rx="2" />
        </svg>
      </button>
      <button
        className={`cb ${isScreenShareEnabled ? "active" : ""}`}
        title="Демонстрация"
        onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      </button>
      <button
        className={`cb ${sidebarOn ? "active" : ""}`}
        title="Показать/скрыть чат"
        onClick={onToggleSidebar}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18" />
        </svg>
      </button>
      {fullscreenSupported && onFullscreen && (
        <button className="cb" title="Полноэкранный режим" onClick={onFullscreen}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      )}
      <button className="cb danger" title="Завершить" onClick={onEnd}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </button>
    </div>
  )
}
