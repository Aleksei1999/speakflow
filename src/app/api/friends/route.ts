// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const querySchema = z.object({
  scope: z
    .enum(['all', 'accepted', 'pending_outgoing', 'pending_incoming', 'blocked'])
    .default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      scope: searchParams.get('scope') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { scope, limit } = parsed.data

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    // RLS already restricts rows to ones involving me, so OR-filter is just ergonomic.
    const { data: rows, error } = await supabase
      .from('user_friends')
      .select(
        `
          user_id, friend_id, status, created_at, responded_at,
          requester:profiles!user_friends_user_id_fkey ( id, full_name, avatar_url ),
          recipient:profiles!user_friends_friend_id_fkey ( id, full_name, avatar_url )
        `
      )
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('Ошибка загрузки друзей:', error)
      return NextResponse.json({ error: 'Не удалось загрузить друзей' }, { status: 500 })
    }

    const mapped = (rows ?? []).map((r) => {
      const iAmRequester = r.user_id === user.id
      const other = iAmRequester ? r.recipient : r.requester
      let relation: string
      if (r.status === 'accepted') relation = 'accepted'
      else if (r.status === 'blocked') relation = iAmRequester ? 'blocked_by_me' : 'blocked_by_other'
      else relation = iAmRequester ? 'pending_outgoing' : 'pending_incoming'
      return {
        other_user_id: iAmRequester ? r.friend_id : r.user_id,
        other,
        status: r.status,
        relation,
        created_at: r.created_at,
        responded_at: r.responded_at,
      }
    })

    const filtered = (() => {
      switch (scope) {
        case 'accepted': return mapped.filter((m) => m.relation === 'accepted')
        case 'pending_outgoing': return mapped.filter((m) => m.relation === 'pending_outgoing')
        case 'pending_incoming': return mapped.filter((m) => m.relation === 'pending_incoming')
        case 'blocked': return mapped.filter((m) => m.relation === 'blocked_by_me')
        default: return mapped
      }
    })()

    const counts = {
      accepted: mapped.filter((m) => m.relation === 'accepted').length,
      pending_outgoing: mapped.filter((m) => m.relation === 'pending_outgoing').length,
      pending_incoming: mapped.filter((m) => m.relation === 'pending_incoming').length,
      blocked: mapped.filter((m) => m.relation === 'blocked_by_me').length,
    }

    return NextResponse.json({ friends: filtered, counts })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/friends:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
