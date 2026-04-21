// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function buildInitials(fullName?: string | null): string {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (parts.length === 0) return ''
  return parts.map((p) => p.charAt(0).toUpperCase()).join('')
}

function isNativeHeuristic(languages: string[] | null | undefined): boolean {
  if (!languages || languages.length === 0) return false
  const hasEn = languages.some((l) => l.toLowerCase() === 'en')
  const hasRu = languages.some((l) => l.toLowerCase() === 'ru')
  return hasEn && !hasRu
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('teacher_profiles')
      .select(
        `
          id,
          user_id,
          bio,
          specializations,
          experience_years,
          hourly_rate,
          trial_rate,
          languages,
          education,
          certificates,
          video_intro_url,
          rating,
          total_reviews,
          total_lessons,
          is_verified,
          is_listed,
          profiles!teacher_profiles_user_id_fkey (
            full_name,
            avatar_url
          )
        `
      )
      .eq('id', id)
      .eq('is_listed', true)
      .maybeSingle()

    if (error) {
      console.error('Ошибка загрузки профиля преподавателя:', error)
      return NextResponse.json(
        { error: 'Не удалось загрузить преподавателя' },
        { status: 500 }
      )
    }

    if (!data || !data.profiles) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      )
    }

    const profile = data.profiles as Record<string, unknown>
    const fullName = (profile.full_name as string) || 'Преподаватель'
    const languages = (data.languages as string[] | null) ?? []
    const hourlyRate = (data.hourly_rate as number) ?? 0
    const trialRate = (data.trial_rate as number | null) ?? null

    const teacher = {
      id: data.id,
      user_id: data.user_id,
      full_name: fullName,
      avatar_url: (profile.avatar_url as string | null) ?? null,
      initials: buildInitials(fullName),
      bio: (data.bio as string | null) ?? null,
      specializations: (data.specializations as string[] | null) ?? [],
      experience_years: (data.experience_years as number | null) ?? null,
      hourly_rate: hourlyRate,
      hourly_rate_rub: Math.round(hourlyRate / 100),
      trial_rate: trialRate,
      trial_rate_rub: trialRate !== null ? Math.round(trialRate / 100) : null,
      languages,
      is_native: isNativeHeuristic(languages),
      rating: Number(data.rating ?? 0),
      total_reviews: (data.total_reviews as number) ?? 0,
      total_lessons: (data.total_lessons as number) ?? 0,
      is_verified: (data.is_verified as boolean) ?? false,
      education: (data.education as string | null) ?? null,
      certificates: (data.certificates as string[] | null) ?? [],
      video_intro_url: (data.video_intro_url as string | null) ?? null,
    }

    return NextResponse.json(teacher)
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/teachers/[id]:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
