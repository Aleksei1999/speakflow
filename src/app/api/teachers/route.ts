// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Map UI price bucket -> [min_kopecks, max_kopecks] (inclusive both sides)
// Rates are stored in kopecks (1 RUB = 100 kopecks).
const PRICE_BUCKETS: Record<string, [number, number | null]> = {
  under_1000: [0, 99_999],           // < 1000 RUB  => <= 99_999 kopecks
  '1000_1500': [100_000, 149_999],
  '1500_2000': [150_000, 199_999],
  over_2000: [200_000, null],        // >= 2000 RUB
}

const querySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  spec: z.string().trim().min(1).max(500).optional(),
  price: z.enum(['under_1000', '1000_1500', '1500_2000', 'over_2000']).optional(),
  native: z.enum(['native', 'ru', 'any']).optional(),
  sort: z.enum(['rating', 'price_asc', 'reviews']).default('rating'),
  limit: z.coerce.number().int().min(1).max(100).default(60),
})

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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Require authenticated user — this lives under the dashboard.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      search: searchParams.get('search') ?? undefined,
      spec: searchParams.get('spec') ?? undefined,
      price: searchParams.get('price') ?? undefined,
      native: searchParams.get('native') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { search, spec, price, native, sort, limit } = parsed.data

    let query = supabase
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
          rating,
          total_reviews,
          total_lessons,
          is_verified,
          profiles!teacher_profiles_user_id_fkey (
            full_name,
            avatar_url
          )
        `,
        { count: 'exact' }
      )
      .eq('is_listed', true)

    // Name search — filter the joined profiles table.
    if (search) {
      // Escape % and _ which are special in ILIKE patterns.
      const safe = search.replace(/[%_]/g, (c) => `\\${c}`)
      query = query.ilike('profiles.full_name', `%${safe}%`)
    }

    // Specializations (comma-separated OR single value) — overlap match (&&).
    if (spec) {
      const specs = spec
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (specs.length > 0) {
        query = query.overlaps('specializations', specs)
      }
    }

    // Price bucket → kopecks range.
    if (price) {
      const [min, max] = PRICE_BUCKETS[price]
      query = query.gte('hourly_rate', min)
      if (max !== null) query = query.lte('hourly_rate', max)
    }

    // Native / Russian-speaking filter on `languages` array.
    // native: contains 'en' AND does NOT contain 'ru' — DB can only express "contains",
    //         so we require 'en' at the DB level and drop rows with 'ru' after fetch.
    // ru    : contains 'ru'.
    // any   : no filter.
    let dropIfHasRu = false
    if (native === 'native') {
      query = query.contains('languages', ['en'])
      dropIfHasRu = true
    } else if (native === 'ru') {
      query = query.contains('languages', ['ru'])
    }

    // Sorting.
    switch (sort) {
      case 'price_asc':
        query = query.order('hourly_rate', { ascending: true })
        break
      case 'reviews':
        query = query.order('total_reviews', { ascending: false })
        break
      case 'rating':
      default:
        query = query
          .order('rating', { ascending: false })
          .order('total_reviews', { ascending: false })
        break
    }

    query = query.limit(Math.min(limit, 100))

    const { data, count, error } = await query
    if (error) {
      console.error('Ошибка загрузки преподавателей:', error)
      return NextResponse.json(
        { error: 'Не удалось загрузить преподавателей' },
        { status: 500 }
      )
    }

    const teachers = (data || [])
      .map((row: Record<string, unknown>) => {
        const profile = row.profiles as Record<string, unknown> | null
        if (!profile) return null
        const languages = (row.languages as string[] | null) ?? []
        // Post-filter for native=true (languages contains 'en' AND NOT 'ru').
        if (dropIfHasRu && languages.some((l) => l.toLowerCase() === 'ru')) {
          return null
        }
        const fullName = (profile.full_name as string) || 'Преподаватель'
        const hourlyRate = (row.hourly_rate as number) ?? 0
        const trialRate = (row.trial_rate as number | null) ?? null
        return {
          id: row.id as string,
          user_id: row.user_id as string,
          full_name: fullName,
          avatar_url: (profile.avatar_url as string | null) ?? null,
          initials: buildInitials(fullName),
          bio: (row.bio as string | null) ?? null,
          specializations: (row.specializations as string[] | null) ?? [],
          experience_years: (row.experience_years as number | null) ?? null,
          hourly_rate: hourlyRate,
          hourly_rate_rub: Math.round(hourlyRate / 100),
          trial_rate: trialRate,
          trial_rate_rub: trialRate !== null ? Math.round(trialRate / 100) : null,
          languages,
          is_native: isNativeHeuristic(languages),
          rating: Number(row.rating ?? 0),
          total_reviews: (row.total_reviews as number) ?? 0,
          total_lessons: (row.total_lessons as number) ?? 0,
          is_verified: (row.is_verified as boolean) ?? false,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ teachers, total: count ?? teachers.length })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/teachers:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
