// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const uuidSchema = z.string().uuid('Некорректный ID пользователя')

// DELETE removes any existing friendship row between me and userId (either direction).
// Use cases: cancel outgoing request, reject incoming request, remove friend, unblock.
export async function DELETE(
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

    const { error: delError, count } = await supabase
      .from('user_friends')
      .delete({ count: 'exact' })
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`
      )
    if (delError) {
      console.error('Ошибка удаления связи:', delError)
      return NextResponse.json({ error: 'Не удалось удалить связь' }, { status: 500 })
    }

    if ((count ?? 0) === 0) {
      return NextResponse.json({ error: 'Связь не найдена' }, { status: 404 })
    }

    return NextResponse.json({ deleted: count, other_user_id: userId })
  } catch (error) {
    console.error('Непредвиденная ошибка в DELETE /api/friends/[userId]:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
