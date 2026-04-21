// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const querySchema = z.object({
  scope: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  status: z
    .enum([
      'pending_payment', 'registered', 'waitlist',
      'attended', 'no_show', 'cancelled', 'refunded',
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      scope: searchParams.get('scope') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { scope, status, limit } = parsed.data

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    let query = supabase
      .from('club_registrations')
      .select(
        `
          id, status, registered_at, attended_at, cancelled_at,
          club:clubs!inner (
            id, topic, description, category, level_min, level_max,
            format, location, timezone,
            starts_at, duration_min, price_kopecks, xp_reward, badge,
            cover_emoji, cancelled_at, meeting_url, max_seats, seats_taken,
            club_hosts (
              role, sort_order,
              profiles:host_id ( id, full_name, avatar_url )
            )
          )
        `
      )
      .eq('user_id', user.id)
      .order('registered_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)

    const nowIso = new Date().toISOString()
    if (scope === 'upcoming') query = query.gte('club.starts_at', nowIso)
    if (scope === 'past') query = query.lt('club.starts_at', nowIso)

    const { data: regs, error } = await query
    if (error) {
      console.error('Ошибка загрузки регистраций:', error)
      return NextResponse.json({ error: 'Не удалось загрузить регистрации' }, { status: 500 })
    }

    const buildInitials = (fullName?: string | null): string => {
      if (!fullName) return ''
      const parts = fullName.trim().split(/\s+/).slice(0, 2)
      return parts.map((p) => p.charAt(0).toUpperCase()).join('')
    }

    const result = (regs ?? []).map((r) => {
      if (!r.club) return { ...r, club: null }
      const hosts = Array.isArray(r.club.club_hosts) ? [...r.club.club_hosts] : []
      hosts.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const enrichedHosts = hosts.map((h) => ({
        role: h.role,
        sort_order: h.sort_order,
        profiles: h.profiles
          ? { ...h.profiles, initials: buildInitials(h.profiles.full_name) }
          : null,
      }))
      return {
        ...r,
        club: {
          ...r.club,
          club_hosts: enrichedHosts,
          // meeting_url виден только тем, чей статус даёт доступ
          meeting_url: ['registered', 'attended'].includes(r.status)
            ? r.club.meeting_url
            : null,
          seats_remaining: Math.max(r.club.max_seats - r.club.seats_taken, 0),
          is_full: r.club.seats_taken >= r.club.max_seats,
        },
      }
    })

    return NextResponse.json({ registrations: result })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/clubs/mine:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
