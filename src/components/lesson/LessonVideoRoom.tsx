"use client"

/* ============================================================
   Минимальная комната урока — только видео-звонок.
   Тёмный полноэкранный layout по Figma 2208-1775:
     • top-bar: Raw логотип + мин/раскрыть/закрыть
     • LiveKit stage (2 участника side-by-side)
     • .vc-bar снизу (внутри LiveKitLessonStage → LiveKitControls)
     • модалки: settings / leave / post-lesson note
   Никаких stats, sidebar, homework карточек.
   ============================================================ */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"

import SettingsModal from "@/components/lesson/SettingsModal"
import LeaveCallModal from "@/components/lesson/LeaveCallModal"
import PostLessonNoteModal from "@/components/lesson/PostLessonNoteModal"
import LessonNotesModal from "@/components/lesson/LessonNotesModal"
import ChatModal from "@/components/dashboard/ChatModal"

const LiveKitLessonStage = dynamic(
  () => import("@/components/lesson/livekit-stage").then((m) => m.LiveKitLessonStage),
  { ssr: false, loading: () => null },
)

interface Props {
  lessonId: string
  userId: string
  isTeacher: boolean
  studentId: string
  studentName: string
  studentLevel: string
  studentAvatar?: string | null
  teacherUserId: string
  teacherName: string
  teacherAvatar?: string | null
  backHref: string
}

export default function LessonVideoRoom({
  lessonId,
  userId,
  isTeacher,
  studentId,
  studentName,
  studentLevel,
  studentAvatar,
  teacherUserId,
  teacherName,
  teacherAvatar,
  backHref,
}: Props) {
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)          // in-call заметки, кнопка в баре
  const [postNoteOpen, setPostNoteOpen] = useState(false)    // teacher-only post-lesson отзыв, показывается при выходе
  const [lkHangupSignal, setLkHangupSignal] = useState(0)
  const [fsSupported, setFsSupported] = useState(false)
  // in-call чат: 'closed' | 'open' | 'min' (свёрнут в pill в углу).
  const [chatState, setChatState] = useState<"closed" | "open" | "min">("closed")
  // Раскрыт ли чат на весь экран (variant="modal" вместо "dock").
  const [chatExpanded, setChatExpanded] = useState(false)

  // Собеседник по чату: учитель видит ученика, ученик — учителя.
  const peer = isTeacher
    ? { id: studentId, name: studentName, avatar: studentAvatar ?? undefined, role: "student" as const, level: studentLevel }
    : { id: teacherUserId, name: teacherName, avatar: teacherAvatar ?? undefined, role: "teacher" as const, level: undefined }
  const currentRole: "teacher" | "student" = isTeacher ? "teacher" : "student"
  const canChat = !!peer.id

  useEffect(() => {
    setFsSupported(typeof document !== "undefined" && !!document.fullscreenEnabled)
  }, [])

  const doLeave = () => {
    setLeaveOpen(false)
    setLkHangupSignal((v) => v + 1)
    if (isTeacher) {
      setPostNoteOpen(true)
    } else {
      router.push(backHref)
    }
  }

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  const shareLink = () => {
    if (typeof window === "undefined") return
    try {
      void navigator.clipboard?.writeText(window.location.href)
    } catch {
      /* нет прав / не https — пропускаем */
    }
  }

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
              aria-label="Закрыть звонок"
              onClick={() => setLeaveOpen(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lesson/icons/win-84.svg" alt="" aria-hidden />
            </button>
          </div>
        </div>

        <div className="lvr-stage">
          <LiveKitLessonStage
            lessonId={lessonId}
            externalChat
            sidebarOn={chatState === "open"}
            onToggleSidebar={() => {
              if (!canChat) return
              setChatState((s) => (s === "open" ? "min" : "open"))
            }}
            fullscreenSupported={fsSupported}
            onFullscreen={fsSupported ? toggleFullscreen : undefined}
            onEnd={() => setLeaveOpen(true)}
            hangupSignal={lkHangupSignal}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenNotes={() => setNotesOpen(true)}
            onShareLink={shareLink}
          />
        </div>

        {/* Свёрнутый чат — pill в правом нижнем углу поверх видео. */}
        {chatState === "min" && (
          <button
            type="button"
            className="lvr-chat-pill"
            onClick={() => setChatState("open")}
            aria-label={`Открыть чат с ${peer.name}`}
          >
            <span className="lvr-chat-pill-dot" aria-hidden />
            Чат · {peer.name}
          </button>
        )}
      </div>

      {chatState === "open" && canChat && (
        <ChatModal
          peerId={peer.id}
          peerName={peer.name}
          peerRole={peer.role}
          peerLevel={peer.level}
          peerAvatar={peer.avatar}
          currentUserId={userId}
          currentRole={currentRole}
          variant={chatExpanded ? "modal" : "dock"}
          hideCallActions
          onMinimize={() => setChatState("min")}
          onToggleExpand={() => setChatExpanded((v) => !v)}
          onClose={() => { setChatExpanded(false); setChatState("closed") }}
        />
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LeaveCallModal
        open={leaveOpen}
        canEndForAll={isTeacher}
        onClose={() => setLeaveOpen(false)}
        onLeave={doLeave}
        onEndForAll={doLeave}
      />
      <LessonNotesModal
        open={notesOpen}
        lessonId={lessonId}
        onClose={() => setNotesOpen(false)}
      />
      {isTeacher && studentId && (
        <PostLessonNoteModal
          open={postNoteOpen}
          lessonId={lessonId}
          studentId={studentId}
          studentName={studentName}
          studentLevel={studentLevel}
          studentAvatar={studentAvatar ?? null}
          onClose={() => {
            setPostNoteOpen(false)
            router.push(backHref)
          }}
          onSaved={() => {
            router.push(backHref)
          }}
        />
      )}
    </>
  )
}
