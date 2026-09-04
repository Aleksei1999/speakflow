// GET  /api/lectures         — список published лекций scheduled_at ≥ now (для всех)
// POST /api/lectures (admin) — создать лекцию (multipart: title, description, tag, host_name, scheduled_at, slot, cover)

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'lecture-covers'
const MAX_BYTES = 10 * 1024 * 1024

function sanitize(raw: string) {
  return raw.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'file'
}

export async function GET() {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  const { data, error } = await (supabase as any)
    .from('lectures')
    .select('id, title, description, host_name, scheduled_at, duration_minutes, cover_url, tag, capacity, slot, price')
    .eq('is_published', true)
    .gte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lectures: data ?? [] })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((profile as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
    }

    const fd = await request.formData()
    const title = String(fd.get('title') ?? '').trim()
    const hostName = String(fd.get('host_name') ?? '').trim() || null
    const description = String(fd.get('description') ?? '').trim() || null
    const tag = String(fd.get('tag') ?? '').trim() || null
    const scheduledAt = String(fd.get('scheduled_at') ?? '').trim()
    const slot = String(fd.get('slot') ?? 'small').trim()
    const duration = Number.parseInt(String(fd.get('duration_minutes') ?? '60'), 10) || 60
    const price = Number.parseInt(String(fd.get('price') ?? '0'), 10) || 0
    const cover = fd.get('cover')

    if (!title) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
    if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
      return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
    }
    if (!['main', 'tall', 'small'].includes(slot)) {
      return NextResponse.json({ error: 'Неверный slot (main/tall/small)' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    let storagePath: string | null = null
    let coverUrl: string | null = null
    if (cover instanceof File && cover.size > 0) {
      if (cover.size > MAX_BYTES) {
        return NextResponse.json({ error: 'Обложка больше 10 МБ' }, { status: 400 })
      }
      const ts = Date.now()
      storagePath = `${ts}_${sanitize(cover.name)}`
      const bytes = new Uint8Array(await cover.arrayBuffer())
      const up = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
        contentType: cover.type || 'application/octet-stream',
        upsert: false,
      })
      if (up.error) {
        console.error('[lectures POST] cover upload', up.error)
        return NextResponse.json({ error: 'Ошибка загрузки обложки' }, { status: 500 })
      }
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
      coverUrl = pub?.publicUrl ?? null
    }

    const { data: inserted, error: insErr } = await admin
      .from('lectures')
      .insert({
        title,
        host_name: hostName,
        description,
        tag,
        scheduled_at: new Date(scheduledAt).toISOString(),
        slot,
        duration_minutes: duration,
        price,
        cover_url: coverUrl,
        storage_path: storagePath,
        is_published: true,
      })
      .select('id')
      .single()
    if (insErr || !inserted?.id) {
      if (storagePath) await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {})
      console.error('[lectures POST] insert', insErr)
      return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: inserted.id })
  } catch (e) {
    console.error('[api/lectures][POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
