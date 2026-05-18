// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LessonRoomClient } from '@/components/lesson/lesson-room-client'
import { LessonGate } from '@/components/lesson/lesson-gate'
import { JITSI_CONFIG } from '@/lib/jitsi/config'
import { generateJitsiToken } from '@/lib/jitsi/jwt'
import { getJitsiRoomName } from '@/lib/jitsi/room'
import { computeLessonAccess } from '@/lib/lesson-access'

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Один embed-запрос вместо трёх последовательных:
  //   lessons → teacher_profiles → profiles
  // PostgREST поднимает teacher_profiles по lessons_teacher_id_fkey, а
  // дальше profiles по teacher_profiles_user_id_fkey. На стороне Postgres
  // это один план, без HTTP round-trip между уровнями.
  const { data: lesson } = await supabase
    .from('lessons')
    .select(
      'id, scheduled_at, duration_minutes, status, student_id, teacher_id, jitsi_room_name,' +
      ' teacher:teacher_profiles!lessons_teacher_id_fkey(' +
        'rating, total_reviews,' +
        ' user:profiles!teacher_profiles_user_id_fkey(full_name)' +
      ')'
    )
    .eq('id', lessonId)
    .single()

  // Admin может зайти на любой урок как observer/moderator (для модерации/поддержки).
  const { data: callerProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = callerProfile?.role === 'admin'
  if (!lesson || (lesson.student_id !== user.id && !isAdmin)) {
    redirect('/student/schedule')
  }

  // PostgREST возвращает embed-объекты массивом/объектом в зависимости от
  // shape FK; tolerant unwrap покрывает оба варианта.
  const teacherEmbed: any = Array.isArray((lesson as any).teacher)
    ? (lesson as any).teacher[0]
    : (lesson as any).teacher
  const teacherUserEmbed: any = teacherEmbed
    ? Array.isArray(teacherEmbed.user) ? teacherEmbed.user[0] : teacherEmbed.user
    : null
  const teacherName = teacherUserEmbed?.full_name ?? 'Преподаватель'
  const teacherRating = teacherEmbed?.rating ?? 0

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
        teacherName={teacherName}
        isTeacher={false}
        initialStatus={access.status}
      />
    )
  }

  // Student profile + progress
  const [profileRes, progressRes, completedRes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('user_progress').select('english_level').eq('user_id', user.id).maybeSingle(),
    supabase.from('lessons').select('id', { count: 'exact', head: true })
      .eq('student_id', user.id).eq('status', 'completed'),
  ])

  // Next lesson after this one
  const { data: nextLessons } = await supabase
    .from('lessons')
    .select('scheduled_at')
    .eq('student_id', user.id)
    .eq('status', 'booked')
    .gt('scheduled_at', lesson.scheduled_at)
    .order('scheduled_at', { ascending: true })
    .limit(1)

  const lessonNumber = (completedRes.count ?? 0) + 1
  const studentLevel = progressRes.data?.english_level ?? '—'

  // ВАЖНО: имя комнаты должно совпадать с тем, на которое /api/jitsi/token
  // выпускает JWT. Используем единый helper (см. lib/jitsi/room.ts).
  // Старый "красивый" префикс `raw-english-${slice(0,8)}` ломал prosody.
  const roomName = getJitsiRoomName(lesson)
  let jitsiToken = ''
  try {
    jitsiToken = await generateJitsiToken(roomName, {
      id: user.id,
      name: profileRes.data?.full_name ?? 'Ученик',
      email: user.email ?? '',
      avatarUrl: null,
      isModerator: false,
    }, {
      scheduledAt: lesson.scheduled_at,
      durationMinutes: lesson.duration_minutes,
    })
  } catch {}

  // Помечаем урок как in_progress при первом заходе участника в окно
  // доступа — иначе cron mark_missed_lessons (миграция 050) через
  // ~10 мин после окончания пометит его как no_show.
  if (lesson.status === 'booked') {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      await createAdminClient()
        .from('lessons')
        .update({ status: 'in_progress' })
        .eq('id', lessonId)
        .eq('status', 'booked')
    } catch {
      /* noop — урок не критично если не обновился, главное JWT уже сгенерирован */
    }
  }

  return (
    <LessonRoomClient
      lessonId={lesson.id}
      scheduledAt={lesson.scheduled_at}
      durationMinutes={lesson.duration_minutes}
      userId={user.id}
      userName={profileRes.data?.full_name ?? 'Ученик'}
      teacherName={teacherName}
      teacherRating={teacherRating}
      jitsiDomain={JITSI_CONFIG.domain}
      jitsiToken={jitsiToken}
      jitsiRoom={roomName}
      lessonNumber={lessonNumber}
      studentLevel={studentLevel}
      nextLessonAt={nextLessons?.[0]?.scheduled_at ?? null}
      studentId={user.id}
      teacherProfileId={lesson.teacher_id ?? null}
    />
  )
}
