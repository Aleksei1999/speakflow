// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const uuidSchema = z.string().uuid('Некорректный ID пользователя')

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const parsed = uuidSchema.safeParse(userId)
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

    // Incoming request: they are user_id, I am friend_id, status=pending
    const { data: existing } = await supabase
      .from('user_friends')
      .select('user_id, friend_id, status')
      .eq('user_id', userId)
      .eq('friend_id', user.id)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 })
    }
    if (existing.status === 'accepted') {
      return NextResponse.json(
        { error: 'Заявка уже принята', status: 'accepted' },
        { status: 409 }
      )
    }
    if (existing.status === 'blocked') {
      return NextResponse.json({ error: 'Связь заблокирована' }, { status: 409 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('user_friends')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('friend_id', user.id)
      .select('user_id, friend_id, status, created_at, responded_at')
      .single()
    if (updateError) {
      console.error('Ошибка принятия заявки:', updateError)
      return NextResponse.json({ error: 'Не удалось принять заявку' }, { status: 500 })
    }

    return NextResponse.json({ friendship: updated })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/friends/[userId]/accept:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
