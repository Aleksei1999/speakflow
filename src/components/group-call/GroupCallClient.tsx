"use client"

/* ============================================================
   GroupCallClient — минимальная LiveKit-комната для группового звонка.
   Использует VideoConference prefab из @livekit/components-react —
   готовый layout с tiles, mic/cam/hangup контролами. Нет записи, notes,
   chat — они в GroupChatModal.
   ============================================================ */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LiveKitRoom, VideoConference } from "@livekit/components-react"
import "@livekit/components-styles"

interface Props {
  groupId: string
  groupName: string
}

export default function GroupCallClient({ groupId, groupName }: Props) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/livekit/group-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId }),
        })
        const j = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(j?.error ?? `HTTP ${res.status}`)
          return
        }
        setToken(j.token)
        setServerUrl(j.url)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [groupId])

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#fff", background: "#111", minHeight: "100vh" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Не удалось подключиться</h1>
        <p style={{ opacity: 0.7 }}>{error}</p>
      </div>
    )
  }

  if (!token || !serverUrl) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#111", color: "#fff", fontFamily: "Inter, sans-serif" }}>
        Подключение к звонку…
      </div>
    )
  }

  return (
    <div style={{ height: "100vh", background: "#111" }}>
      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "14px 22px",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: 18,
          zIndex: 10,
          textShadow: "0 1px 2px rgba(0,0,0,.6)",
          pointerEvents: "none",
        }}
      >
        {groupName}
      </header>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        video
        audio
        data-lk-theme="default"
        style={{ height: "100vh" }}
        onDisconnected={() => {
          router.back()
        }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  )
}
