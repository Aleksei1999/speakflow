// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const uuidSchema = z.string().uuid('Некорректный ID клуба')

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const parsed = uuidSchema.safeParse(id)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    const { data: reg, error: regError } = await supabase
      .from('club_registrations')
      .select('id, status, club:clubs!inner ( starts_at )')
      .eq('club_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (regError) {
      console.error('Ошибка загрузки регистрации:', regError)
      return NextResponse.json({ error: 'Ошибка загрузки регистрации' }, { status: 500 })
    }
    if (!reg) {
      return NextResponse.json({ error: 'Регистрация не найдена' }, { status: 404 })
    }
    if (['cancelled', 'refunded', 'attended', 'no_show'].includes(reg.status)) {
      return NextResponse.json(
        { error: 'Эту регистрацию уже нельзя отменить' },
        { status: 409 }
      )
    }
    if (new Date(reg.club.starts_at) <= new Date()) {
      return NextResponse.json(
        { error: 'Клуб уже начался — отмена невозможна' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('club_registrations')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', reg.id)
    if (updateError) {
      console.error('Ошибка отмены регистрации:', updateError)
      return NextResponse.json({ error: 'Не удалось отменить регистрацию' }, { status: 500 })
    }

    return NextResponse.json({ registration_id: reg.id, status: 'cancelled' })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/clubs/[id]/cancel:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
