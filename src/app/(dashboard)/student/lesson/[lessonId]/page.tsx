// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LessonRoomClient } from '@/components/lesson/lesson-room-client'

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, scheduled_at, duration_minutes, status, student_id, teacher_id, jitsi_room_name')
    .eq('id', lessonId)
    .single()

  if (!lesson || lesson.student_id !== user.id) {
    redirect('/student/schedule')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Try to get Jitsi config, fallback to public
  let jitsiDomain = 'meet.jit.si'
  let jitsiToken = ''
  const jitsiRoom = lesson.jitsi_room_name ?? `raw-english-${lessonId.slice(0, 8)}`

  if (process.env.JITSI_DOMAIN && process.env.JITSI_JWT_SECRET) {
    try {
      const { generateJitsiToken } = await import('@/lib/jitsi/jwt')
      jitsiDomain = process.env.JITSI_DOMAIN
      jitsiToken = await generateJitsiToken(jitsiRoom, {
        id: user.id,
        name: profile?.full_name ?? 'Ученик',
        email: user.email ?? '',
        isModerator: false,
      })
    } catch {
      // fallback to public jitsi
    }
  }

  return (
    <LessonRoomClient
      lessonId={lesson.id}
      scheduledAt={lesson.scheduled_at}
      durationMinutes={lesson.duration_minutes}
      userId={user.id}
      userName={profile?.full_name ?? 'Ученик'}
      teacherName="Преподаватель"
      jitsiDomain={jitsiDomain}
      jitsiToken={jitsiToken}
      jitsiRoom={jitsiRoom}
    />
  )
}
