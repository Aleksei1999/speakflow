// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  computeUserMetrics,
  evaluateClaimCriteria,
} from '@/lib/gamification/metrics'

const deliverySchema = z
  .object({
    name: z.string().min(1).max(200),
    phone: z.string().min(5).max(50),
    address: z.string().min(1).max(500),
    city: z.string().min(1).max(200),
    country: z.string().min(1).max(100),
    notes: z.string().max(500).optional(),
  })
  .partial({ notes: true })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug || slug.length > 100) {
      return NextResponse.json({ error: 'Некорректный slug' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    const { data: def, error: defError } = await supabase
      .from('reward_definitions')
      .select('id, slug, title, reward_type, claim_criteria, is_active')
      .eq('slug', slug)
      .maybeSingle()
    if (defError) {
      console.error('Ошибка загрузки награды:', defError)
      return NextResponse.json({ error: 'Ошибка загрузки награды' }, { status: 500 })
    }
    if (!def || !def.is_active) {
      return NextResponse.json({ error: 'Награда не найдена' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('user_rewards')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('reward_id', def.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'Вы уже получили эту награду', status: existing.status },
        { status: 409 }
      )
    }

    const metrics = await computeUserMetrics(supabase, user.id)
    if (!evaluateClaimCriteria(def.claim_criteria, metrics)) {
      return NextResponse.json(
        { error: 'Критерии для получения награды пока не выполнены' },
        { status: 403 }
      )
    }

    // Physical rewards require delivery details up front
    let delivery_json: any = null
    if (def.reward_type === 'physical') {
      let body: any = {}
      try {
        body = await request.json()
      } catch {
        body = {}
      }
      const parsed = deliverySchema.safeParse(body?.delivery ?? body)
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ||
              'Для физической награды нужны адрес, имя, телефон',
          },
          { status: 400 }
        )
      }
      delivery_json = parsed.data
    }

    const { data: inserted, error: insertError } = await supabase
      .from('user_rewards')
      .insert({
        user_id: user.id,
        reward_id: def.id,
        status: 'awarded',
        delivery_json,
      })
      .select('id, status, awarded_at')
      .single()
    if (insertError) {
      console.error('Ошибка получения награды:', insertError)
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Вы уже получили эту награду' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Не удалось получить награду' }, { status: 500 })
    }

    return NextResponse.json({
      user_reward_id: inserted.id,
      slug: def.slug,
      title: def.title,
      reward_type: def.reward_type,
      status: inserted.status,
      awarded_at: inserted.awarded_at,
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/rewards/[slug]/claim:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
