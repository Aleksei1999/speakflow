// POST /api/admin/homework/upload
// Multipart: file + studentId. Admin грузит домашку конкретному ученику.
// Логика та же что /api/me/homework/upload, но с явным studentId.

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'teacher-materials'
const MAX_BYTES = 25 * 1024 * 1024

function sanitize(raw: string): string {
  return raw.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'file'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((profile as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const fd = await request.formData()
    const file = fd.get('file')
    const studentId = fd.get('studentId')
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Файл больше 25 МБ' }, { status: 400 })
    if (typeof studentId !== 'string' || !studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // teacher_id — берём первого teacher_profile (materials.teacher_id NOT NULL).
    // Для реального прода нужно хранить admin-owned материалы отдельно.
    const { data: anyTeacher } = await admin.from('teacher_profiles').select('id').limit(1).maybeSingle()
    const teacherProfileId = anyTeacher?.id
    if (!teacherProfileId) {
      return NextResponse.json({ error: 'В системе нет teacher_profile' }, { status: 400 })
    }

    const ts = Date.now()
    const path = `admin-uploads/${studentId}/${ts}_${sanitize(file.name)}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const up = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (up.error) {
      console.error('[admin/hw/upload] storage', up.error)
      return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
    }

    const { data: mat, error: insErr } = await admin
      .from('materials')
      .insert({
        teacher_id: teacherProfileId,
        title: file.name,
        storage_path: path,
        file_url: '',
        mime_type: file.type || null,
        file_size: file.size,
        is_public: false,
      })
      .select('id')
      .single()
    if (insErr || !mat?.id) {
      await admin.storage.from(BUCKET).remove([path]).catch(() => {})
      return NextResponse.json({ error: 'Ошибка сохранения записи' }, { status: 500 })
    }

    await admin.from('material_shares').insert({
      material_id: mat.id,
      target_type: 'student',
      target_id: studentId,
    })

    // Инвалидируем dashboard-кэш ученика (чтобы hw modal сразу подтянул новый файл).
    try {
      const { invalidateStudentDashboard } = await import('@/lib/cache/invalidate')
      invalidateStudentDashboard(studentId)
    } catch {}

    return NextResponse.json({ ok: true, id: mat.id })
  } catch (e) {
    console.error('[admin/homework/upload]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
