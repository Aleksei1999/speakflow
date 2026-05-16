import { NextRequest, NextResponse } from 'next/server'
import {
  requireLessonParticipant,
  requireLessonTeacherOrAdmin,
} from '@/lib/api/lesson-auth'

type MaterialBody = {
  lessonId?: string | null
  title?: string | null
  content?: string | null
  fileUrl?: string | null
  storagePath?: string | null
  mimeType?: string | null
  fileSize?: number | null
}

// Используем общую таблицу `materials` (а не legacy `lesson_materials`),
// чтобы загруженные на уроке файлы сразу видел студент в /student/materials
// (RLS materials_select_public_or_participant включает условие
// "lessons.student_id = auth.uid()" по lesson_id).

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')

  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const { data, error } = await (gate.admin.from('materials') as any)
      .select(
        'id, lesson_id, teacher_id, title, description, file_url, file_type, mime_type, file_size, storage_path, level, tags, created_at'
      )
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as MaterialBody
    const {
      lessonId,
      title,
      content,
      fileUrl,
      storagePath,
      mimeType,
      fileSize,
    } = body ?? {}

    // WRITE: запрещаем добавлять материалы после отмены / завершения урока.
    const gate = await requireLessonTeacherOrAdmin(lessonId, { requireActive: true })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    // Validate title.
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    if (!trimmedTitle) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 })
    }
    if (trimmedTitle.length > 200) {
      return NextResponse.json({ error: 'Title too long' }, { status: 400 })
    }

    // teacher_id resolution:
    //  - teacher caller → их teacher_profiles.id (gate.teacherProfileId).
    //  - admin caller   → берём teacher_id урока (он уже = teacher_profiles.id),
    //    чтобы материал привязался к преподавателю урока.
    let teacherIdForRow: string | null = gate.teacherProfileId
    if (gate.role === 'admin') {
      teacherIdForRow = gate.lesson.teacher_id ?? null
    }
    if (!teacherIdForRow) {
      return NextResponse.json(
        { error: 'Не удалось определить teacher_id для материала' },
        { status: 400 }
      )
    }

    const { data, error } = await (gate.admin.from('materials') as any)
      .insert({
        lesson_id: lessonId,
        teacher_id: teacherIdForRow,
        title: trimmedTitle,
        description: typeof content === 'string' ? content : null,
        file_url: typeof fileUrl === 'string' ? fileUrl : '',
        storage_path: typeof storagePath === 'string' ? storagePath : null,
        mime_type: typeof mimeType === 'string' ? mimeType : null,
        file_size:
          typeof fileSize === 'number' && Number.isFinite(fileSize)
            ? fileSize
            : null,
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
