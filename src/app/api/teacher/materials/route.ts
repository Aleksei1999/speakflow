// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'teacher-materials'
const SIGNED_URL_TTL = 3600 // 1 hour
const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024 // 10 GB
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const TYPE_ENUM = ['all', 'pdf', 'ppt', 'doc', 'video', 'audio', 'img', 'link'] as const
const LEVEL_ENUM = ['all', 'A1-A2', 'B1', 'B2', 'C1+'] as const
const LEVELS_FOR_WRITE = ['A1-A2', 'B1', 'B2', 'C1+'] as const
const SORT_ENUM = ['recent', 'popular', 'name', 'size'] as const
const SECTION_ENUM = ['recent', 'popular'] as const

// Maps UI type -> MIME prefix or list for filtering
const TYPE_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  ppt: [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  doc: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/plain',
  ],
  video: ['video/'],
  audio: ['audio/'],
  img: ['image/'],
}

const getQuerySchema = z.object({
  type: z.enum(TYPE_ENUM).default('all'),
  level: z.enum(LEVEL_ENUM).default('all'),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(SORT_ENUM).default('recent'),
  section: z.enum(SECTION_ENUM).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

const postSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  level: z.enum(LEVELS_FOR_WRITE).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  is_public: z.boolean().default(false),
  lesson_id: z.string().uuid().optional().nullable(),
})

function safeFileName(name: string): string {
  const base = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file.bin'
}

