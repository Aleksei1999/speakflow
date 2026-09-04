// ---------------------------------------------------------------------------
// GET /api/teacher/students/[id]/latest-note
//
// Возвращает самый свежий пост-урочный комментарий про этого ученика
// из ВСЕХ уроков (со всеми учителями). Используется в модалке «Об ученике»
// в блоке «О последнем уроке» — учитель видит заметку своего/чужого коллеги,
// чтобы не начинать с нуля когда ученик передан.
//
// Auth: только teacher/admin.
// Response: { note: {content, updatedAt, authorId, authorName, lessonAt} | null }
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: studentId } = await ctx.params
    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string }>()
    if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient() as any

    // Все уроки этого ученика.
    const { data: lessons } = await admin
      .from('lessons')
      .select('id, scheduled_at')
      .eq('student_id', studentId)
      .order('scheduled_at', { ascending: false })
      .limit(200)
    const lessonById = new Map<string, string>()
    for (const l of (lessons ?? []) as Array<{ id: string; scheduled_at: string }>) {
      lessonById.set(l.id, l.scheduled_at)
    }
    if (lessonById.size === 0) return NextResponse.json({ note: null })

    // Свежая заметка в этих уроках (любой автор).
    const { data: notes } = await admin
      .from('lesson_notes')
      .select('lesson_id, user_id, content, updated_at')
      .in('lesson_id', Array.from(lessonById.keys()))
      .order('updated_at', { ascending: false })
      .limit(1)
    const latest = ((notes ?? []) as Array<{
      lesson_id: string
      user_id: string
      content: string
      updated_at: string
    }>)[0]
    if (!latest || !latest.content?.trim()) {
      return NextResponse.json({ note: null })
    }

    // Автор — full_name из profiles.
    const { data: authorProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', latest.user_id)
      .maybeSingle()

    return NextResponse.json({
      note: {
        content: latest.content,
        updatedAt: latest.updated_at,
        authorId: latest.user_id,
        authorName: (authorProfile as { full_name: string | null } | null)?.full_name ?? null,
        lessonAt: lessonById.get(latest.lesson_id) ?? null,
      },
    })
  } catch (e) {
    console.error('[teacher/students/latest-note] error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
