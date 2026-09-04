"use client"

/* ============================================================
   LectureCallClient — комната лекции, стилизована точно как
   LessonVideoRoom (`.lvr` + `.vc`). Переиспользует `LiveKitLessonStage`
   с override'ом endpoint'а токена (/api/livekit/lecture-token).
   Post-lesson модалки (leave/notes) не нужны — лекция не приватная.
   ============================================================ */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"

import SettingsModal from "@/components/lesson/SettingsModal"

const LiveKitLessonStage = dynamic(
  () => import("@/components/lesson/livekit-stage").then((m) => m.LiveKitLessonStage),
  { ssr: false, loading: () => null },
)

interface Props {
  lectureId: string
  title: string
}

export default function LectureCallClient({ lectureId, title }: Props) {
  const router = useRouter()
  const [fsSupported, setFsSupported] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    setFsSupported(typeof document !== "undefined" && !!document.fullscreenEnabled)
  }, [])

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  }

  const tokenBody = useMemo(() => ({ lectureId }), [lectureId])

  return (
    <>
      <link rel="stylesheet" href="/lesson/lesson-room.css" />
      <div className="lvr">
        <div className="lvr-topbar">
          <a href="/" className="lvr-logo" aria-label="Raw English">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/raw2/logo-raw-word-white.svg" alt="Raw English" />
          </a>
          <div className="lvr-winbtns">
            <button
              type="button"
              className="lvr-winbtn"
              aria-label="Свернуть"
              onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) }}
              title={`Лекция · ${title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lesson/icons/win-82.svg" alt="" aria-hidden />
            </button>
            <button
              type="button"
              className="lvr-winbtn"
              aria-label="На весь экран"
              onClick={toggleFullscreen}
              disabled={!fsSupported}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lesson/icons/win-83.svg" alt="" aria-hidden />
            </button>
            <button
              type="button"
              className="lvr-winbtn"
              aria-label="Закрыть"
              onClick={() => router.back()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lesson/icons/win-84.svg" alt="" aria-hidden />
            </button>
          </div>
        </div>

        <div className="lvr-stage">
          <LiveKitLessonStage
            lessonId={lectureId}
            tokenEndpoint="/api/livekit/lecture-token"
            tokenBody={tokenBody}
            sidebarOn={false}
            onToggleSidebar={() => {}}
            fullscreenSupported={fsSupported}
            onFullscreen={fsSupported ? toggleFullscreen : undefined}
            onEnd={() => router.back()}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenNotes={() => {}}
            onShareLink={() => {
              if (typeof window !== "undefined") {
                try { void navigator.clipboard?.writeText(window.location.href) } catch {}
              }
            }}
          />
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
