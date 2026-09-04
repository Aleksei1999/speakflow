// ---------------------------------------------------------------------------
// GET /api/teacher/student-homework?studentId=<uuid>
//
// Возвращает materials учителя, привязанные к конкретному ученику через
// material_shares(target_type='student'). Это «личная домашка» — файлы,
// которые видит только этот ученик (в отличие от библиотеки — там public).
//
// Auth: teacher/admin. Owner-check: material.teacher_id = teacher_profiles.id.
// ---------------------------------------------------------------------------

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSignedUrl } from '@/lib/supabase/signed-url'

const querySchema = z.object({
  studentId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = (profile as { role: string } | null)?.role
    if (role !== 'teacher' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const params = Object.fromEntries(request.nextUrl.searchParams)
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Bad query' },
        { status: 400 }
      )
    }
    const { studentId, limit } = parsed.data

    const admin = createAdminClient() as any

    const { data: tp } = await admin
      .from('teacher_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    const teacherProfileId = (tp as { id: string } | null)?.id
    if (!teacherProfileId && role !== 'admin') {
      return NextResponse.json({ error: 'teacher_profiles not found' }, { status: 403 })
    }

    // material_shares → material_ids для этого студента.
    const { data: shares } = await admin
      .from('material_shares')
      .select('material_id, created_at')
      .eq('target_type', 'student')
      .eq('target_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit)
    const materialIds = ((shares ?? []) as Array<{ material_id: string }>)
      .map((s) => s.material_id)
      .filter(Boolean)
    if (!materialIds.length) {
      return NextResponse.json({ materials: [] })
    }

    let matsQuery = admin
      .from('materials')
      .select('id, title, storage_path, file_url, mime_type, file_size, created_at, teacher_id')
      .in('id', materialIds)
    if (teacherProfileId) matsQuery = matsQuery.eq('teacher_id', teacherProfileId)

    const { data: mats } = await matsQuery
    const rows = (mats ?? []) as Array<{
      id: string
      title: string
      storage_path: string | null
      file_url: string | null
      mime_type: string | null
      file_size: number | null
      created_at: string
    }>

    const materials = await Promise.all(
      rows.map(async (m) => {
        let signed_url: string | null = null
        if (m.storage_path) {
          try {
            const { signedUrl } = await createSignedUrl(supabase, 'teacher-materials', m.storage_path, {
              expiresIn: 3600,
            })
            signed_url = signedUrl
          } catch (e) {
            console.warn('[student-homework] sign url failed', m.storage_path, e)
          }
        }
        return {
          id: m.id,
          title: m.title,
          mime_type: m.mime_type,
          file_size: m.file_size,
          created_at: m.created_at,
          signed_url: signed_url ?? m.file_url,
        }
      })
    )
    // Сохраняем порядок из shares (свежие сверху).
    const order = new Map(materialIds.map((id, i) => [id, i]))
    materials.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

    return NextResponse.json({ materials })
  } catch (e) {
    console.error('[teacher/student-homework][GET] error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
