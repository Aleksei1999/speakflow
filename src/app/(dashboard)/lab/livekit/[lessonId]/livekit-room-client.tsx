"use client"

import { useEffect, useState } from "react"
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from "@livekit/components-react"
import { Track } from "livekit-client"
import "@livekit/components-styles"

export function LiveKitRoomClient({ lessonId }: { lessonId: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
        setError(j.error ?? `Token endpoint вернул ${res.status}`)
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
      <div style={{ padding: 24, color: "#B63F37" }}>
        <h2>LiveKit lab — ошибка</h2>
        <p>{error}</p>
        <p style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
          Проверь что в Vercel preview env заданы:{" "}
          <code>LIVEKIT_API_KEY</code>, <code>LIVEKIT_API_SECRET</code>,{" "}
          <code>LIVEKIT_URL</code>.
        </p>
      </div>
    )
  }

  if (!token || !serverUrl) {
    return <div style={{ padding: 24 }}>Получаем доступ к комнате…</div>
  }

  return (
    <div style={{ height: "100vh", margin: "-24px -28px" }}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={true}
        audio={true}
        data-lk-theme="default"
        style={{ height: "100%" }}
      >
        <RoomLayout />
        <RoomAudioRenderer />
        <ControlBar />
      </LiveKitRoom>
    </div>
  )
}

function RoomLayout() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
  return (
    <GridLayout
      tracks={tracks}
      style={{ height: "calc(100% - 60px)" }}
    >
      <ParticipantTile />
    </GridLayout>
  )
}
