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
import * as Sentry from "@sentry/nextjs"
import {
  Chat,
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
  /**
   * Если true — стейдж НЕ рендерит собственный чат-сайдбар. Кнопка «чат»
   * в нижнем баре зовёт `onToggleSidebar` (parent сам решает, что открыть —
   * например, `ChatModal` с историей `chat_messages`). Для лекций (нет
   * teacher↔student пары) оставляем false — тогда работает встроенный
   * LiveKit `<Chat />` (data-channel, ephemeral).
   */
  externalChat?: boolean
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
  /**
   * Колбэк со ссылкой на LiveKit Room после подключения. Используется
   * recorder'ом для (a) переиспользования mic-track вместо второго
   * getUserMedia и (b) подписки на TrackMuted/TrackUnmuted чтобы
   * пауза/resume записи следовала за UI-состоянием.
   * null → room disconnected/unmounted.
   */
  onRoom?: (room: import("livekit-client").Room | null) => void
  onOpenSettings?: () => void
  onOpenNotes?: () => void
  onShareLink?: () => void
  /**
   * Опциональный override endpoint'а для токена. По умолчанию используется
   * `/api/livekit/token` с { lessonId }. Для лекций передаём
   * `/api/livekit/lecture-token` + `{ lectureId }`, стейдж не знает
   * разницы — визуал и контролы остаются те же (`.vc` bar).
   */
  tokenEndpoint?: string
  tokenBody?: Record<string, unknown>
}

/**
 * Правая сайдбар-панель «Чат звонка». Используется ТОЛЬКО когда parent не
 * предоставил внешний чат (externalChat=false, например для лекций). LiveKit
 * `<Chat />` — data-channel, ephemeral: сообщения теряются после disconnect.
 * Для уроков parent (LessonVideoRoom) вместо этого открывает <ChatModal>
 * variant="dock" с историей `chat_messages`.
 */
function LkChatPanel({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const patch = () => {
      const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        ".lk-chat-form-input, input[type='text'], textarea",
      )
      if (input && input.placeholder !== "Введите сообщение") {
        input.placeholder = "Введите сообщение"
      }
      const sendBtn = root.querySelector<HTMLButtonElement>(
        ".lk-chat-form-button, button[type='submit']",
      )
      if (sendBtn && !sendBtn.querySelector("svg[data-lk-send]")) {
        sendBtn.innerHTML = `<svg data-lk-send viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`
        sendBtn.setAttribute("aria-label", "Отправить")
      }
    }
    patch()
    const mo = new MutationObserver(patch)
    mo.observe(root, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])
  return (
    <aside className="lk-chat-side" ref={rootRef}>
      <div className="lk-chat-side-head">
        <span>Чат звонка</span>
        <button
          type="button"
          className="lk-chat-side-close"
          aria-label="Закрыть чат"
          onClick={onClose}
        >
          <svg viewBox="0 0 14 14" width="12" height="12" fill="none" aria-hidden>
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <Chat />
    </aside>
  )
}

