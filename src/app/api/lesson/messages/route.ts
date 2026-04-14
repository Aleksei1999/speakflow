import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')
  if (!lessonId) return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 })

  try {
    const admin = createAdminClient()
    const { data } = await (admin.from('lesson_messages') as any)
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true })

    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lessonId, userId, message } = body
    if (!lessonId || !userId || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await (admin.from('lesson_messages') as any)
      .insert({ lesson_id: lessonId, sender_id: userId, message })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
