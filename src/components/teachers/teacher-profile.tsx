import {
  BadgeCheck,
  GraduationCap,
  Clock,
  Globe,
  Award,
  BookOpen,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  StarRating,
  SPECIALIZATION_LABELS,
  getInitials,
} from "@/components/teachers/teacher-card"
import type { Database } from "@/types/database"

type TeacherProfile = Database["public"]["Tables"]["teacher_profiles"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]

export interface TeacherFullData {
  teacher: TeacherProfile
  profile: Profile
}

const LANGUAGE_LABELS: Record<string, string> = {
  russian: "Русский",
  english: "Английский",
}

export function TeacherProfileHeader({
  teacher,
  profile,
}: TeacherFullData) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      {/* Large Avatar */}
      <Avatar className="size-28 shrink-0 sm:size-32" size="lg">
        {profile.avatar_url ? (
          <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
        ) : null}
        <AvatarFallback className="text-3xl">
          {getInitials(profile.full_name)}
        </AvatarFallback>
      </Avatar>

      {/* Name + Rating + Specs */}
      <div className="flex flex-col items-center gap-3 sm:items-start">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {profile.full_name}
          </h1>
          {teacher.is_verified && (
            <BadgeCheck
              className="size-6 text-[#CC3A3A]"
              aria-label="Подтвержденный преподаватель"
            />
          )}
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <StarRating rating={teacher.rating} size="md" />
          <span className="text-sm text-muted-foreground">
            {teacher.rating.toFixed(1)} ({teacher.total_reviews}{" "}
            {pluralizeReviews(teacher.total_reviews)})
          </span>
        </div>

        {/* Specializations */}
        <div className="flex flex-wrap gap-1.5">
          {teacher.specializations.map((spec) => (
            <Badge
              key={spec}
              variant="secondary"
              className="text-xs"
            >
              {SPECIALIZATION_LABELS[spec] || spec}
            </Badge>
          ))}
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-4" />
            {teacher.experience_years}{" "}
            {pluralizeYears(teacher.experience_years)} опыта
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="size-4" />
            {teacher.total_lessons} уроков проведено
          </span>
        </div>
      </div>
    </div>
  )
}

export function TeacherBio({ bio }: { bio: string | null }) {
  if (!bio) return null
  return (
    <section aria-labelledby="bio-heading">
      <h2 id="bio-heading" className="mb-3 text-xl font-semibold">
        О преподавателе
      </h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {bio}
      </p>
    </section>
  )
}

export function TeacherInfoCards({ teacher }: { teacher: TeacherProfile }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Experience */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-[#CC3A3A]" />
            Опыт
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {teacher.experience_years}{" "}
            {pluralizeYears(teacher.experience_years)}
          </p>
        </CardContent>
      </Card>

      {/* Languages */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-4 text-[#CC3A3A]" />
            Языки
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {teacher.languages.map((lang) => (
              <Badge key={lang} variant="outline">
                {LANGUAGE_LABELS[lang] || lang}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Education */}
      {teacher.education && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-4 text-[#CC3A3A]" />
              Образование
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {teacher.education}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Certificates */}
      {teacher.certificates.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-4 text-[#CC3A3A]" />
              Сертификаты
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {teacher.certificates.map((cert, i) => (
                <li key={i}>{cert}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function TeacherVideoIntro({ url }: { url: string }) {
  // Support YouTube and generic video URLs
  const youtubeId = extractYoutubeId(url)

  return (
    <section aria-labelledby="video-heading">
      <h2 id="video-heading" className="mb-3 text-xl font-semibold">
        Видео-представление
      </h2>
      <div className="aspect-video overflow-hidden rounded-xl bg-muted">
        {youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="Видео-представление преподавателя"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        ) : (
          <video
            src={url}
            controls
            className="size-full object-cover"
            preload="metadata"
          >
            <track kind="captions" />
          </video>
        )}
      </div>
    </section>
  )
}

export function TeacherPricingCard({
  teacher,
}: {
  teacher: TeacherProfile
}) {
  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader>
        <CardTitle>Стоимость</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="text-3xl font-bold text-foreground">
            {teacher.hourly_rate} ₽
          </div>
          <p className="text-sm text-muted-foreground">за час занятия</p>
        </div>

        {teacher.trial_rate !== null && (
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-lg font-semibold text-foreground">
              {teacher.trial_rate} ₽
            </div>
            <p className="text-sm text-muted-foreground">пробный урок</p>
          </div>
        )}

        <a
          href={`/student/book/${teacher.user_id}`}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#CC3A3A] px-6 text-sm font-medium text-white transition-colors hover:bg-[#a32e2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Записаться на урок
        </a>
      </CardContent>
    </Card>
  )
}

export function TeacherAvailabilityPreview({
  availability,
}: {
  availability: Array<{ day_of_week: number; slot_count: number }>
}) {
  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  const today = new Date()

  // Next 7 days
  const next7 = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dow = date.getDay() === 0 ? 7 : date.getDay() // Monday=1 .. Sunday=7
    const match = availability.find((a) => a.day_of_week === dow)
    return {
      dayName: dayNames[dow - 1],
      date: date.getDate(),
      month: date.getMonth() + 1,
      slots: match?.slot_count ?? 0,
    }
  })

  return (
    <section aria-labelledby="availability-heading">
      <h2 id="availability-heading" className="mb-3 text-xl font-semibold">
        Расписание на ближайшие дни
      </h2>
      <div className="grid grid-cols-7 gap-2">
        {next7.map((day, i) => (
          <div
            key={i}
            className={`flex flex-col items-center rounded-lg border p-2 text-center ${
              day.slots > 0
                ? "border-[#CC3A3A]/20 bg-[#CC3A3A]/5"
                : "border-border bg-muted/30"
            }`}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {day.dayName}
            </span>
            <span className="text-sm font-semibold">{day.date}</span>
            <span
              className={`mt-1 text-xs ${
                day.slots > 0 ? "text-[#CC3A3A] font-medium" : "text-muted-foreground"
              }`}
            >
              {day.slots > 0 ? `${day.slots} слотов` : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---- Helpers ----

function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  return match?.[1] ?? null
}

function pluralizeReviews(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "отзыв"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "отзыва"
  return "отзывов"
}

function pluralizeYears(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "год"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "года"
  return "лет"
}

export { pluralizeReviews, pluralizeYears }
