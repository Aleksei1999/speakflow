import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')
  const studentId = request.nextUrl.searchParams.get('studentId')
  if (!lessonId) return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 })

  try {
    const admin = createAdminClient()
    let query = (admin.from('homework') as any).select('*').eq('lesson_id', lessonId)
    if (studentId) query = query.eq('student_id', studentId)
    const { data } = await query.order('created_at', { ascending: false })
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lessonId, teacherId, studentId, title, description, dueDate } = body
    if (!lessonId || !teacherId || !studentId || !title) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await (admin.from('homework') as any)
      .insert({
        lesson_id: lessonId,
        teacher_id: teacherId,
        student_id: studentId,
        title,
        description: description ?? '',
        due_date: dueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
