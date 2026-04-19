// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  computeUserMetrics,
  evaluateClaimCriteria,
} from '@/lib/gamification/metrics'

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: defs, error } = await supabase
      .from('reward_definitions')
      .select(
        'id, slug, title, description, icon_emoji, reward_type, claim_criteria, sort_order'
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('Ошибка загрузки наград:', error)
      return NextResponse.json({ error: 'Не удалось загрузить награды' }, { status: 500 })
    }

    if (!user) {
      const anon = (defs ?? []).map((d) => ({
        ...d,
        is_eligible: false,
        already_claimed: false,
        claimed_status: null,
      }))
      return NextResponse.json({ rewards: anon })
    }

    const [metrics, claimedRes] = await Promise.all([
      computeUserMetrics(supabase, user.id),
      supabase
        .from('user_rewards')
        .select('reward_id, status')
        .eq('user_id', user.id),
    ])

    const claimedMap = new Map<string, string>(
      (claimedRes.data ?? []).map((r: any) => [r.reward_id, r.status])
    )

    const result = (defs ?? []).map((d) => ({
      ...d,
      is_eligible: evaluateClaimCriteria(d.claim_criteria, metrics),
      already_claimed: claimedMap.has(d.id),
      claimed_status: claimedMap.get(d.id) ?? null,
    }))

    return NextResponse.json({ rewards: result, metrics })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/rewards:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
