import { Suspense } from "react"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { TeacherCard, type TeacherCardData } from "@/components/teachers/teacher-card"
import {
  TeacherSearchBar,
  TeacherSortSelect,
  TeacherFiltersSidebar,
  TeacherFiltersMobile,
  TeacherPagination,
} from "@/components/teachers/teacher-filters"

export const metadata: Metadata = {
  title: "Наши преподаватели | Raw English",
  description:
    "Найдите идеального преподавателя английского языка. Фильтры по специализации, цене, рейтингу и языку преподавания.",
  openGraph: {
    title: "Наши преподаватели | Raw English",
    description:
      "Найдите идеального преподавателя английского языка на Raw English.",
  },
}

const PAGE_SIZE = 12

interface SearchParams {
  search?: string
  spec?: string
  price_min?: string
  price_max?: string
  min_rating?: string
  lang?: string
  sort?: string
  page?: string
}

async function fetchTeachers(searchParams: SearchParams) {
  const supabase = await createClient()

  const page = Math.max(1, Number(searchParams.page) || 1)
  const offset = (page - 1) * PAGE_SIZE

  // Build the query joining teacher_profiles with profiles
  let query = supabase
    .from("teacher_profiles")
    .select(
      `
      id,
      user_id,
      bio,
      specializations,
      experience_years,
      hourly_rate,
      trial_rate,
      rating,
      total_reviews,
      is_verified,
      profiles!teacher_profiles_user_id_fkey (
        full_name,
        avatar_url
      )
    `,
      { count: "exact" }
    )
    .eq("is_listed", true)

  // Search by name
  if (searchParams.search) {
    query = query.ilike("profiles.full_name", `%${searchParams.search}%`)
  }

  // Filter by specializations (uses GIN index on specializations column)
  if (searchParams.spec) {
    const specs = searchParams.spec.split(",").filter(Boolean)
    if (specs.length > 0) {
      query = query.overlaps("specializations", specs)
    }
  }

  // Price range
  if (searchParams.price_min) {
    query = query.gte("hourly_rate", Number(searchParams.price_min))
  }
  if (searchParams.price_max) {
    query = query.lte("hourly_rate", Number(searchParams.price_max))
  }

  // Minimum rating (uses rating DESC index)
  if (searchParams.min_rating) {
    query = query.gte("rating", Number(searchParams.min_rating))
  }

  // Filter by languages
  if (searchParams.lang) {
    const langs = searchParams.lang.split(",").filter(Boolean)
    if (langs.length > 0) {
      query = query.overlaps("languages", langs)
    }
  }

  // Sorting (leverages rating DESC index for default sort)
  const sort = searchParams.sort || "rating"
  switch (sort) {
    case "price_asc":
      query = query.order("hourly_rate", { ascending: true })
      break
    case "price_desc":
      query = query.order("hourly_rate", { ascending: false })
      break
    case "experience":
      query = query.order("experience_years", { ascending: false })
      break
    case "rating":
    default:
      query = query.order("rating", { ascending: false })
      break
  }

  // Pagination
  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data, count, error } = await query

  if (error) {
    console.error("Error fetching teachers:", error)
    return { teachers: [], total: 0 }
  }

  // Transform data to flat TeacherCardData
  const teachers: TeacherCardData[] = (data || [])
    .map((row: Record<string, unknown>) => {
      const profile = row.profiles as Record<string, unknown> | null
      if (!profile) return null
      return {
        id: row.id as string,
        user_id: row.user_id as string,
        full_name: (profile.full_name as string) || "Преподаватель",
        avatar_url: (profile.avatar_url as string) || null,
        bio: row.bio as string | null,
        specializations: row.specializations as string[],
        experience_years: row.experience_years as number,
        hourly_rate: row.hourly_rate as number,
        trial_rate: row.trial_rate as number | null,
        rating: row.rating as number,
        total_reviews: row.total_reviews as number,
        is_verified: row.is_verified as boolean,
      }
    })
    .filter(Boolean) as TeacherCardData[]

  return { teachers, total: count || 0 }
}

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { teachers, total } = await fetchTeachers(params)
  const currentPage = Math.max(1, Number(params.page) || 1)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
          Наши преподаватели
        </h1>
        <p className="mt-2 text-muted-foreground">
          {total}{" "}
          {pluralizeTeachers(total)} готовы помочь вам
        </p>
      </div>

      {/* Search + Sort + Mobile Filter trigger */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <Suspense>
            <TeacherFiltersMobile />
          </Suspense>
          <div className="flex-1">
            <Suspense>
              <TeacherSearchBar />
            </Suspense>
          </div>
        </div>
        <Suspense>
          <TeacherSortSelect />
        </Suspense>
      </div>

      {/* Main Content: Sidebar + Grid */}
      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <Suspense>
          <TeacherFiltersSidebar />
        </Suspense>

        {/* Teacher Grid */}
        <div className="flex-1">
          {teachers.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {teachers.map((teacher) => (
                  <TeacherCard key={teacher.id} teacher={teacher} />
                ))}
              </div>

              <Suspense>
                <TeacherPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                />
              </Suspense>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <div className="mb-4 text-4xl">🔍</div>
              <h2 className="text-lg font-semibold text-foreground">
                Преподаватели не найдены
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Попробуйте изменить параметры поиска или сбросить фильтры
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function pluralizeTeachers(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "преподаватель"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "преподавателя"
  return "преподавателей"
}
