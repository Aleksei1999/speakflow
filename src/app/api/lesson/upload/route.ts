// Загрузка файла урока. IMPORTANT: userId/teacher_id берутся из гейта, не из
// body; bucket должен существовать заранее (авто-создание из handler'а делало
// его публичным); material row приватная (is_public: false), чтение — signed URL.

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireLessonTeacherOrAdmin } from '@/lib/api/lesson-auth'
import {
  preflightSize,
  verifyFileType,
  verifyFileObjectSafety,
} from '@/lib/api/file-upload'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { logAuditEvent } from '@/lib/audit/log'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB
const BUCKET = 'lesson-files'

function sanitizeFilename(raw: string): string {
  // Strip any path components a client might smuggle in.
  const base = (raw || '').split('/').pop()!.split('\\').pop()!.trim()
  const dot = base.lastIndexOf('.')
  let name = dot > 0 ? base.slice(0, dot) : base
  let ext = dot > 0 ? base.slice(dot + 1) : ''

  const clean = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '_')
  name = clean(name).replace(/^_+|_+$/g, '') || 'file'
  ext = clean(ext)
  if (!ext) ext = 'bin'

  let safe = `${name}.${ext}`
  if (safe.length > 100) {
    const keep = 100 - (ext.length + 1)
    safe = `${name.slice(0, Math.max(1, keep))}.${ext}`
  }
  return safe
}

export async function POST(request: NextRequest) {
  try {
    // Content-Length check ДО formData() — иначе многомегабайтный
    // body буферится в память и только потом отказывается.
    const tooBig = preflightSize(request, { maxBytes: MAX_BYTES })
    if (tooBig) return tooBig

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const lessonId = formData.get('lessonId') as string | null
    const titleRaw = formData.get('title')
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : ''

    if (!file || !lessonId) {
      return NextResponse.json({ error: 'Не передан файл или lessonId' }, { status: 400 })
    }

    // WRITE: запрещаем загрузку файлов после отмены / завершения урока.
    const gate = await requireLessonTeacherOrAdmin(lessonId, { requireActive: true })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }
    const { lesson, teacherProfileId, admin } = gate

    // Rate-limit: 20 upload/min на пользователя. fail-closed —
    // upload занимает storage и обходит CDN-лимит (4.5 MB).
    const limited = await enforceRateLimitStrict(request, {
      name: 'lesson:upload',
      keyParts: [gate.user.id, getClientIp(request)],
      max: 20,
      windowSeconds: 60,
    })
    if (limited) return limited

    // Backup-проверка размера на случай если Content-Length отсутствовал
    // или клиент схитрил (например multipart с заниженным заявленным).
    if (typeof file.size === 'number' && file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Файл больше 50 MB' }, { status: 413 })
    }

    // Magic-bytes: проверяем что first 16 байт соответствуют whitelist'у
    // и совпадают с заявленным MIME (клиент мог подделать file.type).
    const verified = await verifyFileType(file)
    if (verified instanceof NextResponse) return verified
    const resolvedMime = verified.mimeType

    // AV-scan через VirusTotal (hash-based, cached, fail-open).
    // НЕ блокирует upload если VT недоступен / нет ключа / timeout.
    const safety = await verifyFileObjectSafety(file)
    if (!safety.safe) {
      // Audit БЕЗ имени файла и БЕЗ полного hash — только префикс.
      await logAuditEvent(request, {
        category: 'data',
        action: 'av_blocked_upload',
        target_type: 'lessons',
        target_id: lessonId,
        payload: {
          endpoint: '/api/lesson/upload',
          hash_prefix: safety.sha256?.slice(0, 16) ?? null,
          detections: safety.detections ?? null,
        },
      })
      return NextResponse.json(
        {
          error: 'av_detected',
          message: 'Файл не прошёл антивирусную проверку',
        },
        { status: 422 },
      )
    }

    const safeName = sanitizeFilename(file.name || 'file.bin')
    const slug = randomUUID().slice(0, 8)
    const path = `lessons/${lessonId}/${Date.now()}-${slug}-${safeName}`

    // MIME ставим проверенный, а не доверяем file.type.
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: resolvedMime,
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

    // Public URL храним для parity с другими роутами; `is_public: false` держит row закрытой.
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path)

    // teacher_id из гейта, не из body; admin — lesson.teacher_id.
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
      mime_type: resolvedMime,
      file_size: file.size ?? null,
      is_public: false,
    }

    const { data: mat, error: matError } = await (admin.from('materials') as any)
      .insert(insertRow)
      .select()
      .single()

    if (matError) {
      // Best-effort cleanup so we don't orphan the storage object.
      await admin.storage.from(BUCKET).remove([path]).catch((e) => console.warn("[lesson/upload]", e))
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
