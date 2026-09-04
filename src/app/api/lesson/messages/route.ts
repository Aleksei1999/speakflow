// GET/POST /api/lesson/messages — чат в комнате урока.
// Читает/пишет chat_messages (общий 1:1 чат teacher↔student), а не
// изолированный lesson_messages: пользователь хочет видеть всю историю
// переписки с этим учителем/учеником прямо на видеозвонке.

import { NextRequest, NextResponse } from 'next/server'
import { requireLessonParticipant } from '@/lib/api/lesson-auth'

type Role = 'student' | 'teacher' | 'admin'

const MAX_MESSAGE_LEN = 4000

// Legacy client shape (см. use-lesson-chat.ts):
//   { id, sender_id, message, created_at }
// Маппим chat_messages → этот shape, чтобы клиент не переделывать.
type ClientMsg = { id: string; sender_id: string; message: string; created_at: string }
type ChatRow = {
  id: string
  teacher_id: string
  student_id: string
  sender_role: 'teacher' | 'student'
  text: string | null
  created_at: string
}

async function resolvePeers(
  admin: any,
  lesson: { student_id: string | null; teacher_id: string | null },
): Promise<{ studentUserId: string; teacherUserId: string } | null> {
  if (!lesson.student_id || !lesson.teacher_id) return null
  const { data: tp } = await admin
    .from('teacher_profiles')
    .select('user_id')
    .eq('id', lesson.teacher_id)
    .maybeSingle()
  const teacherUserId = (tp as { user_id: string } | null)?.user_id
  if (!teacherUserId) return null
  return { studentUserId: lesson.student_id, teacherUserId }
}

function toClient(rows: ChatRow[]): ClientMsg[] {
  return rows.map((r) => ({
    id: r.id,
    sender_id: r.sender_role === 'teacher' ? r.teacher_id : r.student_id,
    message: r.text ?? '',
    created_at: r.created_at,
  }))
}

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')
  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const peers = await resolvePeers(gate.admin, gate.lesson)
  if (!peers) return NextResponse.json({ error: 'Peers unresolved' }, { status: 500 })

  const { data, error } = await ((gate.admin as any).from('chat_messages'))
    .select('id, teacher_id, student_id, sender_role, text, created_at')
    .eq('teacher_id', peers.teacherUserId)
    .eq('student_id', peers.studentUserId)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(toClient((data ?? []) as ChatRow[]))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any))
    const lessonId: string | undefined = body?.lessonId
    const rawMessage: unknown = body?.message

    const gate = await requireLessonParticipant(lessonId, { requireActive: true })
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    if (typeof rawMessage !== 'string') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const message = rawMessage.trim()
    if (!message) return NextResponse.json({ error: 'Message is empty' }, { status: 400 })
    if (message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_LEN})` }, { status: 413 })
    }

    const peers = await resolvePeers(gate.admin, gate.lesson)
    if (!peers) return NextResponse.json({ error: 'Peers unresolved' }, { status: 500 })

    // Определяем sender_role по тому, кто мы в этом уроке.
    // gate.role уже маркирован как student/teacher/admin. Admin присоединяется
    // как наблюдатель — не даём ему писать в чат от чужого имени.
    const roleForSender: Role = gate.role
    if (roleForSender !== 'teacher' && roleForSender !== 'student') {
      return NextResponse.json({ error: 'Только участник урока может писать' }, { status: 403 })
    }

    // sender_id — денормализованное «кто написал» (миграция 20260830140000).
    // Для teacher/student совпадает с одним из слотов teacher_id/student_id.
    const senderId = roleForSender === 'teacher' ? peers.teacherUserId : peers.studentUserId
    const { data, error } = await ((gate.admin as any).from('chat_messages'))
      .insert({
        teacher_id: peers.teacherUserId,
        student_id: peers.studentUserId,
        sender_id: senderId,
        sender_role: roleForSender,
        text: message,
      })
      .select('id, teacher_id, student_id, sender_role, text, created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(toClient([data as ChatRow])[0])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
