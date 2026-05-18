// Эксперимент: LiveKit видеочат на ветке livekit-experiment.
// URL: /lab/livekit/<existing-lesson-id>
//
// Зачем: сравнить с Jitsi — latency, recording, UI. Production
// продолжает работать на /lesson/[lessonId] через Jitsi.
//
// Доступ: только участник урока (через requireLessonParticipant в API).

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
