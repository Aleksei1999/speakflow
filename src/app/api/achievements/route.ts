// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  computeUserMetrics,
  evaluateAchievementProgress,
} from '@/lib/gamification/metrics'

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: defs, error } = await supabase
      .from('achievement_definitions')
      .select(
        'id, slug, title, description, category, rarity, icon_emoji, threshold, xp_reward, reward_type, reward_label, is_hidden, sort_order'
      )
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('Ошибка загрузки достижений:', error)
      return NextResponse.json({ error: 'Не удалось загрузить достижения' }, { status: 500 })
    }

    // Anonymous viewers get bare definitions (no progress)
    if (!user) {
      const anon = (defs ?? [])
        .filter((d) => !d.is_hidden)
        .map((d) => ({
          ...d,
          current_value: 0,
          is_earned: false,
          is_claimable: false,
          earned_at: null,
        }))
      return NextResponse.json({ achievements: anon })
    }

    const [metrics, earnedRes] = await Promise.all([
      computeUserMetrics(supabase, user.id),
      supabase
        .from('user_achievements')
        .select('achievement_id, earned_at')
        .eq('user_id', user.id),
    ])

    const earnedMap = new Map<string, string>(
      (earnedRes.data ?? []).map((r: any) => [r.achievement_id, r.earned_at])
    )

    const result = (defs ?? [])
      .filter((d) => !d.is_hidden || earnedMap.has(d.id))
      .map((d) => {
        const current_value = evaluateAchievementProgress(d.slug, d.category, metrics, d.threshold)
        const is_earned = earnedMap.has(d.id)
        const meets = current_value >= d.threshold
        return {
          ...d,
          current_value,
          is_earned,
          earned_at: is_earned ? earnedMap.get(d.id) : null,
          is_claimable: !is_earned && meets,
        }
      })

    return NextResponse.json({ achievements: result, metrics })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/achievements:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
