// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowLeft, BookOpen, FileText, Send, Sparkles } from 'lucide-react'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { JitsiRoom } from '@/components/video/jitsi-room'
import { LessonControls } from '@/components/video/lesson-controls'

interface LessonData {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  student_id: string
  student_name: string
  student_avatar: string | null
}

interface JitsiTokenData {
  token: string
  domain: string
  roomName: string
}

type PageState = 'loading' | 'error' | 'lesson' | 'ended'

export default function TeacherLessonPage() {
  const params = useParams()
  const router = useRouter()
  const { user, profile, isLoading: userLoading } = useUser()
  const lessonId = params.lessonId as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [jitsiData, setJitsiData] = useState<JitsiTokenData | null>(null)
  const [error, setError] = useState('')
  const [showMaterials, setShowMaterials] = useState(false)

  // Состояние формы заметок после урока
  const [teacherNotes, setTeacherNotes] = useState('')
  const [isSubmittingNotes, setIsSubmittingNotes] = useState(false)
  const [notesSubmitted, setNotesSubmitted] = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      router.push('/login')
      return
    }

    async function init() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        const { data: lessonData, error: lessonError } = await supabase
          .from('lessons')
          .select('id, scheduled_at, duration_minutes, status, student_id, teacher_id, profiles!lessons_student_id_fkey(full_name, avatar_url)')
          .eq('id', lessonId)
          .single()

        if (lessonError || !lessonData) {
          setError('Урок не найден')
          setPageState('error')
          return
        }

        // Проверяем, что пользователь -- преподаватель этого урока
        if (lessonData.teacher_id !== user!.id) {
          setError('Нет доступа к этому уроку')
          setPageState('error')
          return
        }

        const studentProfile = lessonData.profiles as { full_name: string; avatar_url: string | null } | null

        setLesson({
          id: lessonData.id,
          scheduled_at: lessonData.scheduled_at,
          duration_minutes: lessonData.duration_minutes,
          status: lessonData.status,
          student_id: lessonData.student_id,
          student_name: studentProfile?.full_name ?? 'Ученик',
          student_avatar: studentProfile?.avatar_url ?? null,
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

  const handleEndLesson = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      await supabase
        .from('lessons')
        .update({ status: 'completed' })
        .eq('id', lessonId)

      setPageState('ended')
    } catch {
      // Урок всё равно считаем завершённым на стороне клиента
      setPageState('ended')
    }
  }, [lessonId])

  const handleSubmitNotes = useCallback(async () => {
    if (!teacherNotes.trim() || teacherNotes.trim().length < 10) return

    setIsSubmittingNotes(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Сохраняем заметки в поле teacher_notes урока
      await supabase
        .from('lessons')
        .update({ teacher_notes: teacherNotes.trim() })
        .eq('id', lessonId)

      setNotesSubmitted(true)
    } catch {
      // Ошибка -- пользователь может попробовать снова
    } finally {
      setIsSubmittingNotes(false)
    }
  }, [lessonId, teacherNotes])

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
            <Button variant="outline" onClick={() => router.push('/teacher/schedule')}>
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
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <CardTitle>Урок завершён</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {lesson && (
              <div className="text-center text-sm text-muted-foreground">
                <p>Ученик: {lesson.student_name}</p>
                <p>
                  {format(new Date(lesson.scheduled_at), "d MMMM yyyy, HH:mm", { locale: ru })}
                </p>
              </div>
            )}

            {/* Форма заметок для AI-саммари */}
            {!notesSubmitted ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-[#CC3A3A]" />
                  <h3 className="font-medium text-sm">Заметки для AI-саммари</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Опишите, что было на уроке: темы, новая лексика, грамматика,
                  домашнее задание. AI сгенерирует подробное саммари для ученика.
                </p>
                <Textarea
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  placeholder="Тема урока: Past Perfect. Разобрали разницу между Past Simple и Past Perfect. Новая лексика: accomplish, determine, throughout..."
                  rows={6}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {teacherNotes.trim().length < 10
                      ? `Минимум 10 символов (${teacherNotes.trim().length}/10)`
                      : `${teacherNotes.trim().length} символов`}
                  </span>
                  <Button
                    style={{ backgroundColor: '#CC3A3A' }}
                    className="text-white hover:opacity-90"
                    onClick={handleSubmitNotes}
                    disabled={teacherNotes.trim().length < 10 || isSubmittingNotes}
                  >
                    {isSubmittingNotes ? (
                      <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Сохранить заметки
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium text-sm">Заметки сохранены</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/teacher/schedule`)}
                >
                  <Sparkles className="size-4" />
                  Сгенерировать AI-саммари
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/teacher/schedule')}
            >
              <ArrowLeft className="size-4" />
              К расписанию
            </Button>
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
              displayName={profile?.full_name ?? 'Преподаватель'}
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
                <h3 className="font-medium text-sm">Информация об уроке</h3>
              </div>
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Ученик</p>
                  <p className="text-sm font-medium">{lesson.student_name}</p>
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
          isTeacher={true}
          onEndLesson={handleEndLesson}
          onToggleMaterials={() => setShowMaterials(!showMaterials)}
          showMaterials={showMaterials}
        />
      )}
    </div>
  )
}
