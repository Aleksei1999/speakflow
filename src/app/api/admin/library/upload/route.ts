// POST /api/admin/library/upload
// Multipart: file. Админ грузит файл в общую библиотеку — виден всем ученикам.
// Файл ложится в teacher-materials, materials-строка помечается is_public=true
// (тогда getCachedStudentMaterials отдаёт его каждому ученику).

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'teacher-materials'
const MAX_BYTES = 50 * 1024 * 1024

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
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Файл больше 50 МБ' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // materials.teacher_id NOT NULL → берём первый teacher_profile как placeholder
    // (админ-owned материалы = public с teacher_id-заглушкой).
    const { data: anyTeacher } = await admin.from('teacher_profiles').select('id').limit(1).maybeSingle()
    if (!anyTeacher?.id) {
      return NextResponse.json({ error: 'В системе нет ни одного teacher_profile' }, { status: 400 })
    }

    const ts = Date.now()
    const path = `admin-library/${ts}_${sanitize(file.name)}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const up = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (up.error) {
      console.error('[admin/library/upload] storage', up.error)
      return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
    }

    const { data: mat, error: insErr } = await admin
      .from('materials')
      .insert({
        teacher_id: anyTeacher.id,
        title: file.name,
        storage_path: path,
        file_url: '',
        mime_type: file.type || null,
        file_size: file.size,
        is_public: true,   // публичный → виден всем
      })
      .select('id')
      .single()
    if (insErr || !mat?.id) {
      await admin.storage.from(BUCKET).remove([path]).catch(() => {})
      console.error('[admin/library/upload] insert', insErr)
      return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: mat.id })
  } catch (e) {
    console.error('[admin/library/upload]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
