import { NextRequest, NextResponse } from 'next/server'
import {
  requireLessonParticipant,
  requireLessonTeacherOrAdmin,
} from '@/lib/api/lesson-auth'

export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get('lessonId')

  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  try {
    let query = (gate.admin.from('homework') as any)
      .select('*')
      .eq('lesson_id', lessonId)

    // Студент видит только свою домашку, даже если в урок как-то попадёт
    // строка под чужого студента. Учитель/админ видят всю домашку урока.
    if (gate.role === 'student') {
      query = query.eq('student_id', gate.user.id)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
      {
      console.error('[lesson/homework]', error)
      return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
    }
    }
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    console.error('[lesson/homework]', e)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { lessonId, title, description, dueDate } = body ?? {}

    // WRITE: запрещаем создавать домашку после отмены / завершения урока.
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

    // Validate description.
    const desc = typeof description === 'string' ? description : ''
    if (desc.length > 4000) {
      return NextResponse.json({ error: 'Description too long' }, { status: 400 })
    }

    // Validate dueDate (optional, ISO).
    let dueIso: string | null = null
    if (dueDate != null && dueDate !== '') {
      if (typeof dueDate !== 'string') {
        return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
      }
      const t = Date.parse(dueDate)
      if (Number.isNaN(t)) {
        return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
      }
      dueIso = new Date(t).toISOString()
    } else {
      // legacy default: +7 дней
      dueIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }

    // homework.teacher_id ссылается на profiles.id (auth user), не на teacher_profiles.id.
    let teacherIdForRow: string | null = gate.user.id
    if (gate.role === 'admin' && gate.lesson.teacher_id) {
      const { data: tp } = await gate.admin
        .from('teacher_profiles')
        .select('user_id')
        .eq('id', gate.lesson.teacher_id)
        .maybeSingle<{ user_id: string }>()
      teacherIdForRow = tp?.user_id ?? null
    }
    if (!teacherIdForRow) {
      return NextResponse.json(
        { error: 'Не удалось определить teacher_id для домашки' },
        { status: 400 }
      )
    }

    // student_id всегда берём из самого урока — нельзя выбирать кому ставить.
    const studentIdForRow = gate.lesson.student_id
    if (!studentIdForRow) {
      return NextResponse.json(
        { error: 'У урока нет студента — некому назначать домашку' },
        { status: 400 }
      )
    }

    const { data, error } = await (gate.admin.from('homework') as any)
      .insert({
        lesson_id: lessonId,
        teacher_id: teacherIdForRow,
        student_id: studentIdForRow,
        title: trimmedTitle,
        description: desc,
        due_date: dueIso,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      {
      console.error('[lesson/homework]', error)
      return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
    }
    }
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('[lesson/homework]', e)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}
