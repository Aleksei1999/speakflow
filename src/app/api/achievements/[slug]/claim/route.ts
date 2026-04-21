// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  computeUserMetrics,
  evaluateAchievementProgress,
} from '@/lib/gamification/metrics'

export async function POST(
  _request: NextRequest,
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
      .from('achievement_definitions')
      .select('id, slug, title, category, threshold, xp_reward')
      .eq('slug', slug)
      .maybeSingle()
    if (defError) {
      console.error('Ошибка загрузки достижения:', defError)
      return NextResponse.json({ error: 'Ошибка загрузки достижения' }, { status: 500 })
    }
    if (!def) {
      return NextResponse.json({ error: 'Достижение не найдено' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id, earned_at')
      .eq('user_id', user.id)
      .eq('achievement_id', def.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'Достижение уже получено', earned_at: existing.earned_at },
        { status: 409 }
      )
    }

    const metrics = await computeUserMetrics(supabase, user.id)
    const current_value = evaluateAchievementProgress(def.slug, def.category, metrics, def.threshold)
    if (current_value < def.threshold) {
      return NextResponse.json(
        {
          error: 'Критерии достижения ещё не выполнены',
          current_value,
          threshold: def.threshold,
        },
        { status: 403 }
      )
    }

    const { error: insertError } = await supabase
      .from('user_achievements')
      .insert({ user_id: user.id, achievement_id: def.id })
    if (insertError) {
      console.error('Ошибка присвоения достижения:', insertError)
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Достижение уже получено' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Не удалось присвоить достижение' }, { status: 500 })
    }

    if (def.xp_reward > 0) {
      await supabase.from('xp_events').insert({
        user_id: user.id,
        amount: def.xp_reward,
        source_type: 'achievement',
        source_id: def.id,
      })
    }

    return NextResponse.json({
      achievement_id: def.id,
      slug: def.slug,
      title: def.title,
      xp_awarded: def.xp_reward,
      earned_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/achievements/[slug]/claim:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
