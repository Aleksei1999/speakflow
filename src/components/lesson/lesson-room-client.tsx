"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { Star, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { JitsiRoom } from "@/components/video/jitsi-room"
import { LessonControls } from "@/components/video/lesson-controls"
import { LessonSidebar } from "@/components/lesson/lesson-sidebar"

interface LessonRoomClientProps {
  lessonId: string
  scheduledAt: string
  durationMinutes: number
  userId: string
  userName: string
  teacherName: string
  jitsiDomain: string
  jitsiToken: string
  jitsiRoom: string
}

export function LessonRoomClient({
  lessonId,
  scheduledAt,
  durationMinutes,
  userId,
  userName,
  teacherName,
  jitsiDomain,
  jitsiToken,
  jitsiRoom,
}: LessonRoomClientProps) {
  const router = useRouter()
  const [ended, setEnded] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  const handleConferenceLeft = useCallback(() => {
    setEnded(true)
  }, [])

  if (ended) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Урок завершён</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="text-sm text-muted-foreground">
              <p>Преподаватель: {teacherName}</p>
              <p>{format(new Date(scheduledAt), "d MMMM yyyy, HH:mm", { locale: ru })}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button
                className="w-full bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
                onClick={() => router.push("/student/summaries")}
              >
                <Star className="size-4" />
                Оставить отзыв
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/student/schedule")}
              >
                <ArrowLeft className="size-4" />
                К расписанию
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col -m-4 sm:-m-6 lg:-m-8">
      <div className="relative flex flex-1 overflow-hidden">
        <div className={showSidebar ? "flex-1" : "w-full"}>
          <JitsiRoom
            domain={jitsiDomain}
            roomName={jitsiRoom}
            token={jitsiToken}
            displayName={userName}
            onConferenceLeft={handleConferenceLeft}
          />
        </div>

        {showSidebar && (
          <div className="w-80 min-w-[300px]">
            <LessonSidebar
              lessonId={lessonId}
              userId={userId}
              userName={userName}
              teacherName={teacherName}
            />
          </div>
        )}
      </div>

      <LessonControls
        startedAt={scheduledAt}
        durationMinutes={durationMinutes}
        isTeacher={false}
        onToggleMaterials={() => setShowSidebar(!showSidebar)}
        showMaterials={showSidebar}
      />
    </div>
  )
}
