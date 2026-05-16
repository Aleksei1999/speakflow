// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LessonRoomClient } from '@/components/lesson/lesson-room-client'
import { LessonGate } from '@/components/lesson/lesson-gate'
import { JITSI_CONFIG } from '@/lib/jitsi/config'
import { generateJitsiToken } from '@/lib/jitsi/jwt'
import { getJitsiRoomName } from '@/lib/jitsi/room'
import { computeLessonAccess } from '@/lib/lesson-access'

export default async function TeacherLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tp } = await supabase
    .from('teacher_profiles')
    .select('id, rating')
    .eq('user_id', user.id)
    .single()
  if (!tp) redirect('/teacher')

  // Один embed-запрос вместо двух последовательных:
  //   lessons → profiles (student)
  // Используем lessons_student_id_fkey: lessons.student_id → profiles.id.
  const { data: lesson } = await supabase
    .from('lessons')
    .select(
      'id, scheduled_at, duration_minutes, status, student_id, teacher_id, jitsi_room_name,' +
      ' student:profiles!lessons_student_id_fkey(full_name)'
    )
    .eq('id', lessonId)
    .single()

  if (!lesson || lesson.teacher_id !== tp.id) redirect('/teacher/schedule')

  const studentEmbed: any = Array.isArray((lesson as any).student)
    ? (lesson as any).student[0]
    : (lesson as any).student
  const studentProfile = studentEmbed ? { full_name: studentEmbed.full_name as string | null } : null

  // Серверный гейт: проверяем окно доступа ДО генерации JWT
  const access = computeLessonAccess({
    scheduledAt: lesson.scheduled_at,
    durationMinutes: lesson.duration_minutes,
    status: lesson.status,
  })

  if (access.status !== 'live') {
    return (
      <LessonGate
        scheduledAt={lesson.scheduled_at}
        durationMinutes={lesson.duration_minutes}
        status={lesson.status}
        teacherName={studentProfile?.full_name ?? 'Ученик'}
        isTeacher
        initialStatus={access.status}
      />
    )
  }

  // Teacher profile
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single()

  const { data: studentProgress } = await supabase
    .from('user_progress').select('english_level').eq('user_id', lesson.student_id).maybeSingle()

  const { count: studentLessonCount } = await supabase
    .from('lessons').select('id', { count: 'exact', head: true })
    .eq('student_id', lesson.student_id).eq('status', 'completed')

  // Next lesson
  const { data: nextLessons } = await supabase
    .from('lessons')
    .select('scheduled_at')
    .eq('teacher_id', tp.id)
    .eq('status', 'booked')
    .gt('scheduled_at', lesson.scheduled_at)
    .order('scheduled_at', { ascending: true })
    .limit(1)

  // ВАЖНО: имя комнаты должно совпадать с тем, на которое /api/jitsi/token
  // выпускает JWT. Используем единый helper (см. lib/jitsi/room.ts).
  // Старый "красивый" префикс `raw-english-${slice(0,8)}` ломал prosody.
  const roomName = getJitsiRoomName(lesson)
  let jitsiToken = ''
  try {
    jitsiToken = await generateJitsiToken(roomName, {
      id: user.id,
      name: profile?.full_name ?? 'Преподаватель',
      email: user.email ?? '',
      avatarUrl: null,
      isModerator: true,
    }, {
      scheduledAt: lesson.scheduled_at,
      durationMinutes: lesson.duration_minutes,
    })
  } catch {}

  // Помечаем урок как in_progress при первом заходе. Иначе cron
  // mark_missed_lessons через ~10 мин после окончания пометит его
  // как no_show, даже если все были в комнате.
  if (lesson.status === 'booked') {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      await createAdminClient()
        .from('lessons')
        .update({ status: 'in_progress' })
        .eq('id', lessonId)
        .eq('status', 'booked')
    } catch {
      /* noop */
    }
  }

  return (
    <LessonRoomClient
      lessonId={lesson.id}
      scheduledAt={lesson.scheduled_at}
      durationMinutes={lesson.duration_minutes}
      userId={user.id}
      userName={profile?.full_name ?? 'Преподаватель'}
      teacherName={studentProfile?.full_name ?? 'Ученик'}
      teacherRating={tp.rating ?? 0}
      jitsiDomain={JITSI_CONFIG.domain}
      jitsiToken={jitsiToken}
      jitsiRoom={roomName}
      isTeacher
      lessonNumber={(studentLessonCount ?? 0) + 1}
      studentLevel={studentProgress?.english_level ?? '—'}
      nextLessonAt={nextLessons?.[0]?.scheduled_at ?? null}
      studentId={lesson.student_id}
    />
  )
}