function fileTypeFromName(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

function mimeMatchesType(mime: string | null | undefined, type: string): boolean {
  if (!mime) return false
  const patterns = TYPE_MIME_MAP[type]
  if (!patterns) return false
  return patterns.some((p) => (p.endsWith('/') ? mime.startsWith(p) : mime === p))
}

function isLinkOnly(row: { file_url: string | null; storage_path: string | null }): boolean {
  return (
    !row.storage_path &&
    !!row.file_url &&
    /^https?:\/\//i.test(row.file_url)
  )
}

// ---------------------------------------------------------------
// GET /api/teacher/materials
// ---------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = getQuerySchema.safeParse({
      type: searchParams.get('type') ?? undefined,
      level: searchParams.get('level') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      section: searchParams.get('section') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { type, level, q, sort, section, limit } = parsed.data

    // Resolve teacher_profile
    const { data: tp, error: tpErr } = await supabase
      .from('teacher_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (tpErr) {
      console.error('Ошибка профиля преподавателя:', tpErr)
      return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 })
    }
    if (!tp) {
      return NextResponse.json({ error: 'Профиль преподавателя не найден' }, { status: 403 })
    }

    // Fetch the full teacher library — table is bounded per-teacher and we need
    // accurate client-side counters across categories/levels.
    const { data: allRows, error } = await supabase
      .from('materials')
      .select(
        'id, title, description, file_type, mime_type, file_size, level, tags, use_count, storage_path, file_url, lesson_id, is_public, created_at'
      )
      .eq('teacher_id', tp.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Ошибка загрузки материалов:', error)
      return NextResponse.json({ error: 'Не удалось загрузить материалы' }, { status: 500 })
    }

    const rows = allRows || []

    // Build facet counters (across full library)
    const counts: Record<string, number> = {
      all: rows.length,
      pdf: 0,
      ppt: 0,
      doc: 0,
      video: 0,
      audio: 0,
      img: 0,
      link: 0,
      'A1-A2': 0,
      B1: 0,
      B2: 0,
      'C1+': 0,
    }
    for (const r of rows) {
      if (isLinkOnly(r)) counts.link += 1
      for (const t of ['pdf', 'ppt', 'doc', 'video', 'audio', 'img']) {
        if (mimeMatchesType(r.mime_type, t)) counts[t] += 1
      }
      if (r.level && counts[r.level] !== undefined) counts[r.level] += 1
    }

    // Apply filters
    let filtered = rows
    if (type !== 'all') {
      if (type === 'link') {
        filtered = filtered.filter(isLinkOnly)
      } else {
        filtered = filtered.filter((r) => mimeMatchesType(r.mime_type, type))
      }
    }
    if (level !== 'all') {
      filtered = filtered.filter((r) => r.level === level)
    }
    if (q && q.length > 0) {
      const needle = q.toLowerCase()
      filtered = filtered.filter((r) =>
        (r.title || '').toLowerCase().includes(needle)
      )
    }

    // Sort
    switch (sort) {
      case 'popular':
        filtered.sort((a, b) => (b.use_count || 0) - (a.use_count || 0))
        break
      case 'name':
        filtered.sort((a, b) =>
          (a.title || '').localeCompare(b.title || '', 'ru', { sensitivity: 'base' })
        )
        break
      case 'size':
        filtered.sort((a, b) => (b.file_size || 0) - (a.file_size || 0))
        break
      case 'recent':
      default:
        filtered.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
    }

    // Section slicing
    let sectionRows = filtered
    if (section === 'recent') {
      sectionRows = [...filtered]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 8)
    } else if (section === 'popular') {
      sectionRows = [...filtered]
        .sort((a, b) => (b.use_count || 0) - (a.use_count || 0))
        .slice(0, 8)
    } else {
      sectionRows = filtered.slice(0, limit)
    }

    // Produce signed URLs for storage-backed materials
    const paths = sectionRows
      .map((r) => r.storage_path)
      .filter((p): p is string => !!p)
    const signedMap: Record<string, string> = {}
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL)
      if (signed) {
        for (const item of signed) {
          if (item?.path && item.signedUrl) {
            signedMap[item.path] = item.signedUrl
          }
        }
      }
    }

    const materials = sectionRows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      file_type: r.file_type,
      mime_type: r.mime_type,
      file_size: r.file_size,
      level: r.level,
      tags: r.tags || [],
      use_count: r.use_count || 0,
      storage_path: r.storage_path,
      file_url: r.file_url,
      lesson_id: r.lesson_id,
      is_public: r.is_public,
      created_at: r.created_at,
      signed_url: r.storage_path ? signedMap[r.storage_path] || null : null,
    }))

    // Storage usage (only counted for rows with storage_path)
    let used_bytes = 0
    let last_uploaded_at: string | null = null
    for (const r of rows) {
      if (r.storage_path && typeof r.file_size === 'number') {
        used_bytes += r.file_size
      }
      if (!last_uploaded_at || new Date(r.created_at) > new Date(last_uploaded_at)) {
        last_uploaded_at = r.created_at
      }
    }

    return NextResponse.json({
      materials,
      counts,
      storage: {
        used_bytes,
        total_bytes: STORAGE_QUOTA_BYTES,
      },
      last_uploaded_at,
    })
  } catch (err) {
    console.error('Непредвиденная ошибка в /api/teacher/materials GET:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// POST /api/teacher/materials
// application/json: client must upload directly to Supabase Storage first,
// then POST metadata (storage_path, file_size, mime_type, file_name, ...).
// This avoids Vercel's 4.5 MB body limit (FUNCTION_PAYLOAD_TOO_LARGE).
// ---------------------------------------------------------------
const postJsonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  level: z.enum(LEVELS_FOR_WRITE).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  is_public: z.boolean().default(false),
  lesson_id: z.string().uuid().optional().nullable(),
  storage_path: z.string().trim().min(1).max(500),
  file_name: z.string().trim().min(1).max(300),
  file_size: z.number().int().min(1).max(MAX_FILE_SIZE),
  mime_type: z.string().trim().min(1).max(150),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Ожидается application/json' },
        { status: 400 }
      )
    }

    const parsed = postJsonSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }
    const {
      title,
      description,
      level,
      tags,
      is_public,
      lesson_id,
      storage_path,
      file_name,
      file_size,
      mime_type,
    } = parsed.data

    // Storage path must start with `<user.id>/` — same constraint RLS enforces.
    if (!storage_path.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: 'Недопустимый путь хранения' },
        { status: 403 }
      )
    }

    // Resolve teacher_profile
    const { data: tp, error: tpErr } = await supabase
      .from('teacher_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (tpErr || !tp) {
      return NextResponse.json(
        { error: 'Профиль преподавателя не найден' },
        { status: 403 }
      )
    }

    if (lesson_id) {
      const { data: lessonRow } = await supabase
        .from('lessons')
        .select('id, teacher_id')
        .eq('id', lesson_id)
        .maybeSingle()
      if (!lessonRow || lessonRow.teacher_id !== tp.id) {
        return NextResponse.json(
          { error: 'Урок не найден или не принадлежит преподавателю' },
          { status: 403 }
        )
      }
    }

    const ext = fileTypeFromName(file_name)

    // Signed URL for immediate client use
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storage_path, SIGNED_URL_TTL)
    const fileUrl = signed?.signedUrl || ''

    const { data: inserted, error: insErr } = await supabase
      .from('materials')
      .insert({
        teacher_id: tp.id,
        lesson_id: lesson_id || null,
        title,
        description: description || null,
        file_url: fileUrl,
        file_type: ext || null,
        file_size,
        is_public,
        level: level || null,
        tags,
        storage_path,
        mime_type,
      })
      .select(
        'id, title, description, file_type, mime_type, file_size, level, tags, use_count, storage_path, file_url, lesson_id, is_public, created_at'
      )
      .single()

    if (insErr) {
      console.error('Ошибка вставки materials:', insErr)
      // Best-effort cleanup of the uploaded object
      await supabase.storage.from(BUCKET).remove([storage_path])
      return NextResponse.json(
        { error: 'Не удалось сохранить материал' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ...inserted,
        signed_url: fileUrl || null,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Непредвиденная ошибка в /api/teacher/materials POST:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
