// @ts-nocheck
"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

interface Participant {
  id: string | null
  full_name: string | null
  avatar_url: string | null
  email: string | null
  status: string
}

interface Props {
  clubId: string
  title: string
  description?: string | null
  coverEmoji?: string | null
  level?: string | null
  category?: string | null
  capacity: number
  seatsTaken: number
  scheduledAt: string
  durationMinutes: number
  jitsiDomain: string
  jitsiToken: string
  jitsiRoom: string
  userId: string
  userName: string
  isModerator: boolean
  hostName: string
  hostInitials: string
  hostAvatarUrl?: string | null
  participants: Participant[]
  backHref: string
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any
  }
}

const CSS = `
:root{--red:#E63946;--lime:#D8F26A;--black:#0A0A0A;--bg:#F5F5F3;--surface:#FFFFFF;--surface-2:#FAFAF7;--border:#EEEEEA;--muted:#8A8A86;--text:#0A0A0A}
.cr{font-family:'Inter',sans-serif;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;color:var(--text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;margin:-24px -28px;height:calc(100vh - 0px)}
.cr *{box-sizing:border-box}.cr a{color:inherit;text-decoration:none}.cr button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.cr .lh{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:14px 24px;background:var(--black);color:#fff;flex-shrink:0}
.cr .lh-side{display:flex;align-items:center}.cr .lh-right{justify-content:flex-end}
.cr .lh-center{display:flex;align-items:center;justify-content:center}
.cr .lh-center .title{color:#A0A09A;font-size:14px}.cr .lh-center .title strong{color:#fff;font-weight:600;margin-left:4px}
.cr .tmr{background:var(--lime);color:var(--black);padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
.cr .tmr .dot{width:7px;height:7px;background:var(--black);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.cr .btn-exit{border-radius:999px;padding:9px 18px;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);transition:transform .1s ease}
.cr .btn-exit:hover{background:rgba(255,255,255,0.18)}.cr .btn-exit:active{transform:scale(0.97)}
.cr .lm{flex:1;display:flex;flex-direction:column;gap:14px;padding:16px;overflow:hidden}
.cr .lesson-stats{display:grid;grid-template-columns:repeat(3,1fr) 1.3fr;gap:12px;flex-shrink:0}
.cr .stat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.cr .stat .stat-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cr .stat .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.cr .stat .value{font-size:28px;font-weight:800;margin-top:6px;letter-spacing:-0.5px}
.cr .stat .value small{font-size:14px;color:var(--muted);font-weight:500;margin-left:2px}
.cr .stat-dark .value{font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cr .stat-dark{background:var(--black);color:#fff;border-color:var(--black)}.cr .stat-dark .label{color:#A0A09A}.cr .stat-dark .value small{color:#A0A09A}
.cr .stat-lime{background:var(--lime);border-color:var(--lime)}.cr .stat-lime .label{opacity:.7}.cr .stat-lime .value small{opacity:.7}
.cr .stat-host{display:flex;align-items:center;gap:12px;padding:12px 14px}
.cr .av{width:44px;height:44px;background:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;overflow:hidden}
.cr .av img{width:100%;height:100%;object-fit:cover}
.cr .stat-host .info{flex:1;min-width:0}.cr .stat-host .name{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cr .stat-host .sub{font-size:11px;color:var(--muted)}
.cr .lb{flex:1;display:grid;grid-template-columns:1fr 360px;gap:16px;min-height:0;transition:grid-template-columns .2s ease}
.cr .lb.no-sidebar{grid-template-columns:1fr}
.cr .stage{display:flex;flex-direction:column;gap:12px;min-height:0;min-width:0}
.cr .va{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:14px;overflow:hidden;min-height:0}
.cr .vm{position:relative;flex:1;background:#1a1a1a;border-radius:12px;overflow:hidden;min-height:0}
.cr .vm .jitsi-mount{position:absolute;inset:0}
.cr .vm .jitsi-mount > div{width:100%;height:100%}
.cr .vm .jitsi-mount iframe{width:100%;height:100%;border:0;display:block}
.cr .live-badge{position:absolute;top:16px;left:16px;background:var(--red);color:#fff;padding:6px 12px;border-radius:999px;font-size:10px;letter-spacing:1.5px;font-weight:800;display:flex;align-items:center;gap:6px;z-index:10;pointer-events:none}
.cr .live-badge .blink{width:6px;height:6px;background:#fff;border-radius:50%;animation:blink 1.5s infinite}
@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:.3}}
.cr .vc{display:flex;justify-content:center;gap:12px;padding:6px 0 2px;flex-shrink:0}
.cr .cb{width:52px;height:52px;background:var(--bg);border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all .15s ease;color:var(--text)}
.cr .cb:hover{background:#e8e8e4}.cr .cb.active{background:var(--lime)}.cr .cb.danger{background:var(--red);color:#fff;transform:rotate(135deg)}.cr .cb.danger:hover{opacity:.9}
.cr .cb svg{width:22px;height:22px}
.cr .ls{background:var(--surface);border:1px solid var(--border);border-radius:16px;display:flex;flex-direction:column;overflow:hidden}
.cr .lt{display:flex;padding:8px;gap:4px;border-bottom:1px solid var(--border);flex-shrink:0}
.cr .ltb{flex:1;padding:11px;text-align:center;font-size:13px;font-weight:600;color:var(--muted);border-radius:10px;transition:all .15s ease}
.cr .ltb:hover{background:var(--bg)}.cr .ltb.active{background:var(--black);color:#fff;font-weight:700}
.cr .lc{flex:1;display:flex;flex-direction:column;min-height:0}
.cr .parts-list{flex:1;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px}
.cr .part-row{display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:12px;min-width:0}
.cr .part-row .pa-av{width:34px;height:34px;border-radius:50%;background:var(--accent-dark,#0A0A0A);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
.cr .part-row .pa-av img{width:100%;height:100%;object-fit:cover}
.cr .part-row .pa-name{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.cr .part-row .pa-st{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.cr .parts-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;padding:30px 16px;text-align:center}
.cr .info-area{padding:16px;font-size:13px;color:var(--text);line-height:1.55}
.cr .info-area h4{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:0 0 6px}
.cr .info-area p{margin:0 0 14px;color:var(--text)}
.cr .info-area .empty{color:var(--muted);font-style:italic}
.cr .lesson-bottom{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;flex-shrink:0}
.cr .bb-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s ease,transform .1s ease}
.cr .bb-card:hover{border-color:var(--black)}.cr .bb-card:active{transform:scale(0.99)}
.cr .bb-card.dark{background:var(--black);color:#fff;border-color:var(--black)}.cr .bb-card.dark .sub{color:#A0A09A}.cr .bb-card.dark:hover{border-color:var(--red)}
.cr .bb-icon{width:38px;height:38px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text)}
.cr .bb-icon.lime{background:var(--lime);color:var(--black)}.cr .bb-icon.red{background:var(--red);color:#fff}
.cr .bb-icon svg{width:18px;height:18px}
.cr .bb-card .title{font-weight:700;font-size:13px}.cr .bb-card .sub{font-size:11px;color:var(--muted);margin-top:2px}
@media(max-width:1000px){.cr .lb{grid-template-columns:1fr;grid-template-rows:1fr auto}.cr .ls{height:320px;order:2}.cr .stage{order:1}.cr .lesson-bottom{grid-template-columns:1fr}}
@media(max-width:900px){.cr .lesson-stats{grid-template-columns:1fr 1fr}}
@media(max-width:640px){.cr .lh{padding:12px 14px;grid-template-columns:1fr auto;gap:10px}.cr .lh-left{display:none}.cr .lh-center{justify-content:flex-start}.cr .lm{padding:10px;gap:10px}.cr .cb{width:44px;height:44px}.cr .cb svg{width:18px;height:18px}}
`

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0")
}

