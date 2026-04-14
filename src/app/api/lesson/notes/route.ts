import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')
  const userId = request.nextUrl.searchParams.get('userId')
  if (!lessonId || !userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  try {
    const admin = createAdminClient()
    const { data } = await (admin.from('lesson_notes') as any)
      .select('content')
      .eq('lesson_id', lessonId)
      .eq('user_id', userId)
      .maybeSingle()

    return NextResponse.json({ content: (data as any)?.content ?? '' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lessonId, userId, content } = body
    if (!lessonId || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const admin = createAdminClient()

    await (admin.from('lesson_notes') as any)
      .delete()
      .eq('lesson_id', lessonId)
      .eq('user_id', userId)

    const { error } = await (admin.from('lesson_notes') as any)
      .insert({ lesson_id: lessonId, user_id: userId, content: content ?? '' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
