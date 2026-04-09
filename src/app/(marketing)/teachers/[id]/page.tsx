// @ts-nocheck
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Separator } from "@/components/ui/separator"
import {
  TeacherProfileHeader,
  TeacherBio,
  TeacherInfoCards,
  TeacherVideoIntro,
  TeacherPricingCard,
  TeacherAvailabilityPreview,
  pluralizeReviews,
} from "@/components/teachers/teacher-profile"
import { StarRating } from "@/components/teachers/teacher-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials } from "@/components/teachers/teacher-card"
import type { Database } from "@/types/database"

type TeacherProfile = Database["public"]["Tables"]["teacher_profiles"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Review = Database["public"]["Tables"]["reviews"]["Row"]

interface ReviewWithStudent extends Review {
  profiles: { full_name: string; avatar_url: string | null } | null
}

// ---- Data fetching ----

async function getTeacherData(userId: string) {
  const supabase = await createClient()

  // Fetch teacher profile joined with profile
  const { data: teacherData, error: teacherError } = await supabase
    .from("teacher_profiles")
    .select(
      `
      *,
      profiles!teacher_profiles_user_id_fkey (
        id,
        full_name,
        avatar_url,
        email
      )
    `
    )
    .eq("user_id", userId)
    .eq("is_listed", true)
    .single()

  if (teacherError || !teacherData) return null

  return teacherData
}

async function getTeacherReviews(
  teacherId: string,
  page: number = 1,
  pageSize: number = 5
) {
  const supabase = await createClient()
  const offset = (page - 1) * pageSize

  const { data, count, error } = await supabase
    .from("reviews")
    .select(
      `
      *,
      profiles!reviews_student_id_fkey (
        full_name,
        avatar_url
      )
    `,
      { count: "exact" }
    )
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error("Error fetching reviews:", error)
    return { reviews: [], total: 0 }
  }

  return {
    reviews: (data || []) as unknown as ReviewWithStudent[],
    total: count || 0,
  }
}

async function getTeacherAvailability(teacherId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("teacher_availability")
    .select("day_of_week, start_time, end_time, is_available")
    .eq("teacher_id", teacherId)
    .eq("is_available", true)

  if (error || !data) return []

  // Group by day and count slots (each slot is roughly 1 hour)
  const dayMap = new Map<number, number>()
  for (const row of data) {
    const startHour = parseInt(row.start_time.split(":")[0], 10)
    const endHour = parseInt(row.end_time.split(":")[0], 10)
    const slots = Math.max(1, endHour - startHour)
    dayMap.set(row.day_of_week, (dayMap.get(row.day_of_week) || 0) + slots)
  }

  return Array.from(dayMap.entries()).map(([day_of_week, slot_count]) => ({
    day_of_week,
    slot_count,
  }))
}

// ---- Metadata ----

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const teacherData = await getTeacherData(id)

  if (!teacherData) {
    return { title: "Преподаватель не найден | SpeakFlow" }
  }

  const profile = teacherData.profiles as unknown as Profile
  const teacher = teacherData as unknown as TeacherProfile
  const name = profile?.full_name || "Преподаватель"

  return {
    title: `${name} — преподаватель английского | SpeakFlow`,
    description: teacher.bio
      ? teacher.bio.slice(0, 160)
      : `${name} — преподаватель английского языка на SpeakFlow. Рейтинг: ${teacher.rating.toFixed(1)}. Стоимость от ${teacher.hourly_rate} ₽/час.`,
    openGraph: {
      title: `${name} — преподаватель английского | SpeakFlow`,
      description:
        teacher.bio?.slice(0, 160) ||
        `Запишитесь на урок с ${name} на SpeakFlow`,
      images: profile?.avatar_url ? [{ url: profile.avatar_url }] : undefined,
    },
  }
}

// ---- Page ----

export default async function TeacherProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ review_page?: string }>
}) {
  const { id } = await params
  const { review_page } = await searchParams

  const teacherData = await getTeacherData(id)
  if (!teacherData) notFound()

  const teacher = teacherData as unknown as TeacherProfile
  const profile = teacherData.profiles as unknown as Profile

  const reviewPage = Math.max(1, Number(review_page) || 1)
  const [{ reviews, total: reviewTotal }, availability] = await Promise.all([
    getTeacherReviews(teacher.id, reviewPage),
    getTeacherAvailability(teacher.id),
  ])

  const reviewTotalPages = Math.ceil(reviewTotal / 5)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Main content */}
        <div className="flex-1 space-y-8">
          {/* Profile Header */}
          <TeacherProfileHeader teacher={teacher} profile={profile} />

          <Separator />

          {/* Bio */}
          <TeacherBio bio={teacher.bio} />

          {/* Info cards */}
          <TeacherInfoCards teacher={teacher} />

          {/* Video intro */}
          {teacher.video_intro_url && (
            <TeacherVideoIntro url={teacher.video_intro_url} />
          )}

          {/* Availability */}
          {availability.length > 0 && (
            <TeacherAvailabilityPreview availability={availability} />
          )}

          <Separator />

          {/* Reviews */}
          <section aria-labelledby="reviews-heading">
            <h2 id="reviews-heading" className="mb-4 text-xl font-semibold">
              Отзывы ({reviewTotal})
            </h2>

            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}

                {/* Review pagination */}
                {reviewTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    {Array.from({ length: reviewTotalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <a
                          key={p}
                          href={`/teachers/${id}${p > 1 ? `?review_page=${p}` : ""}`}
                          className={`inline-flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                            p === reviewPage
                              ? "bg-[#722F37] text-white"
                              : "border border-input hover:bg-muted"
                          }`}
                          aria-current={p === reviewPage ? "page" : undefined}
                        >
                          {p}
                        </a>
                      )
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                У этого преподавателя пока нет отзывов
              </p>
            )}
          </section>
        </div>

        {/* Pricing sidebar */}
        <div className="w-full shrink-0 lg:w-80">
          <TeacherPricingCard teacher={teacher} />
        </div>
      </div>
    </div>
  )
}

// ---- Review Item ----

function ReviewItem({ review }: { review: ReviewWithStudent }) {
  const studentName =
    review.profiles?.full_name || "Студент"
  const date = new Date(review.created_at)
  const formattedDate = date.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="text-xs">
              {getInitials(studentName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{studentName}</p>
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
          </div>
        </div>
        <StarRating rating={review.rating} size="sm" />
      </div>
      {review.comment && (
        <p className="mt-3 text-sm text-muted-foreground">{review.comment}</p>
      )}
    </div>
  )
}
