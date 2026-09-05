// ---------------------------------------------------------------------------
// POST /api/me/homework/upload
//
// Ученик загружает свой файл-ответ на домашнее задание. Файл идёт в
// bucket `teacher-materials` (тот же где хранится всё), но с префиксом
// `student-uploads/{userId}/`. В таблицу `materials` пишем запись
// (teacher_id пока обязателен → берём преподавателя из уже существующего
// share этому ученику; fallback — первый teacher_profile). Далее создаём
// material_shares(target_type='student', target_id=userId), чтобы файл
// был виден в /api/me/homework.
//
// MULTIPART: field name = "file".
// Ограничения: 25 МБ, авто-detect mime, no AV scan (Q&D MVP).
// ---------------------------------------------------------------------------

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'teacher-materials'
const MAX_BYTES = 25 * 1024 * 1024

function sanitizeName(raw: string): string {
  return raw
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'file'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const fd = await request.formData()
    const file = fd.get('file')
    const folderId = String(fd.get('folder_id') ?? '') || null
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Файл больше 25 МБ' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'Пустой файл' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // Определяем teacher_id для записи. Пробуем найти преподавателя,
    // который уже что-то шарил этому ученику — тогда файл логически
    // «принадлежит» их учебной паре. Если нет — берём первого teacher_profile.
    let teacherProfileId: string | null = null
    const { data: existingShare } = await admin
      .from('material_shares')
      .select('material_id')
      .eq('target_type', 'student')
      .eq('target_id', user.id)
      .limit(1)
      .maybeSingle()
    if (existingShare?.material_id) {
      const { data: mat } = await admin
        .from('materials')
        .select('teacher_id')
        .eq('id', existingShare.material_id)
        .maybeSingle()
      teacherProfileId = mat?.teacher_id ?? null
    }
    if (!teacherProfileId) {
      const { data: anyTeacher } = await admin
        .from('teacher_profiles')
        .select('id')
        .limit(1)
        .maybeSingle()
      teacherProfileId = anyTeacher?.id ?? null
    }
    if (!teacherProfileId) {
      return NextResponse.json(
        { error: 'В системе нет ни одного преподавателя — обратитесь к админу' },
        { status: 400 }
      )
    }

    // Upload to storage.
    const ts = Date.now()
    const safeName = sanitizeName(file.name)
    const storagePath = `student-uploads/${user.id}/${ts}_${safeName}`

    const bytes = new Uint8Array(await file.arrayBuffer())
    const up = await admin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
    if (up.error) {
      console.error('[me/homework/upload] storage error', up.error)
      return NextResponse.json({ error: 'Ошибка загрузки в хранилище' }, { status: 500 })
    }

    // Insert materials row.
    const { data: inserted, error: insErr } = await admin
      .from('materials')
      .insert({
        teacher_id: teacherProfileId,
        title: file.name,
        storage_path: storagePath,
        file_url: '', // enforced NOT NULL в 008 миграции; храним пустоту
        mime_type: file.type || null,
        file_size: file.size,
        is_public: false,
        folder_id: folderId,
      })
      .select('id')
      .single()
    if (insErr || !inserted?.id) {
      console.error('[me/homework/upload] insert error', insErr)
      // rollback storage
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {})
      return NextResponse.json({ error: 'Ошибка сохранения записи' }, { status: 500 })
    }

    // Share back to student so it appears in /api/me/homework.
    const { error: shErr } = await admin
      .from('material_shares')
      .insert({
        material_id: inserted.id,
        target_type: 'student',
        target_id: user.id,
      })
    if (shErr) {
      console.warn('[me/homework/upload] share insert warning', shErr)
      // Не rollback — файл всё же загружен, share можно пере-создать.
    }

    return NextResponse.json({ ok: true, id: inserted.id })
  } catch (e) {
    console.error('[me/homework/upload][POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
