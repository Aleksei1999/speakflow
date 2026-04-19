// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leaderboardQuerySchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = leaderboardQuerySchema.safeParse({
      period: searchParams.get('period') ?? undefined,
      level: searchParams.get('level') ?? undefined,
      friends_only: searchParams.get('friends_only') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { period, level, friends_only, limit } = parsed.data

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (friends_only && !user) {
      return NextResponse.json(
        { error: 'Фильтр «только друзья» требует авторизации' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_period: period,
      p_level: level ?? null,
      p_friends_only: friends_only,
      p_limit: limit,
    })
    if (error) {
      console.error('Ошибка получения лидерборда:', error)
      return NextResponse.json({ error: 'Не удалось загрузить лидерборд' }, { status: 500 })
    }

    const rows = (data ?? []).map((r) => ({
      rank: Number(r.out_rank),
      user_id: r.out_user_id,
      xp: r.out_xp,
      full_name: r.out_full_name,
      avatar_url: r.out_avatar_url,
      english_level: r.out_english_level,
      current_streak: r.out_current_streak,
      longest_streak: r.out_longest_streak,
      clubs_attended: r.out_clubs_attended,
      is_me: user ? r.out_user_id === user.id : false,
    }))

    // Viewer's own row (even if not in top N)
    let me: (typeof rows)[number] | null = null
    if (user) {
      const inTop = rows.find((r) => r.user_id === user.id)
      if (inTop) {
        me = inTop
      } else {
        const { data: meData } = await supabase.rpc('get_leaderboard', {
          p_period: period,
          p_level: null,
          p_friends_only: false,
          p_limit: 100000,
        })
        const mine = (meData ?? []).find((r: any) => r.out_user_id === user.id)
        if (mine) {
          me = {
            rank: Number(mine.out_rank),
            user_id: mine.out_user_id,
            xp: mine.out_xp,
            full_name: mine.out_full_name,
            avatar_url: mine.out_avatar_url,
            english_level: mine.out_english_level,
            current_streak: mine.out_current_streak,
            longest_streak: mine.out_longest_streak,
            clubs_attended: mine.out_clubs_attended,
            is_me: true,
          }
        }
      }
    }

    return NextResponse.json({ period, rows, me })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/leaderboard:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
