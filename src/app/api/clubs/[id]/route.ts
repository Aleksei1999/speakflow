// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const uuidSchema = z.string().uuid('Некорректный ID клуба')

export async function GET(
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

    const { data: club, error } = await supabase
      .from('clubs')
      .select(
        `
          id, topic, description, category, level_min, level_max,
          format, location, timezone, starts_at, duration_min,
          max_seats, seats_taken, price_kopecks, xp_reward, badge,
          cover_emoji, meeting_url, is_published, cancelled_at,
          club_hosts (
            role, sort_order,
            profiles:host_id ( id, full_name, avatar_url )
          )
        `
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Ошибка загрузки клуба:', error)
      return NextResponse.json({ error: 'Не удалось загрузить клуб' }, { status: 500 })
    }
    if (!club) {
      return NextResponse.json({ error: 'Клуб не найден' }, { status: 404 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let myRegistration = null
    let canSeeMeetingUrl = false
    if (user) {
      const { data: reg } = await supabase
        .from('club_registrations')
        .select('id, status, registered_at, cancelled_at')
        .eq('club_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
      myRegistration = reg
      canSeeMeetingUrl =
        !!reg && ['registered', 'attended'].includes(reg.status)
    }

    return NextResponse.json({
      club: {
        ...club,
        meeting_url: canSeeMeetingUrl ? club.meeting_url : null,
        seats_remaining: Math.max(club.max_seats - club.seats_taken, 0),
      },
      my_registration: myRegistration,
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/clubs/[id]:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
