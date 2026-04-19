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
        { error: 'Нельзя заблокировать самого себя' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('user_friends')
      .select('user_id, friend_id, status')
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`
      )
      .maybeSingle()

    // Normalize: after block, the row should have user_id=me, friend_id=them, status=blocked.
    if (existing) {
      if (existing.user_id === user.id) {
        const { error: updateError } = await supabase
          .from('user_friends')
          .update({ status: 'blocked', responded_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('friend_id', userId)
        if (updateError) {
          console.error('Ошибка блокировки:', updateError)
          return NextResponse.json({ error: 'Не удалось заблокировать' }, { status: 500 })
        }
      } else {
        // Their outgoing row → delete it and insert my blocking row.
        // Done in two steps because the PK (user_id, friend_id) differs.
        const { error: delError } = await supabase
          .from('user_friends')
          .delete()
          .eq('user_id', userId)
          .eq('friend_id', user.id)
        if (delError) {
          console.error('Ошибка очистки входящей заявки:', delError)
          return NextResponse.json({ error: 'Не удалось заблокировать' }, { status: 500 })
        }
        const { error: insError } = await supabase
          .from('user_friends')
          .insert({
            user_id: user.id,
            friend_id: userId,
            status: 'blocked',
            responded_at: new Date().toISOString(),
          })
        if (insError) {
          console.error('Ошибка установки блокировки:', insError)
          return NextResponse.json({ error: 'Не удалось заблокировать' }, { status: 500 })
        }
      }
    } else {
      const { error: insertError } = await supabase.from('user_friends').insert({
        user_id: user.id,
        friend_id: userId,
        status: 'blocked',
        responded_at: new Date().toISOString(),
      })
      if (insertError) {
        console.error('Ошибка блокировки:', insertError)
        return NextResponse.json({ error: 'Не удалось заблокировать' }, { status: 500 })
      }
    }

    return NextResponse.json({ status: 'blocked', other_user_id: userId })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/friends/[userId]/block:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
