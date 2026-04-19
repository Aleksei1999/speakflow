// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const uuidSchema = z.string().uuid('Некорректный ID клуба')

export async function POST(
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('id, starts_at, cancelled_at, is_published, max_seats, seats_taken, price_kopecks')
      .eq('id', id)
      .maybeSingle()
    if (clubError) {
      console.error('Ошибка загрузки клуба:', clubError)
      return NextResponse.json({ error: 'Ошибка загрузки клуба' }, { status: 500 })
    }
    if (!club || !club.is_published) {
      return NextResponse.json({ error: 'Клуб не найден' }, { status: 404 })
    }
    if (club.cancelled_at) {
      return NextResponse.json({ error: 'Клуб отменён' }, { status: 410 })
    }
    if (new Date(club.starts_at) <= new Date()) {
      return NextResponse.json(
        { error: 'Регистрация на прошедший клуб невозможна' },
        { status: 400 }
      )
    }
    if (club.seats_taken >= club.max_seats) {
      return NextResponse.json(
        { error: 'Все места заняты' },
        { status: 409 }
      )
    }

    const { data: existing } = await supabase
      .from('club_registrations')
      .select('id, status')
      .eq('club_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'Вы уже зарегистрированы на этот клуб', registration_id: existing.id, status: existing.status },
        { status: 409 }
      )
    }

    const isFree = club.price_kopecks === 0
    const initialStatus = isFree ? 'registered' : 'pending_payment'

    const { data: reg, error: insertError } = await supabase
      .from('club_registrations')
      .insert({
        club_id: id,
        user_id: user.id,
        status: initialStatus,
      })
      .select('id, status, registered_at')
      .single()
    if (insertError) {
      console.error('Ошибка создания регистрации:', insertError)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Вы уже зарегистрированы на этот клуб' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Не удалось зарегистрироваться' }, { status: 500 })
    }

    return NextResponse.json({
      registration_id: reg.id,
      status: reg.status,
      is_free: isFree,
      // YooKassa ещё не подключена — платёжный URL появится позже
      payment_url: null,
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/clubs/[id]/register:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
