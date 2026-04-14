// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LessonRoomClient } from '@/components/lesson/lesson-room-client'

export default async function TeacherLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get teacher_profile id
  const { data: tp } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!tp) redirect('/teacher')

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, scheduled_at, duration_minutes, status, student_id, teacher_id, jitsi_room_name')
    .eq('id', lessonId)
    .single()

  if (!lesson || lesson.teacher_id !== tp.id) {
    redirect('/teacher/schedule')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Get student name
  const { data: studentProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', lesson.student_id)
    .single()

  const jitsiDomain = 'meet.jit.si'
  const jitsiToken = ''
  const jitsiRoom = lesson.jitsi_room_name ?? `raw-english-${lessonId.slice(0, 8)}`

  return (
    <LessonRoomClient
      lessonId={lesson.id}
      scheduledAt={lesson.scheduled_at}
      durationMinutes={lesson.duration_minutes}
      userId={user.id}
      userName={profile?.full_name ?? 'Преподаватель'}
      teacherName={studentProfile?.full_name ?? 'Ученик'}
      jitsiDomain={jitsiDomain}
      jitsiToken={jitsiToken}
      jitsiRoom={jitsiRoom}
    />
  )
}