export function LiveKitLessonStage({
  lessonId,
  externalChat = false,
  sidebarOn,
  onToggleSidebar,
  onFullscreen,
  fullscreenSupported,
  onEnd,
  onQuality,
  hangupSignal,
  onRoom,
  onOpenSettings,
  onOpenNotes,
  onShareLink,
  tokenEndpoint,
  tokenBody,
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
      const res = await fetch(tokenEndpoint ?? "/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenBody ?? { lessonId }),
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
      // Сбрасываем ref, чтобы повторный mount (Strict Mode dev, HMR / fast refresh,
      // router prefetch) мог снова инициировать fetch. cancelled-flag всё ещё
      // защищает от двойного setState из старого fetch.
      initStartedRef.current = false
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
      video={false}
      audio={false}
      style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}
      onConnected={() => {
        setDisconnectReason(null)
        onQuality?.("good")
        Sentry.addBreadcrumb({
          category: "livekit",
          message: "connected",
          level: "info",
          data: { lessonId },
        })
      }}
      onDisconnected={(reason) => {
        const r = String(reason ?? "unknown")
        setDisconnectReason(r)
        onQuality?.("lost")
        // 'CLIENT_INITIATED' = пользователь сам hangup'нул — не репортим.
        // LiveKit отдаёт reason как enum (numeric) или строку; матчим оба.
        if (r !== "CLIENT_INITIATED" && r !== "1") {
          Sentry.captureMessage("livekit disconnected", {
            level: "warning",
            extra: { reason: r, lessonId },
          })
        }
      }}
      onError={(e) => {
        setError(e?.message ?? "LiveKit error")
        // Room unmount'ится через `if (error) return` ниже — SDK сам сделает
        // disconnect и cleanup track'ов при unmount LiveKitRoom (см. #4 аудита).
        Sentry.captureException(e, {
          tags: { provider: "livekit", lesson_id: lessonId },
        })
      }}
      data-lk-theme="default"
    >
      <StageInner
        externalChat={externalChat}
        sidebarOn={sidebarOn}
        onToggleSidebar={onToggleSidebar}
        onFullscreen={onFullscreen}
        fullscreenSupported={fullscreenSupported}
        onEnd={onEnd}
        onQuality={onQuality}
        hangupSignal={hangupSignal}
        disconnectReason={disconnectReason}
        onRoom={onRoom}
        onOpenSettings={onOpenSettings}
        onOpenNotes={onOpenNotes}
        onShareLink={onShareLink}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

interface StageInnerProps {
  externalChat: boolean
  sidebarOn: boolean
  onToggleSidebar: () => void
  onFullscreen?: () => void
  fullscreenSupported: boolean
  onEnd: () => void
  onQuality?: (q: "good" | "fair" | "poor" | "lost" | "unknown") => void
  hangupSignal?: number
  disconnectReason: string | null
  onRoom?: (room: import("livekit-client").Room | null) => void
  onOpenSettings?: () => void
  onOpenNotes?: () => void
  onShareLink?: () => void
}

function StageInner({
  externalChat,
  sidebarOn,
  onToggleSidebar,
  onFullscreen,
  fullscreenSupported,
  onEnd,
  onQuality,
  hangupSignal,
  disconnectReason,
  onRoom,
  onOpenSettings,
  onOpenNotes,
  onShareLink,
}: StageInnerProps) {
  const room = useRoomContext()
  // Ephemeral LiveKit-чат (data-channel) — только когда parent НЕ управляет
  // чатом сам. Для уроков externalChat=true и LkChatPanel не рендерится:
  // кнопка «чат» вместо этого зовёт `onToggleSidebar` → parent открывает
  // <ChatModal variant="dock"> с историей chat_messages.
  const [lkChatOpen, setLkChatOpen] = useState(false)

  // Пробрасываем Room вверх (для recorder'а). Effect — а не inline-вызов,
  // чтобы не отдавать новый room на каждый re-render. На unmount передаём
  // null, чтобы recorder отписался от listener'ов.
  useEffect(() => {
    onRoom?.(room ?? null)
    return () => {
      onRoom?.(null)
    }
  }, [room, onRoom])

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
      {!externalChat && lkChatOpen && (
        <LkChatPanel onClose={() => setLkChatOpen(false)} />
      )}
      <LiveKitControls
        sidebarOn={sidebarOn}
        onToggleSidebar={onToggleSidebar}
        onFullscreen={onFullscreen}
        fullscreenSupported={fullscreenSupported}
        onEnd={onEnd}
        onOpenSettings={onOpenSettings}
        onOpenNotes={onOpenNotes}
        onShareLink={onShareLink}
        lkChatOpen={externalChat ? sidebarOn : lkChatOpen}
        onToggleLkChat={externalChat ? undefined : () => setLkChatOpen((v) => !v)}
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

  // Обычная tile-сетка. До 10 участников (клубы/лекции).
  const count = Math.min(10, Math.max(1, cameraTiles.length))
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
  onOpenSettings?: () => void
  onOpenNotes?: () => void
  onShareLink?: () => void
  /** In-call LiveKit-чат (data-channel) — открыт/закрыт. */
  lkChatOpen?: boolean
  onToggleLkChat?: () => void
}

function LiveKitControls({
  sidebarOn,
  onToggleSidebar,
  onEnd,
  onOpenSettings,
  onOpenNotes,
  onShareLink,
  lkChatOpen,
  onToggleLkChat,
}: ControlsProps) {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } =
    useLocalParticipant()
  const [copiedAt, setCopiedAt] = useState(0)
  const shareLinkCopy = () => {
    onShareLink?.()
    setCopiedAt(Date.now())
  }
  const showCopied = copiedAt > 0 && Date.now() - copiedAt < 2000
  useEffect(() => {
    if (!showCopied) return
    const t = window.setTimeout(() => setCopiedAt(0), 2000)
    return () => window.clearTimeout(t)
  }, [showCopied, copiedAt])

  return (
    <div className="vc-bar">
      <div className="vc-bar-cluster">
        <button
          type="button"
          className={`vc-btn${showCopied ? " vc-btn--tip-lock" : ""}`}
          aria-label="поделиться ссылкой"
          onClick={shareLinkCopy}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lesson/icons/btn-74.svg" alt="" aria-hidden />
          <span className="vc-btn-tip">{showCopied ? "скопировано ✓" : "поделиться ссылкой"}</span>
        </button>
        <button
          type="button"
          className="vc-btn"
          aria-label="настройки"
          onClick={onOpenSettings}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lesson/icons/btn-75.svg" alt="" aria-hidden />
          <span className="vc-btn-tip">настройки</span>
        </button>
      </div>

      <div className="vc-bar-cluster vc-bar-cluster--center">
        <button
          type="button"
          className={`vc-btn${isCameraEnabled ? " vc-btn--inline" : ""}`}
          aria-label="камера"
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        >
          {isCameraEnabled ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 8-6 4 6 4V8Z" />
              <rect width="14" height="12" x="2" y="6" rx="2" />
            </svg>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/lesson/icons/btn-76.svg" alt="" aria-hidden />
          )}
          <span className="vc-btn-tip">камера</span>
        </button>
        <button
          type="button"
          className={`vc-btn${isMicrophoneEnabled ? " vc-btn--inline" : ""}`}
          aria-label="звук"
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/lesson/icons/btn-77.svg" alt="" aria-hidden />
          )}
          <span className="vc-btn-tip">звук</span>
        </button>
        <button
          type="button"
          className="vc-btn"
          aria-label="заметки"
          onClick={onOpenNotes}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lesson/icons/btn-78.svg" alt="" aria-hidden />
          <span className="vc-btn-tip">заметки</span>
        </button>
        <button
          type="button"
          className={`vc-btn${lkChatOpen ? " vc-btn--inline" : ""}`}
          aria-label="чат"
          aria-pressed={!!lkChatOpen}
          onClick={() => (onToggleLkChat ? onToggleLkChat() : onToggleSidebar())}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lesson/icons/btn-79.svg" alt="" aria-hidden />
          <span className="vc-btn-tip">чат</span>
        </button>
        <button
          type="button"
          className="vc-btn"
          aria-label="демонстрация экрана"
          onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lesson/icons/btn-80.svg" alt="" aria-hidden />
          <span className="vc-btn-tip">демонстрация экрана</span>
        </button>
      </div>

      <div className="vc-bar-cluster">
        <button
          type="button"
          className="vc-btn vc-btn--hangup"
          aria-label="сбросить звонок"
          onClick={onEnd}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lesson/icons/btn-81.svg" alt="" aria-hidden />
          <span className="vc-btn-tip">сбросить звонок</span>
        </button>
      </div>
    </div>
  )
}
