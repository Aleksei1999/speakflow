// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createSignedUrlMap } from '@/lib/supabase/signed-url'
import { getCachedStudentMaterials } from '@/lib/cache/dashboard'
import { enforceRateLimit, getClientIp } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

const BUCKET = 'teacher-materials'

const TYPE_ENUM = ['all', 'pdf', 'ppt', 'doc', 'video', 'audio', 'img', 'link'] as const
const LEVEL_ENUM = ['all', 'A1-A2', 'B1', 'B2', 'C1+'] as const
const SORT_ENUM = ['recent', 'popular', 'name', 'size'] as const

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
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

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
// GET /api/student/materials
// Returns every material the current user can read (RLS handles the
// union of public / lesson-participant / share-recipient).
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
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { type, level, q, sort, limit } = parsed.data

    // Rate-limit (fail-open для read endpoint).
    const limited = await enforceRateLimit(request, {
      name: 'api:student-materials',
      keyParts: [user.id, getClientIp(request)],
      max: 60,
      windowSeconds: 60,
    })
    if (limited) return limited

    // Cached snapshot — RLS-equivalent логика хранится в loader'е
    // (public / lesson-participant / shares). TTL 60s + per-user tag.
    // Это снимает раз-в-минуту heavy fan-out на 5 параллельных
    // запросов в Postgres при каждом hit /student/materials.
    const snapshot = await getCachedStudentMaterials(user.id)
    const all = snapshot.rows || []

    const counts: Record<string, number> = {
      all: all.length,
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
    for (const r of all) {
      if (isLinkOnly(r)) counts.link += 1
      for (const t of ['pdf', 'ppt', 'doc', 'video', 'audio', 'img']) {
        if (mimeMatchesType(r.mime_type, t)) counts[t] += 1
      }
      if (r.level && counts[r.level] !== undefined) counts[r.level] += 1
    }

    let filtered = all
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
      filtered = filtered.filter((r) => (r.title || '').toLowerCase().includes(needle))
    }

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

    const sliced = filtered.slice(0, limit)
    const paths = sliced
      .map((r) => r.storage_path)
      .filter((p): p is string => !!p)

    // Signed URLs via helper: TTL clamped to [60, 3600] (default 3600s).
    const signedMap = await createSignedUrlMap(supabase, BUCKET, paths)

    const materials = sliced.map((r) => ({
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

    return NextResponse.json(
      { materials, counts },
      {
        headers: {
          // TanStack Query управляет client-side кэшем — HTTP-кэш
          // конфликтовал бы. Server cache внутри getCachedStudentMaterials
          // (TTL 60s) уже даёт быстрый ответ.
          'Cache-Control': 'private, no-store',
        }
      }
    )
  } catch (err) {
    console.error('[api/student/materials]', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
