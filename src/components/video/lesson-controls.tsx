'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, PhoneOff, FileText, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LessonControlsProps {
  /** Время начала урока (ISO string) */
  startedAt: string
  /** Длительность урока в минутах */
  durationMinutes: number
  /** Является ли пользователь преподавателем */
  isTeacher: boolean
  /** Вызывается при завершении урока */
  onEndLesson?: () => void
  /** Вызывается при переключении панели материалов */
  onToggleMaterials?: () => void
  /** Показывать ли панель материалов */
  showMaterials?: boolean
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }
  return `${pad(m)}:${pad(s)}`
}

export function LessonControls({
  startedAt,
  durationMinutes,
  isTeacher,
  onEndLesson,
  onToggleMaterials,
  showMaterials = false,
}: LessonControlsProps) {
  const [elapsed, setElapsed] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  useEffect(() => {
    const start = new Date(startedAt).getTime()

    function updateElapsed() {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((now - start) / 1000))
      setElapsed(diff)
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  const totalSeconds = durationMinutes * 60
  const isOvertime = elapsed > totalSeconds
  const remaining = Math.max(0, totalSeconds - elapsed)

  const handleEndLesson = useCallback(() => {
    if (showEndConfirm) {
      onEndLesson?.()
      setShowEndConfirm(false)
    } else {
      setShowEndConfirm(true)
      // Автоматически скрываем подтверждение через 5 секунд
      setTimeout(() => setShowEndConfirm(false), 5000)
    }
  }, [showEndConfirm, onEndLesson])

  return (
    <div className="flex items-center justify-between gap-2 border-t bg-gray-900 px-4 py-2 text-white">
      {/* Таймер */}
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-gray-400" />
        <div className="flex flex-col">
          <span
            className={`text-sm font-mono font-medium ${isOvertime ? 'text-red-400' : 'text-white'}`}
          >
            {formatTime(elapsed)}
          </span>
          <span className="text-[10px] text-gray-500">
            {isOvertime
              ? `+${formatTime(elapsed - totalSeconds)} сверх`
              : `осталось ${formatTime(remaining)}`}
          </span>
        </div>
      </div>

      {/* Центральные кнопки управления */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className={`rounded-full ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
          onClick={() => setIsMuted(!isMuted)}
          aria-label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className={`rounded-full ${isCameraOff ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
          onClick={() => setIsCameraOff(!isCameraOff)}
          aria-label={isCameraOff ? 'Включить камеру' : 'Выключить камеру'}
        >
          {isCameraOff ? <VideoOff className="size-4" /> : <Video className="size-4" />}
        </Button>

        {onToggleMaterials && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={`rounded-full ${showMaterials ? 'bg-[#CC3A3A]/30 text-[#CC3A3A]' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
            onClick={onToggleMaterials}
            aria-label="Материалы"
          >
            <FileText className="size-4" />
          </Button>
        )}
      </div>

      {/* Кнопка завершения */}
      <div className="flex items-center gap-2">
        {isTeacher && (
          <Button
            size="sm"
            className={`rounded-full ${
              showEndConfirm
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            }`}
            onClick={handleEndLesson}
          >
            <PhoneOff className="size-3.5" />
            {showEndConfirm ? 'Подтвердить' : 'Завершить'}
          </Button>
        )}
      </div>
    </div>
  )
}
