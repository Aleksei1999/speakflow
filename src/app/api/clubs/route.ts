// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clubsListQuerySchema } from '@/lib/validations'

const ROAST_LEVELS = [
  'Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done',
] as const

// Registration statuses that mean the user currently holds a seat / is booked.
// 'cancelled', 'refunded', 'no_show' and historical 'attended' do NOT count as
// "currently registered" from the UI point of view.
const ACTIVE_REG_STATUSES = new Set(['registered', 'pending_payment', 'waitlist'])

function buildInitials(fullName?: string | null): string {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = clubsListQuerySchema.safeParse({
      category: searchParams.get('category') ?? undefined,
      format: searchParams.get('format') ?? undefined,
      level: searchParams.get('level') ?? undefined,
      scope: searchParams.get('scope') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { category, format, level, scope, limit } = parsed.data

    const supabase = await createClient()

    let query = supabase
      .from('clubs')
      .select(
        `
          id, topic, description, category, level_min, level_max,
          format, location, timezone, starts_at, duration_min,
          max_seats, seats_taken, price_kopecks, xp_reward, badge,
          cover_emoji, is_published, cancelled_at,
          club_hosts (
            role, sort_order,
            profiles:host_id ( id, full_name, avatar_url )
          )
        `
      )
      .eq('is_published', true)
      .is('cancelled_at', null)
      .order('starts_at', { ascending: scope !== 'past' })
      .limit(limit)

    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()
    if (scope === 'upcoming') {
      // Include in-progress clubs: a club ends at starts_at + duration_min.
      // Pull anything that started up to 8h ago, then trim by exact end time below.
      const lookbackIso = new Date(nowMs - 8 * 3600 * 1000).toISOString()
      query = query.gt('starts_at', lookbackIso)
    }
    if (scope === 'past') query = query.lt('starts_at', nowIso)

    if (category) query = query.eq('category', category)
    if (format) query = query.eq('format', format)

    const { data: clubs, error } = await query
    if (error) {
      console.error('Ошибка загрузки клубов:', error)
      return NextResponse.json(
        { error: 'Не удалось загрузить клубы' },
        { status: 500 }
      )
    }

    // Level filter applied in-memory: include clubs whose [level_min..level_max] range contains the requested level
    let filtered = clubs ?? []

    // Trim past clubs precisely: a club is "still upcoming/in-progress" while
    // (starts_at + duration_min) > now. Without this, a club at 12:00 with
    // 60min duration disappears at 12:00:01 even though it's running.
    if (scope === 'upcoming') {
      filtered = filtered.filter((c) => {
        const startMs = new Date(c.starts_at).getTime()
        const durMs = (c.duration_min || 60) * 60_000
        return startMs + durMs > nowMs
      })
    }

    if (level) {
      const target = ROAST_LEVELS.indexOf(level)
      filtered = filtered.filter((c) => {
        const min = c.level_min ? ROAST_LEVELS.indexOf(c.level_min) : 0
        const max = c.level_max ? ROAST_LEVELS.indexOf(c.level_max) : ROAST_LEVELS.length - 1
        return target >= min && target <= max
      })
    }

    // Attach viewer's registration status (if logged in)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let myRegs: Record<string, string> = {}
    if (user && filtered.length > 0) {
      const ids = filtered.map((c) => c.id)
      const { data: regs } = await supabase
        .from('club_registrations')
        .select('club_id, status')
        .eq('user_id', user.id)
        .in('club_id', ids)
      if (regs) {
        myRegs = Object.fromEntries(regs.map((r) => [r.club_id, r.status]))
      }
    }

    const result = filtered.map((c) => {
      const hosts = Array.isArray(c.club_hosts) ? [...c.club_hosts] : []
      hosts.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const enrichedHosts = hosts.map((h) => ({
        role: h.role,
        sort_order: h.sort_order,
        profiles: h.profiles
          ? {
              ...h.profiles,
              initials: buildInitials(h.profiles.full_name),
            }
          : null,
      }))
      const regStatus = myRegs[c.id] ?? null
      return {
        ...c,
        club_hosts: enrichedHosts,
        seats_remaining: Math.max(c.max_seats - c.seats_taken, 0),
        is_full: c.seats_taken >= c.max_seats,
        my_registration_status: regStatus,
        is_user_registered: regStatus ? ACTIVE_REG_STATUSES.has(regStatus) : false,
      }
    })

    return NextResponse.json({ clubs: result })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/clubs:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
