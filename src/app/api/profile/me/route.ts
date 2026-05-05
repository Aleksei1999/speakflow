// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  LEVEL_XP_THRESHOLDS,
  ROAST_LEVELS,
  xpToRoastLevel,
  getLevelCEFR,
  type RoastLevel,
} from '@/lib/level-utils'
import { invalidateProfile } from '@/lib/cache/invalidate'

// ---------------------------------------------------------------------------
// GET /api/profile/me
// Aggregated snapshot used by /student/profile page.
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    const [
      profileRes,
      progressRes,
      clubsRes,
      lessonsRes,
      achRes,
      favTeacherRes,
      paymentsRes,
      bonusesRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, email, first_name, last_name, full_name, avatar_url, phone, timezone, created_at, balance_rub, subscription_tier, subscription_until, city, occupation, english_goal, interests'
        )
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('user_progress')
        .select(
          'total_xp, current_streak, longest_streak, lessons_completed, english_level, last_lesson_date'
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('club_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'attended'),
      // Completed lessons — sum duration + count
      supabase
        .from('lessons')
        .select('duration_minutes, teacher_id, scheduled_at, status')
        .eq('student_id', user.id)
        .eq('status', 'completed'),
      // Achievement count
      supabase
        .from('user_achievements')
        .select('achievement_id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      // Favorite teacher — most completed lessons
      supabase.rpc('get_favorite_teacher', { p_student: user.id }).maybeSingle(),
      // Payment history (own lessons)
      supabase
        .from('payments')
        .select('id, amount, currency, status, paid_at, created_at, metadata, lesson_id')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      // XP bonuses shown in history
      supabase
        .from('xp_events')
        .select('id, amount, source_type, source_id, description, created_at')
        .eq('user_id', user.id)
        .eq('source_type', 'achievement')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (profileRes.error || !profileRes.data) {
      console.error('Ошибка загрузки профиля:', profileRes.error)
      return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 })
    }

    const profile = profileRes.data
    const progress = progressRes.data ?? {
      total_xp: 0,
      current_streak: 0,
      longest_streak: 0,
      lessons_completed: 0,
      english_level: null,
      last_lesson_date: null,
    }

    const platform_days = profile.created_at
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(profile.created_at).getTime()) / (24 * 3600 * 1000)
          )
        )
      : 0

    const clubs_attended = clubsRes?.count ?? 0
    const lessonsData = lessonsRes.data ?? []
    const lessons_completed = lessonsData.length || progress.lessons_completed || 0
    const minutes_total = lessonsData.reduce(
      (acc, l: any) => acc + (l.duration_minutes ?? 0),
      0
    )
    const hours_total = Math.round((minutes_total / 60) * 10) / 10
    const achievements_earned = achRes?.count ?? 0

    // Level progression
    const total_xp = progress.total_xp ?? 0
    const level_name: RoastLevel = xpToRoastLevel(total_xp)
    const bucket = LEVEL_XP_THRESHOLDS[level_name]
    const currentMin = bucket.min
    const nextThreshold = bucket.next ?? currentMin
    const next_level_name: RoastLevel = bucket.nextLevel ?? level_name
    const span = Math.max(1, nextThreshold - currentMin)
    const into = Math.max(0, total_xp - currentMin)
    const level_progress_pct = bucket.next
      ? Math.min(100, Math.round((into / span) * 100))
      : 100
    const xp_to_next = bucket.next ? Math.max(0, nextThreshold - total_xp) : 0
    const level_index = ROAST_LEVELS.indexOf(level_name) + 1 // 1..6
    const cefr = getLevelCEFR(level_name)

    // Journey — derived from real signals only; no fake entries.
    const journey: Array<{
      key: string
      date: string | null
      title: string
      desc: string
      kind: 'done' | 'active' | 'future'
    }> = []

    if (profile.created_at) {
      journey.push({
        key: 'signup',
        date: profile.created_at,
        title: 'Регистрация на платформе',
        desc: 'Добро пожаловать в Raw English',
        kind: 'done',
      })
    }

    // First completed lesson
    const firstLesson = [...lessonsData].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )[0]
    if (firstLesson) {
      journey.push({
        key: 'first_lesson',
        date: firstLesson.scheduled_at,
        title: 'Первый урок 1-on-1 📚',
        desc: 'Начало пути',
        kind: 'done',
      })
    }

    if (clubs_attended >= 1) {
      journey.push({
        key: 'first_club',
        date: null,
        title: 'Первый Speaking Club 🎙',
        desc: 'Первый шаг в коммьюнити',
        kind: 'done',
      })
    }

    if (progress.longest_streak >= 7) {
      journey.push({
        key: 'streak_7',
        date: null,
        title: `${progress.longest_streak}-day streak 🔥`,
        desc: 'Рекорд постоянства',
        kind: 'done',
      })
    }

    // Active — current progress bar
    journey.push({
      key: 'active',
      date: null,
      title: `В пути к ${next_level_name} ⚡`,
      desc: `${total_xp.toLocaleString('ru-RU')} / ${nextThreshold.toLocaleString('ru-RU')} XP · ${level_progress_pct}% прогресса`,
      kind: 'active',
    })

    // Future — next level goal
    if (bucket.next && bucket.nextLevel) {
      journey.push({
        key: 'future',
        date: null,
        title: `Цель: ${next_level_name} 🎯`,
        desc: getLevelCEFR(bucket.nextLevel) ?? '',
        kind: 'future',
      })
    }

    // Favorite teacher (if RPC exists) — otherwise fallback: compute client-side here
    let favorite_teacher: any = null
    if (favTeacherRes?.data) {
      favorite_teacher = favTeacherRes.data
    } else {
      // Fallback: count teachers from lessons client-side
      const counts = new Map<string, number>()
      for (const l of lessonsData) {
        if (l?.teacher_id) counts.set(l.teacher_id, (counts.get(l.teacher_id) ?? 0) + 1)
      }
      if (counts.size > 0) {
        const [topId, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!
        const { data: t } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name, avatar_url')
          .eq('id', topId)
          .maybeSingle()
        if (t) {
          const { data: tp } = await supabase
            .from('teacher_profiles')
            .select('specialization, native_language, country')
            .eq('id', topId)
            .maybeSingle()
          favorite_teacher = {
            id: t.id,
            full_name: t.full_name ?? `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim(),
            avatar_url: t.avatar_url,
            specialization: tp?.specialization ?? null,
            native_language: tp?.native_language ?? null,
            country: tp?.country ?? null,
            lessons_count: topCount,
            rating: null,
          }
        }
      }
    }

    // Payment history items merged with XP bonuses
    type HistoryItem = {
      id: string
      date: string
      title: string
      amount: number
      kind: 'debit' | 'credit' | 'xp'
      currency: string
      status: 'ok' | 'pending'
    }

    const history: HistoryItem[] = []
    for (const p of paymentsRes.data ?? []) {
      const meta = (p as any).metadata ?? {}
      const isTopup = meta?.purpose === 'topup'
      history.push({
        id: p.id,
        date: p.paid_at ?? p.created_at,
        title: isTopup
          ? 'Пополнение баланса'
          : p.lesson_id
            ? 'Урок 1-on-1'
            : meta?.title ?? 'Платёж',
        amount: p.amount,
        kind: isTopup ? 'credit' : 'debit',
        currency: p.currency ?? 'RUB',
        status: p.status === 'succeeded' ? 'ok' : 'pending',
      })
    }
    for (const b of bonusesRes.data ?? []) {
      history.push({
        id: b.id,
        date: b.created_at,
        title: b.description ?? 'Бонус за достижение',
        amount: b.amount,
        kind: 'xp',
        currency: 'XP',
        status: 'ok',
      })
    }
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        phone: profile.phone,
        timezone: profile.timezone,
        created_at: profile.created_at,
        balance_rub: profile.balance_rub ?? 0,
        subscription_tier: profile.subscription_tier ?? 'free',
        subscription_until: profile.subscription_until,
        city: profile.city,
        occupation: profile.occupation,
        english_goal: profile.english_goal,
        interests: profile.interests ?? [],
      },
      progress: {
        total_xp,
        current_streak: progress.current_streak ?? 0,
        longest_streak: progress.longest_streak ?? 0,
        lessons_completed,
        english_level: progress.english_level ?? cefr,
        level_index,
        level_name,
        next_level_name,
        level_progress_pct,
        xp_to_next,
        next_threshold: nextThreshold,
      },
      stats: {
        platform_days,
        lessons_completed,
        clubs_attended,
        hours_total,
        total_xp,
        achievements_earned,
      },
      journey,
      favorite_teacher,
      history,
    })
  } catch (err) {
    console.error('Непредвиденная ошибка в /api/profile/me GET:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/profile/me
// Allows the owner to update "about" fields.
// ---------------------------------------------------------------------------

const aboutSchema = z.object({
  city: z.string().max(120).nullable().optional(),
  occupation: z.string().max(120).nullable().optional(),
  english_goal: z.string().max(500).nullable().optional(),
  interests: z.array(z.string().min(1).max(40)).max(12).optional(),
  first_name: z.string().min(1).max(60).optional(),
  last_name: z.string().max(60).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
    }

    const parsed = aboutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' },
        { status: 400 }
      )
    }

    const patch: Record<string, any> = {}
    const d = parsed.data
    if (d.city !== undefined) patch.city = d.city
    if (d.occupation !== undefined) patch.occupation = d.occupation
    if (d.english_goal !== undefined) patch.english_goal = d.english_goal
    if (d.interests !== undefined) patch.interests = d.interests
    if (d.first_name !== undefined) patch.first_name = d.first_name
    if (d.last_name !== undefined) patch.last_name = d.last_name
    if (d.phone !== undefined) patch.phone = d.phone

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, updated: 0 })
    }

    // Recompute full_name when name parts change so sidebar stays in sync.
    if (d.first_name !== undefined || d.last_name !== undefined) {
      const { data: current } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .maybeSingle()
      const fn = d.first_name ?? current?.first_name ?? ''
      const ln = (d.last_name !== undefined ? d.last_name : current?.last_name) ?? ''
      patch.full_name = [fn, ln].filter(Boolean).join(' ').trim() || null
    }

    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) {
      console.error('Ошибка обновления профиля:', error)
      return NextResponse.json({ error: 'Не удалось обновить профиль' }, { status: 500 })
    }

    // Dashboard sidebar reads full_name/avatar_url from cache.
    invalidateProfile(user.id)

    return NextResponse.json({ ok: true, updated: Object.keys(patch).length })
  } catch (err) {
    console.error('Непредвиденная ошибка в /api/profile/me PATCH:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
