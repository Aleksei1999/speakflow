import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { leaderboardQuerySchema } from '@/lib/validations'
import { cacheStatic, REDIS_KEYS } from '@/lib/cache/redis-cache'

// Дефолтный leaderboard (period=weekly, без фильтров, без friends_only)
// — самая частая комбинация: /student дашборд + общий обзор /student/leaderboard.
// Эти данные одинаковы для всех зрителей (зависят только от запроса),
// поэтому кладём их в глобальный Redis-кеш на 60 sec. Любые
// фильтрованные / per-user варианты обходят кеш.
async function loadDefaultLeaderboardRows(fetchLimit: number): Promise<any[]> {
  const admin = createAdminClient()
  // FIXME(types): RPC 'get_leaderboard' missing in Database type
  const { data, error } = await (admin.rpc as any)('get_leaderboard', {
    p_period: 'weekly',
    p_level: null,
    p_friends_only: false,
    p_limit: fetchLimit,
  })
  if (error) {
    console.error('[leaderboard] cache loader RPC failed:', error)
    throw error
  }
  return data ?? []
}

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

    // Лидерборд тянем с запасом (+10 на хвост), чтобы после фильтрации
    // админов всё равно осталось ~limit реальных учеников. Дёшево — RPC и
    // так возвращает 50 строк, а добавочные 10 — копейки.
    const fetchLimit = Math.max(limit, 0) + 10

    // Дефолтный (period=weekly, без фильтров) — отвечаем из Redis-кеша.
    // Фильтрованные / friends_only варианты гоняем напрямую — они per-user
    // или per-level, кешировать их в global Redis смысла нет.
    let data: any[] | null = null
    let rpcError: unknown = null
    const isCacheable =
      period === 'weekly' && !level && !friends_only && fetchLimit <= 110
    if (isCacheable) {
      try {
        data = await cacheStatic(
          `${REDIS_KEYS.leaderboardWeeklyDefault}:${fetchLimit}`,
          60,
          () => loadDefaultLeaderboardRows(fetchLimit)
        )
      } catch (e) {
        rpcError = e
      }
    } else {
      // FIXME(types): RPC 'get_leaderboard' missing in Database type
      const res = await (supabase.rpc as any)('get_leaderboard', {
        p_period: period,
        p_level: level ?? null,
        p_friends_only: friends_only,
        p_limit: fetchLimit,
      })
      data = res.data
      rpcError = res.error
    }
    if (rpcError) {
      console.error('Ошибка получения лидерборда:', rpcError)
      return NextResponse.json({ error: 'Не удалось загрузить лидерборд' }, { status: 500 })
    }

    // Отфильтровываем админов: они часто попадают в топ-3 от тестовых
    // действий и портят картинку для учеников. RPC роль не возвращает —
    // делаем второй дешёвый запрос по списку user_id и убираем role='admin'.
    // Если запрос упадёт — деградируем graceful: показываем как было.
    const candidateIds = (data ?? []).map((r: any) => r.out_user_id).filter(Boolean)
    let adminIds = new Set<string>()
    if (candidateIds.length > 0) {
      const { data: roleRows, error: roleErr } = await supabase
        .from('profiles')
        .select('id, role')
        .in('id', candidateIds)
        .eq('role', 'admin')
      if (!roleErr) {
        adminIds = new Set((roleRows ?? []).map((p: any) => String(p.id)))
      }
    }

    // После фильтрации админов перенумеровываем rank — иначе на странице
    // получим пропуски (#1, #3, #4). 50 строк — O(50), пофиг.
    const filtered = (data ?? []).filter((r: any) => !adminIds.has(String(r.out_user_id)))
    const rows = filtered.slice(0, limit).map((r: any, idx: number) => ({
      rank: idx + 1,
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

    // Viewer's own row (even if not in top N).
    // Rank считаем уже по полному списку с вырезанными админами — иначе
    // строка «ты на месте #87» бессмысленна, когда в #1-3 сидят сотрудники.
    let me: (typeof rows)[number] | null = null
    if (user) {
      const inTop = rows.find((r) => r.user_id === user.id)
      if (inTop) {
        me = inTop
      } else {
        // FIXME(types): RPC 'get_leaderboard' missing in Database type
        const { data: meData } = await (supabase.rpc as any)('get_leaderboard', {
          p_period: period,
          p_level: null,
          p_friends_only: false,
          p_limit: 100000,
        })
        const fullList = meData ?? []
        // Подтягиваем role для всех user_id в полном списке. На 100k это
        // тяжело — но RPC и так возвращает только активных. На MVP-объёме
        // (десятки строк) — один select.
        let fullAdmins = new Set<string>()
        const fullIds = fullList.map((r: any) => r.out_user_id).filter(Boolean)
        if (fullIds.length > 0) {
          const { data: roleRows2, error: roleErr2 } = await supabase
            .from('profiles')
            .select('id, role')
            .in('id', fullIds)
            .eq('role', 'admin')
          if (!roleErr2) {
            fullAdmins = new Set((roleRows2 ?? []).map((p: any) => String(p.id)))
          }
        }
        const cleanFull = fullList.filter((r: any) => !fullAdmins.has(String(r.out_user_id)))
        const myIdx = cleanFull.findIndex((r: any) => r.out_user_id === user.id)
        if (myIdx >= 0) {
          const mine = cleanFull[myIdx] as any
          me = {
            rank: myIdx + 1,
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
