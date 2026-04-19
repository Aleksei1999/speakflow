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

    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Нельзя отправить заявку самому себе' },
        { status: 400 }
      )
    }

    const { data: target } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    if (!target) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Existing row in either direction?
    const { data: existing } = await supabase
      .from('user_friends')
      .select('user_id, friend_id, status')
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`
      )
      .maybeSingle()
    if (existing) {
      if (existing.status === 'accepted') {
        return NextResponse.json(
          { error: 'Вы уже друзья', status: 'accepted' },
          { status: 409 }
        )
      }
      if (existing.status === 'blocked') {
        return NextResponse.json(
          { error: 'Связь заблокирована' },
          { status: 409 }
        )
      }
      // pending
      const iAmRequester = existing.user_id === user.id
      return NextResponse.json(
        {
          error: iAmRequester
            ? 'Заявка уже отправлена'
            : 'Этот пользователь уже отправил вам заявку — примите её',
          status: 'pending',
          direction: iAmRequester ? 'outgoing' : 'incoming',
        },
        { status: 409 }
      )
    }

    const { data: inserted, error: insertError } = await supabase
      .from('user_friends')
      .insert({
        user_id: user.id,
        friend_id: userId,
        status: 'pending',
      })
      .select('user_id, friend_id, status, created_at')
      .single()
    if (insertError) {
      console.error('Ошибка создания заявки:', insertError)
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Заявка уже существует' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Не удалось отправить заявку' }, { status: 500 })
    }

    return NextResponse.json({ friendship: inserted })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/friends/[userId]/request:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
