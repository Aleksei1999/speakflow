import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')
  if (!lessonId) return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('lesson_notes')
    .select('content')
    .eq('lesson_id', lessonId)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ content: data?.content ?? '' })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { lessonId, content } = body

  const admin = createAdminClient()

  // Check if note exists
  const { data: existing } = await admin
    .from('lesson_notes')
    .select('id')
    .eq('lesson_id', lessonId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await admin
      .from('lesson_notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await admin
      .from('lesson_notes')
      .insert({ lesson_id: lessonId, user_id: user.id, content })
  }

  return NextResponse.json({ ok: true })
}
