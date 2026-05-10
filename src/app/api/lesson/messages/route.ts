import { NextRequest, NextResponse } from 'next/server'
import { requireLessonParticipant } from '@/lib/api/lesson-auth'

const MAX_MESSAGE_LEN = 4000

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')

  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  try {
    const { data, error } = await (gate.admin.from('lesson_messages') as any)
      .select('*')
      .eq('lesson_id', gate.lesson.id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any))
    const lessonId: string | undefined = body?.lessonId
    const rawMessage: unknown = body?.message

    const gate = await requireLessonParticipant(lessonId)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    if (typeof rawMessage !== 'string') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const message = rawMessage.trim()
    if (!message) {
      return NextResponse.json({ error: 'Message is empty' }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_MESSAGE_LEN} chars)` },
        { status: 413 }
      )
    }

    const { data, error } = await (gate.admin.from('lesson_messages') as any)
      .insert({ lesson_id: gate.lesson.id, sender_id: gate.user.id, message })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
