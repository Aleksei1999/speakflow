"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  clubId: string
  title: string
  scheduledAt: string
  durationMinutes: number
  jitsiDomain: string
  jitsiToken: string
  jitsiRoom: string
  userId: string
  userName: string
  isModerator: boolean
  backHref: string
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any
  }
}

const CSS = `
:root,[data-theme="light"]{--red:#E63946;--lime:#D8F26A;--bg:#0A0A0A;--surface:#141413;--surface-2:#1F1F1D;--border:#2A2A28;--muted:#A0A09A;--text:#fff}
.cr{font-family:'Inter',-apple-system,sans-serif;display:flex;flex-direction:column;height:100vh;background:var(--bg);overflow:hidden;color:var(--text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;margin:-60px}
.cr *{box-sizing:border-box;margin:0;padding:0}
.cr .topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 24px;background:#000;flex-shrink:0;border-bottom:1px solid var(--border)}
.cr .tb-left{display:flex;align-items:center;gap:14px;min-width:0}
.cr .badge{background:var(--lime);color:#0A0A0A;border-radius:999px;padding:4px 12px;font-size:11px;font-weight:800;letter-spacing:.4px}
.cr .ttl{font-size:14px;font-weight:700;letter-spacing:-.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60vw}
.cr .ttl small{color:var(--muted);font-weight:500;margin-left:8px}
.cr .leave{background:rgba(230,57,70,.2);color:#fff;border:1px solid rgba(230,57,70,.45);border-radius:999px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer}
.cr .leave:hover{background:rgba(230,57,70,.35)}
.cr .stage{flex:1;position:relative;background:#000}
.cr .jitsi-host{position:absolute;inset:0}
.cr .jitsi-host > div, .cr .jitsi-host iframe{width:100%;height:100%;border:0}
`

export function ClubRoomClient({
  clubId,
  title,
  scheduledAt,
  durationMinutes,
  jitsiDomain,
  jitsiToken,
  jitsiRoom,
  userId,
  userName,
  isModerator,
  backHref,
}: Props) {
  const router = useRouter()
  const hostRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<any>(null)
  const [scriptReady, setScriptReady] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.JitsiMeetExternalAPI) {
      setScriptReady(true)
      return
    }
    const s = document.createElement("script")
    s.src = `https://${jitsiDomain}/external_api.js`
    s.async = true
    s.onload = () => setScriptReady(true)
    document.body.appendChild(s)
    return () => {
      // keep script — many parts of the app may use it.
    }
  }, [jitsiDomain])

  useEffect(() => {
    if (!scriptReady || !hostRef.current || !window.JitsiMeetExternalAPI) return
    if (apiRef.current) return

    const api = new window.JitsiMeetExternalAPI(jitsiDomain, {
      roomName: jitsiRoom,
      jwt: jitsiToken,
      parentNode: hostRef.current,
      width: "100%",
      height: "100%",
      userInfo: {
        displayName: userName,
        email: undefined,
      },
      configOverwrite: {
        prejoinPageEnabled: true,
        startWithAudioMuted: true,
        startWithVideoMuted: false,
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_BRAND_WATERMARK: false,
        DEFAULT_LOGO_URL: "",
        TOOLBAR_BUTTONS: [
          "microphone",
          "camera",
          "desktop",
          "chat",
          "raisehand",
          "tileview",
          "fullscreen",
          "settings",
          "hangup",
        ],
      },
    })

    api.on("readyToClose", () => {
      router.push(backHref)
    })

    apiRef.current = api
    return () => {
      try {
        api.dispose()
      } catch {}
      apiRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, jitsiDomain, jitsiRoom, jitsiToken])

  return (
    <div className="cr">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="topbar">
        <div className="tb-left">
          <span className="badge">SPEAKING CLUB</span>
          <div className="ttl">
            {title}
            <small>
              {new Date(scheduledAt).toLocaleString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "short",
                timeZone: "Europe/Moscow",
              })}{" "}
              · {durationMinutes} мин
            </small>
          </div>
        </div>
        <button
          type="button"
          className="leave"
          onClick={() => router.push(backHref)}
        >
          Выйти
        </button>
      </div>
      <div className="stage">
        <div ref={hostRef} className="jitsi-host" />
      </div>
    </div>
  )
}
