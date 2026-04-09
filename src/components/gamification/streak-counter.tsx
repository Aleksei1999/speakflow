import { cn } from "@/lib/utils"
import { Flame } from "lucide-react"

interface StreakCounterProps {
  currentStreak: number
  longestStreak: number
  className?: string
}

export function StreakCounter({
  currentStreak,
  longestStreak,
  className,
}: StreakCounterProps) {
  const isActive = currentStreak > 0

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            isActive
              ? "bg-orange-100 dark:bg-orange-900/30"
              : "bg-muted"
          )}
        >
          <Flame
            className={cn(
              "size-6",
              isActive
                ? "text-orange-500"
                : "text-muted-foreground"
            )}
          />
        </div>
        <div>
          <p className="text-2xl font-bold">
            {currentStreak}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {currentStreak === 1
                ? "день"
                : currentStreak >= 2 && currentStreak <= 4
                  ? "дня"
                  : "дней"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">Текущий streak</p>
        </div>
      </div>

      <div className="h-8 w-px bg-border" />

      <div>
        <p className="text-lg font-semibold">{longestStreak}</p>
        <p className="text-xs text-muted-foreground">Лучший streak</p>
      </div>
    </div>
  )
}
