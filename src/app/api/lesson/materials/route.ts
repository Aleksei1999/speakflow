// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Используем общую таблицу `materials` (а не legacy `lesson_materials`),
// чтобы загруженные на уроке файлы сразу видел студент в /student/materials
// (RLS materials_select_public_or_participant включает условие
// "lessons.student_id = auth.uid()" по lesson_id).

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')
  if (!lessonId) return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 })

  try {
    const admin = createAdminClient()
    const { data } = await (admin.from('materials') as any)
      .select('id, lesson_id, teacher_id, title, description, file_url, file_type, mime_type, file_size, storage_path, level, tags, created_at')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })

    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lessonId,
      userId,
      title,
      content,
      fileUrl,
      storagePath,
      mimeType,
      fileSize,
    } = body
    if (!lessonId || !userId || !title) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Резолвим teacher_profiles.id: materials.teacher_id FK на teacher_profiles.id,
    // а с клиента приходит userId = auth user_id (profiles.id).
    const { data: tp, error: tpErr } = await admin
      .from('teacher_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (tpErr) {
      console.error('[lesson/materials POST] teacher_profiles lookup failed', tpErr)
    }
    if (!tp?.id) {
      return NextResponse.json(
        { error: 'Загружать материалы может только преподаватель' },
        { status: 403 }
      )
    }

    const { data, error } = await (admin.from('materials') as any)
      .insert({
        lesson_id: lessonId,
        teacher_id: tp.id,
        title,
        description: content ?? null,
        file_url: fileUrl ?? '',
        storage_path: storagePath ?? null,
        mime_type: mimeType ?? null,
        file_size: fileSize ?? null,
        is_public: false,
      })
      .select()
      .single()

    if (error) {
      console.error('[lesson/materials POST] materials INSERT failed', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
