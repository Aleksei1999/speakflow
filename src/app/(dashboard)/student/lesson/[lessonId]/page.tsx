// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Star, ArrowLeft, BookOpen } from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JitsiRoom } from '@/components/video/jitsi-room'
import { LessonControls } from '@/components/video/lesson-controls'

interface LessonData {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  teacher_id: string
  teacher_name: string
  teacher_avatar: string | null
}

interface JitsiTokenData {
  token: string
  domain: string
  roomName: string
}

type PageState = 'loading' | 'error' | 'lesson' | 'ended'

export default function StudentLessonPage() {
  const params = useParams()
  const router = useRouter()
  const { user, profile, isLoading: userLoading } = useUser()
  const lessonId = params.lessonId as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [jitsiData, setJitsiData] = useState<JitsiTokenData | null>(null)
  const [error, setError] = useState('')
  const [showMaterials, setShowMaterials] = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      router.push('/login')
      return
    }

    async function init() {
      try {
        // Получаем информацию об уроке через Supabase client
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('id, scheduled_at, duration_minutes, status, student_id, teacher_id, profiles!lessons_teacher_id_fkey(full_name, avatar_url)')
          .eq('id', lessonId)
          .single()

        if (lessonError || !lessonData) {
          setError('Урок не найден')
          setPageState('error')
          return
        }

        // Проверяем, что пользователь -- студент этого урока
        if (lessonData.student_id !== user!.id) {
          setError('Нет доступа к этому уроку')
          setPageState('error')
          return
        }

        const teacherProfile = lessonData.profiles as { full_name: string; avatar_url: string | null } | null

        setLesson({
          id: lessonData.id,
          scheduled_at: lessonData.scheduled_at,
          duration_minutes: lessonData.duration_minutes,
          status: lessonData.status,
          teacher_id: lessonData.teacher_id,
          teacher_name: teacherProfile?.full_name ?? 'Преподаватель',
          teacher_avatar: teacherProfile?.avatar_url ?? null,
        })

        // Получаем JWT для Jitsi
        const tokenResponse = await fetch('/api/jitsi/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId }),
        })

        if (!tokenResponse.ok) {
          const tokenError = await tokenResponse.json().catch(() => ({}))
          setError((tokenError as { error?: string }).error ?? 'Не удалось подключиться к уроку')
          setPageState('error')
          return
        }

        const tokenData: JitsiTokenData = await tokenResponse.json()
        setJitsiData(tokenData)
        setPageState('lesson')
      } catch {
        setError('Произошла ошибка при загрузке урока')
        setPageState('error')
      }
    }

    init()
  }, [lessonId, user, userLoading, router])

  const handleConferenceLeft = useCallback(() => {
    setPageState('ended')
  }, [])

  // --- Состояние загрузки ---
  if (pageState === 'loading' || userLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-[#CC3A3A]" />
          <p className="text-sm text-muted-foreground">Подключение к уроку...</p>
        </div>
      </div>
    )
  }

  // --- Ошибка ---
  if (pageState === 'error') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
              <svg className="size-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => router.push('/student/schedule')}>
              <ArrowLeft className="size-4" />
              Вернуться к расписанию
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- После завершения урока ---
  if (pageState === 'ended') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Урок завершён</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            {lesson && (
              <div className="text-sm text-muted-foreground">
                <p>Преподаватель: {lesson.teacher_name}</p>
                <p>
                  {format(new Date(lesson.scheduled_at), "d MMMM yyyy, HH:mm", { locale: ru })}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2 w-full">
              <Button
                style={{ backgroundColor: '#CC3A3A' }}
                className="w-full text-white hover:opacity-90"
                onClick={() => router.push(`/student/summaries`)}
              >
                <Star className="size-4" />
                Оставить отзыв
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/student/schedule')}
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

  // --- Активный урок ---
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Видеоконференция */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className={`flex-1 ${showMaterials ? 'w-2/3' : 'w-full'}`}>
          {jitsiData && (
            <JitsiRoom
              domain={jitsiData.domain}
              roomName={jitsiData.roomName}
              token={jitsiData.token}
              displayName={profile?.full_name ?? 'Ученик'}
              onConferenceLeft={handleConferenceLeft}
            />
          )}
        </div>

        {/* Боковая панель материалов */}
        {showMaterials && lesson && (
          <div className="w-1/3 min-w-[280px] max-w-[400px] border-l bg-background overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="size-4 text-[#CC3A3A]" />
                <h3 className="font-medium text-sm">Материалы урока</h3>
              </div>
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Преподаватель</p>
                  <p className="text-sm font-medium">{lesson.teacher_name}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Дата и время</p>
                  <p className="text-sm font-medium">
                    {format(new Date(lesson.scheduled_at), "d MMMM, HH:mm", { locale: ru })}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Длительность</p>
                  <Badge variant="secondary">{lesson.duration_minutes} мин</Badge>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Панель управления */}
      {lesson && (
        <LessonControls
          startedAt={lesson.scheduled_at}
          durationMinutes={lesson.duration_minutes}
          isTeacher={false}
          onToggleMaterials={() => setShowMaterials(!showMaterials)}
          showMaterials={showMaterials}
        />
      )}
    </div>
  )
}
