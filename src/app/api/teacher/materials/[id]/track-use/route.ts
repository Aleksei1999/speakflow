// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const idSchema = z.string().uuid({ message: 'Некорректный идентификатор' })

// POST /api/teacher/materials/[id]/track-use
// Increments use_count via RPC. Ownership is enforced inside the function.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idParsed = idSchema.safeParse(id)
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.issues[0].message }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('increment_material_use', {
      p_material_id: id,
    })
    if (error) {
      // 42501 (insufficient_privilege) is used when caller is not the owner
      // or teacher_profile is missing. Map to 403.
      if (error.code === '42501') {
        return NextResponse.json(
          { error: 'Материал не найден или доступ запрещён' },
          { status: 403 }
        )
      }
      console.error('Ошибка increment_material_use:', error)
      return NextResponse.json(
        { error: 'Не удалось обновить счётчик' },
        { status: 500 }
      )
    }

    return NextResponse.json({ use_count: Number(data) })
  } catch (err) {
    console.error('Непредвиденная ошибка track-use:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
