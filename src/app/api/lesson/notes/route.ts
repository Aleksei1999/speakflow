import { NextRequest, NextResponse } from 'next/server'
import { requireLessonParticipant } from '@/lib/api/lesson-auth'

const MAX_NOTE_LEN = 20000

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')

  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  try {
    const { data, error } = await (gate.admin.from('lesson_notes') as any)
      .select('id, content, updated_at')
      .eq('lesson_id', gate.lesson.id)
      .eq('user_id', gate.user.id)
      .order('updated_at', { ascending: true })

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
    const rawContent: unknown = body?.content

    const gate = await requireLessonParticipant(lessonId)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    if (typeof rawContent !== 'string') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const content = rawContent.trim()
    if (!content) {
      return NextResponse.json({ error: 'Content is empty' }, { status: 400 })
    }
    if (content.length > MAX_NOTE_LEN) {
      return NextResponse.json(
        { error: `Content too long (max ${MAX_NOTE_LEN} chars)` },
        { status: 413 }
      )
    }

    const { data, error } = await (gate.admin.from('lesson_notes') as any)
      .insert({ lesson_id: gate.lesson.id, user_id: gate.user.id, content })
      .select('id, content, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

// PUT /api/lesson/notes — idempotent upsert (одна заметка на пользователя
// в рамках урока). lesson-sidebar.tsx сохраняет редактирование через PUT,
// чтобы не плодить INSERT-конфликты на уникальном (lesson_id, user_id).
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any))
    const lessonId: string | undefined = body?.lessonId
    const rawContent: unknown = body?.content

    const gate = await requireLessonParticipant(lessonId)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    if (typeof rawContent !== 'string') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const content = rawContent
    if (content.length > MAX_NOTE_LEN) {
      return NextResponse.json(
        { error: `Content too long (max ${MAX_NOTE_LEN} chars)` },
        { status: 413 }
      )
    }

    const { data, error } = await (gate.admin.from('lesson_notes') as any)
      .upsert(
        { lesson_id: gate.lesson.id, user_id: gate.user.id, content, updated_at: new Date().toISOString() },
        { onConflict: 'lesson_id,user_id' }
      )
      .select('id, content, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
