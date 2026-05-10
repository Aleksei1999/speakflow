// @ts-nocheck
// ---------------------------------------------------------------
// Secure lesson file upload.
//
// Hardening (replaces a route that bypassed auth + auto-created a
// PUBLIC bucket from inside the request handler):
//   1. requireLessonTeacherOrAdmin gate — caller must be the teacher
//      of THIS lesson, or an admin. userId/teacher_id are NEVER read
//      from the body; they come from the gate.
//   2. Server-side 50 MB limit (defence in depth — middleware/CDN
//      should also limit, but never trust that).
//   3. Filename sanitised to [A-Za-z0-9._-], capped at 100 chars,
//      with a random 8-char slug to prevent collision/overwrite of
//      another participant's file.
//   4. Bucket must already exist (created via migration). We do not
//      auto-create it from a request handler — that previously made
//      the bucket public, which would expose every uploaded file.
//   5. Material row is private by default (is_public: false). The
//      bucket itself should be private; signed URLs handle reads.
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireLessonTeacherOrAdmin } from '@/lib/api/lesson-auth'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
const BUCKET = 'lesson-files'

function sanitizeFilename(raw: string): string {
  // Strip any path components a client might smuggle in.
  const base = (raw || '').split('/').pop()!.split('\\').pop()!.trim()
  // Split name/ext so we can guarantee a fallback extension.
  const dot = base.lastIndexOf('.')
  let name = dot > 0 ? base.slice(0, dot) : base
  let ext = dot > 0 ? base.slice(dot + 1) : ''

  const clean = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_')
  name = clean(name).replace(/^_+|_+$/g, '') || 'file'
  ext = clean(ext)
  if (!ext) ext = 'bin'

  let safe = `${name}.${ext}`
  if (safe.length > 100) {
    // Keep the extension; trim the name part.
    const keep = 100 - (ext.length + 1)
    safe = `${name.slice(0, Math.max(1, keep))}.${ext}`
  }
  return safe
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const lessonId = formData.get('lessonId') as string | null
    const titleRaw = formData.get('title')
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : ''

    if (!file || !lessonId) {
      return NextResponse.json({ error: 'Не передан файл или lessonId' }, { status: 400 })
    }

    // 1. Auth + lesson ownership gate.
    const gate = await requireLessonTeacherOrAdmin(lessonId)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }
    const { user, lesson, teacherProfileId, admin } = gate

    // 2. Size check (server-side, mandatory).
    if (typeof file.size === 'number' && file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Файл больше 50 MB' }, { status: 413 })
    }

    // 3. Safe filename + collision-resistant path.
    const safeName = sanitizeFilename(file.name || 'file.bin')
    const slug = randomUUID().slice(0, 8)
    const path = `lessons/${lessonId}/${Date.now()}-${slug}-${safeName}`

    // 4. Upload. Bucket MUST exist (created via migration).
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      const msg = uploadError.message || ''
      if (/not.?found|bucket/i.test(msg)) {
        return NextResponse.json(
          { error: `Storage bucket ${BUCKET} не настроен` },
          { status: 500 },
        )
      }
      return NextResponse.json({ error: msg || 'Upload failed' }, { status: 500 })
    }

    // 5. Public URL (works only if bucket is public; otherwise consumers
    //    should use signed URLs). We still store it for parity with other
    //    routes — `is_public: false` keeps the row gated.
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path)

    // 6. teacher_id from gate, never from body.
    //    Admin uploading on behalf of a lesson: use lesson.teacher_id.
    const teacherId = teacherProfileId ?? lesson.teacher_id
    if (!teacherId) {
      return NextResponse.json(
        { error: 'У урока не задан преподаватель' },
        { status: 500 },
      )
    }

    const insertRow = {
      lesson_id: lessonId,
      teacher_id: teacherId,
      title: title || safeName,
      description: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
      file_url: urlData.publicUrl,
      storage_path: path,
      mime_type: file.type || null,
      file_size: file.size ?? null,
      is_public: false,
    }

    const { data: mat, error: matError } = await admin
      .from('materials')
      .insert(insertRow)
      .select()
      .single()

    if (matError) {
      // Best-effort cleanup so we don't orphan the storage object.
      await admin.storage.from(BUCKET).remove([path]).catch(() => {})
      return NextResponse.json({ error: matError.message }, { status: 500 })
    }

    return NextResponse.json(mat)
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Upload failed' },
      { status: 500 },
    )
  }
}
