import { cn } from "@/lib/utils"
import { Lock, Check } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface AchievementBadgeProps {
  title: string
  description: string
  icon: string
  earned: boolean
  earnedAt?: string | null
  progress?: number
  threshold?: number
  className?: string
}

const iconMap: Record<string, string> = {
  first_lesson: "🎓",
  streak_7: "🔥",
  streak_30: "💪",
  lessons_10: "📚",
  lessons_25: "🏆",
  lessons_50: "👑",
  lessons_100: "💎",
  vocabulary_100: "📝",
  vocabulary_500: "📖",
  review_first: "⭐",
  perfect_week: "✨",
  early_bird: "🌅",
  night_owl: "🌙",
}

export function AchievementBadge({
  title,
  description,
  icon,
  earned,
  earnedAt,
  progress,
  threshold,
  className,
}: AchievementBadgeProps) {
  const emoji = iconMap[icon] ?? "🏅"

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
        earned
          ? "border-[#722F37]/20 bg-[#722F37]/5"
          : "border-muted bg-muted/30 opacity-60",
        className
      )}
    >
      {earned && (
        <div className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-green-500 text-white">
          <Check className="size-3" />
        </div>
      )}
      {!earned && (
        <div className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-muted-foreground/30 text-muted-foreground">
          <Lock className="size-3" />
        </div>
      )}

      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full text-2xl",
          earned ? "bg-[#722F37]/10" : "bg-muted grayscale"
        )}
      >
        {emoji}
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {earned && earnedAt && (
        <p className="text-xs text-[#722F37]">
          Получено {format(new Date(earnedAt), "d MMM yyyy", { locale: ru })}
        </p>
      )}

      {!earned && progress != null && threshold != null && threshold > 0 && (
        <div className="flex w-full flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-muted-foreground/40 transition-all"
              style={{
                width: `${Math.min(100, (progress / threshold) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress} / {threshold}
          </p>
        </div>
      )}
    </div>
  )
}
