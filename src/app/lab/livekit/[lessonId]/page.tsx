// Standalone LiveKit lab page — без DashboardShell.
// URL: /lab/livekit/<lesson-id>

import { LiveKitRoomClient } from "./livekit-room-client"

export const dynamic = "force-dynamic"

export default async function LiveKitLabPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  return <LiveKitRoomClient lessonId={lessonId} />
}
