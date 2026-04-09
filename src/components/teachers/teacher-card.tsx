import Link from "next/link"
import { Star, BadgeCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

export interface TeacherCardData {
  id: string
  user_id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  specializations: string[]
  experience_years: number
  hourly_rate: number
  trial_rate: number | null
  rating: number
  total_reviews: number
  is_verified: boolean
}

const SPECIALIZATION_LABELS: Record<string, string> = {
  general: "General English",
  business: "Business English",
  ielts: "IELTS",
  toefl: "TOEFL",
  kids: "Kids",
  conversation: "Conversation",
  grammar: "Grammar",
  pronunciation: "Pronunciation",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "size-4" : "size-5"
  return (
    <div className="flex items-center gap-0.5" aria-label={`Рейтинг ${rating.toFixed(1)} из 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${sizeClass} ${
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  )
}

export { StarRating, SPECIALIZATION_LABELS, getInitials }

export function TeacherCard({ teacher }: { teacher: TeacherCardData }) {
  const displaySpecs = teacher.specializations.slice(0, 3)
  const extraCount = teacher.specializations.length - 3

  return (
    <Link
      href={`/teachers/${teacher.user_id}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card className="h-full transition-shadow duration-200 group-hover:shadow-md">
        <CardContent className="flex flex-col gap-4">
          {/* Header: Avatar + Name */}
          <div className="flex items-start gap-4">
            <Avatar className="size-16 shrink-0" size="lg">
              {teacher.avatar_url ? (
                <AvatarImage src={teacher.avatar_url} alt={teacher.full_name} />
              ) : null}
              <AvatarFallback className="text-lg">
                {getInitials(teacher.full_name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {teacher.full_name}
                </h3>
                {teacher.is_verified && (
                  <BadgeCheck
                    className="size-5 shrink-0 text-[#CC3A3A]"
                    aria-label="Подтвержденный преподаватель"
                  />
                )}
              </div>

              {/* Rating */}
              <div className="mt-1 flex items-center gap-2">
                <StarRating rating={teacher.rating} />
                <span className="text-sm text-muted-foreground">
                  ({teacher.total_reviews})
                </span>
              </div>
            </div>
          </div>

          {/* Specializations */}
          <div className="flex flex-wrap gap-1.5">
            {displaySpecs.map((spec) => (
              <Badge key={spec} variant="secondary" className="text-xs">
                {SPECIALIZATION_LABELS[spec] || spec}
              </Badge>
            ))}
            {extraCount > 0 && (
              <Badge variant="outline" className="text-xs">
                +{extraCount}
              </Badge>
            )}
          </div>

          {/* Bio */}
          {teacher.bio && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {teacher.bio}
            </p>
          )}

          {/* Price + CTA */}
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div>
              <div className="text-lg font-bold text-foreground">
                от {teacher.hourly_rate} ₽/час
              </div>
              {teacher.trial_rate !== null && (
                <div className="text-sm text-muted-foreground">
                  Пробный урок: {teacher.trial_rate} ₽
                </div>
              )}
            </div>

            <Button
              size="sm"
              className="bg-[#CC3A3A] text-white hover:bg-[#a32e2e] shrink-0"
              tabIndex={-1}
            >
              Подробнее
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