const CATEGORY_LABEL: Record<string, string> = {
  speaking: "Speaking",
  business: "Business",
  movies: "Movies",
  debate: "Debate",
  wine: "Wine",
  career: "Career",
  community: "Community",
  storytelling: "Storytelling",
  smalltalk: "Small talk",
  other: "Other",
}

export function ClubRoomClient({
  clubId,
  title,
  description,
  coverEmoji,
  level,
  category,
  capacity,
  seatsTaken,
  scheduledAt,
  durationMinutes,
  jitsiDomain,
  jitsiToken,
  jitsiRoom,
  userId,
  userName,
  isModerator,
  hostName,
  hostInitials,
  hostAvatarUrl,
  participants,
  backHref,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"participants" | "info">("participants")
  const [sidebarOn, setSidebarOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [screenOn, setScreenOn] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const jitsiRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<any>(null)

  // Live participants in the Jitsi conference (everyone who's actually
  // connected right now). Local user is added on videoConferenceJoined,
  // others come in via participantJoined.
  type LiveParticipant = {
    participantId: string
    displayName: string
    avatarURL?: string | null
  }
  const [liveParticipants, setLiveParticipants] = useState<LiveParticipant[]>([])

  // Countdown timer
  useEffect(() => {
    const end = new Date(scheduledAt).getTime() + durationMinutes * 60 * 1000
    const tick = () =>
      setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [scheduledAt, durationMinutes])
  const mm = pad2(Math.floor(remaining / 60))
  const ss = pad2(remaining % 60)

  // Jitsi init
  useEffect(() => {
    let disposed = false
    const init = async () => {
      if (!window.JitsiMeetExternalAPI) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script")
          s.src = `https://${jitsiDomain}/external_api.js`
          s.async = true
          s.onload = () => res()
          s.onerror = () => rej()
          document.head.appendChild(s)
        })
      }
      if (disposed || !jitsiRef.current) return
      apiRef.current = new window.JitsiMeetExternalAPI(jitsiDomain, {
        roomName: jitsiRoom,
        parentNode: jitsiRef.current,
        width: "100%",
        height: "100%",
        ...(jitsiToken ? { jwt: jitsiToken } : {}),
        configOverwrite: {
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          hideConferenceSubject: true,
          hideConferenceTimer: true,
          hideParticipantsStats: true,
          disableInviteFunctions: true,
          disableThirdPartyRequests: true,
          notifications: [],
          toolbarButtons: [],
          connectionIndicators: { autoHide: true, disabled: true },
          filmstrip: { disabled: true },
          disableSelfViewSettings: true,
          hideDisplayName: true,
          // Make the large video stretch/cover the container instead of letterboxing.
          videoLayoutFit: "both",
          disableLargeVideoCrop: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_LOGO_URL: "",
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true,
          TOOLBAR_BUTTONS: [],
          CONNECTION_INDICATOR_DISABLED: true,
          VIDEO_QUALITY_LABEL_DISABLED: true,
          DISABLE_DOMINANT_SPEAKER_INDICATOR: true,
          DISABLE_VIDEO_BACKGROUND: true,
          RECENT_LIST_ENABLED: false,
          FILM_STRIP_MAX_HEIGHT: 0,
          VERTICAL_FILMSTRIP: false,
          DISABLE_TRANSCRIPTION_SUBTITLES: true,
          VIDEO_LAYOUT_FIT: "both",
          DISABLE_PRESENCE_STATUS: true,
        },
        userInfo: { displayName: userName },
      })

      const api = apiRef.current
      const refreshFromApi = () => {
        try {
          const list = api.getParticipantsInfo?.() ?? []
          if (Array.isArray(list)) {
            setLiveParticipants(
              list.map((p: any) => ({
                participantId: p.participantId,
                displayName: p.displayName || p.formattedDisplayName || "—",
                avatarURL: p.avatarURL ?? null,
              }))
            )
          }
        } catch {}
      }

      api.addListener?.("videoConferenceJoined", (e: any) => {
        setLiveParticipants((cur) => {
          if (cur.some((p) => p.participantId === e.id)) return cur
          return [
            ...cur,
            {
              participantId: e.id,
              displayName: e.displayName || userName,
              avatarURL: e.avatarURL ?? null,
            },
          ]
        })
        refreshFromApi()
      })
      api.addListener?.("participantJoined", (e: any) => {
        setLiveParticipants((cur) => {
          if (cur.some((p) => p.participantId === e.id)) return cur
          return [
            ...cur,
            {
              participantId: e.id,
              displayName: e.displayName || "Гость",
              avatarURL: e.avatarURL ?? null,
            },
          ]
        })
      })
      api.addListener?.("participantLeft", (e: any) => {
        setLiveParticipants((cur) =>
          cur.filter((p) => p.participantId !== e.id)
        )
      })
      api.addListener?.("displayNameChange", (e: any) => {
        setLiveParticipants((cur) =>
          cur.map((p) =>
            p.participantId === e.id
              ? { ...p, displayName: e.displayname || p.displayName }
              : p
          )
        )
      })
      api.addListener?.("videoConferenceLeft", () => {
        setLiveParticipants([])
      })
    }
    init().catch(() => {})
    return () => {
      disposed = true
      try {
        apiRef.current?.dispose()
      } catch {}
      apiRef.current = null
    }
  }, [jitsiDomain, jitsiRoom, jitsiToken, userName])

  const toggleMic = () => {
    try {
      apiRef.current?.executeCommand("toggleAudio")
    } catch {}
    setMicOn((v) => !v)
  }
  const toggleCam = () => {
    try {
      apiRef.current?.executeCommand("toggleVideo")
    } catch {}
    setCamOn((v) => !v)
  }
  const toggleScreen = () => {
    try {
      apiRef.current?.executeCommand("toggleShareScreen")
    } catch {}
    setScreenOn((v) => !v)
  }
  const toggleFullscreen = () => {
    const el = document.querySelector(".cr") as HTMLElement | null
    if (!el) return
    try {
      if (document.fullscreenElement) document.exitFullscreen()
      else el.requestFullscreen()
    } catch {}
  }
  const handleEnd = () => {
    if (!confirm("Выйти из клуба?")) return
    try {
      apiRef.current?.executeCommand("hangup")
    } catch {}
    router.push(backHref)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cr">
        <header className="lh">
          <div className="lh-side lh-left" />
          <div className="lh-center">
            <span className="title">
              Speaking Club: <strong>{title}</strong>
            </span>
          </div>
          <div className="lh-side lh-right">
            <button className="btn-exit" onClick={handleEnd}>
              Выйти из клуба
            </button>
          </div>
        </header>

        <div className="lm">
          {/* Stats */}
          <div className="lesson-stats">
            <div className="stat">
              <div className="stat-top">
                <div className="label">Длительность</div>
                <div className="tmr">
                  <span className="dot" />
                  <span>
                    {mm}:{ss}
                  </span>
                </div>
              </div>
              <div className="value">
                {durationMinutes}
                <small>/мин</small>
              </div>
            </div>
            <div className="stat stat-dark">
              <div className="label">Уровень</div>
              <div className="value">{level || "—"}</div>
            </div>
            <div className="stat stat-lime">
              <div className="label">Участники</div>
              <div className="value">
                {seatsTaken}
                <small>/{capacity || "—"}</small>
              </div>
            </div>
            <div className="stat stat-host">
              <div className="av">
                {hostAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hostAvatarUrl} alt={hostName} />
                ) : (
                  hostInitials || "?"
                )}
              </div>
              <div className="info">
                <div className="name">{hostName}</div>
                <div className="sub">ведущий</div>
              </div>
            </div>
          </div>

          <div className={`lb ${sidebarOn ? "" : "no-sidebar"}`}>
            <div className="stage">
              <div className="va">
                <div className="vm">
                  <div className="jitsi-mount" ref={jitsiRef} />
                  <div className="live-badge">
                    <span className="blink" />
                    LIVE
                  </div>
                </div>
                <div className="vc">
                  <button
                    className={`cb ${micOn ? "active" : ""}`}
                    title="Микрофон"
                    onClick={toggleMic}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <path d="M12 19v3" />
                    </svg>
                  </button>
                  <button
                    className={`cb ${camOn ? "active" : ""}`}
                    title="Камера"
                    onClick={toggleCam}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m22 8-6 4 6 4V8Z" />
                      <rect width="14" height="12" x="2" y="6" rx="2" />
                    </svg>
                  </button>
                  <button
                    className={`cb ${screenOn ? "active" : ""}`}
                    title="Демонстрация"
                    onClick={toggleScreen}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="3" rx="2" />
                      <line x1="8" x2="16" y1="21" y2="21" />
                      <line x1="12" x2="12" y1="17" y2="21" />
                    </svg>
                  </button>
                  <button
                    className={`cb ${sidebarOn ? "active" : ""}`}
                    title="Показать/скрыть участников"
                    onClick={() => setSidebarOn((v) => !v)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M9 3v18" />
                    </svg>
                  </button>
                  <button
                    className="cb"
                    title="Полноэкранный режим"
                    onClick={toggleFullscreen}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </button>
                  <button className="cb danger" title="Выйти" onClick={handleEnd}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Bottom info cards (mirror of lesson-bottom) */}
              <div className="lesson-bottom">
                <div className="bb-card">
                  <div className="bb-icon lime">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="23" />
                      <line x1="8" x2="16" y1="23" y2="23" />
                    </svg>
                  </div>
                  <div>
                    <div className="title">
                      {coverEmoji ? `${coverEmoji} ` : ""}
                      {title}
                    </div>
                    <div className="sub">
                      {category && CATEGORY_LABEL[category]
                        ? CATEGORY_LABEL[category]
                        : "Speaking Club"}
                    </div>
                  </div>
                </div>
                <div
                  className="bb-card"
                  onClick={() => {
                    setSidebarOn(true)
                    setTab("participants")
                  }}
                >
                  <div className="bb-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div>
                    <div className="title">Участники</div>
                    <div className="sub">
                      {participants.length} из {capacity || "—"}
                    </div>
                  </div>
                </div>
                <div className="bb-card dark">
                  <div className="bb-icon red">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <div className="title">Старт</div>
                    <div className="sub">
                      {new Date(scheduledAt).toLocaleString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                        timeZone: "Europe/Moscow",
                      })}{" "}
                      МСК
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {sidebarOn && (
              <aside className="ls">
                <div className="lt">
                  <button
                    className={`ltb ${tab === "participants" ? "active" : ""}`}
                    onClick={() => setTab("participants")}
                  >
                    Участники
                  </button>
                  <button
                    className={`ltb ${tab === "info" ? "active" : ""}`}
                    onClick={() => setTab("info")}
                  >
                    О клубе
                  </button>
                </div>
                <div className="lc">
                  {tab === "participants" ? (
                    (() => {
                      const liveByName = new Map<string, LiveParticipant>()
                      for (const lp of liveParticipants) {
                        liveByName.set(
                          (lp.displayName || "").trim().toLowerCase(),
                          lp
                        )
                      }
                      const offline = participants.filter(
                        (p) =>
                          !liveByName.has(
                            (p.full_name || "").trim().toLowerCase()
                          )
                      )

                      if (
                        liveParticipants.length === 0 &&
                        participants.length === 0
                      ) {
                        return (
                          <div className="parts-empty">
                            Пока никто не записался
                          </div>
                        )
                      }

                      const initialsOf = (name: string) =>
                        (name || "")
                          .split(" ")
                          .filter(Boolean)
                          .map((s) => s[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "??"

                      return (
                        <div className="parts-list">
                          {liveParticipants.map((lp) => (
                            <div
                              key={"live-" + lp.participantId}
                              className="part-row"
                              title={lp.displayName}
                            >
                              <div className="pa-av">
                                {lp.avatarURL ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={lp.avatarURL}
                                    alt={lp.displayName}
                                  />
                                ) : (
                                  initialsOf(lp.displayName)
                                )}
                              </div>
                              <div className="pa-name">{lp.displayName}</div>
                              <div
                                className="pa-st"
                                style={{ color: "#22c55e" }}
                              >
                                В комнате
                              </div>
                            </div>
                          ))}
                          {offline.map((p, i) => (
                            <div
                              key={"reg-" + (p.id ?? "") + i}
                              className="part-row"
                              title={p.email || ""}
                              style={{ opacity: 0.55 }}
                            >
                              <div className="pa-av">
                                {p.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={p.avatar_url}
                                    alt={p.full_name || ""}
                                  />
                                ) : (
                                  initialsOf(p.full_name || "")
                                )}
                              </div>
                              <div className="pa-name">
                                {p.full_name || p.email || "—"}
                              </div>
                              <div className="pa-st">не в комнате</div>
                            </div>
                          ))}
                        </div>
                      )
                    })()
                  ) : (
                    <div className="info-area">
                      <h4>Тема</h4>
                      <p>
                        {coverEmoji ? `${coverEmoji} ` : ""}
                        {title}
                      </p>
                      <h4>Описание</h4>
                      {description ? (
                        <p>{description}</p>
                      ) : (
                        <p className="empty">Без описания</p>
                      )}
                      <h4>Категория</h4>
                      <p>
                        {category && CATEGORY_LABEL[category]
                          ? CATEGORY_LABEL[category]
                          : "Speaking Club"}
                      </p>
                      <h4>Уровень</h4>
                      <p>{level || "—"}</p>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
