import { cn } from "@/lib/utils"
import { LEVEL_THRESHOLDS } from "@/lib/constants"
import { Trophy } from "lucide-react"

interface ProgressBarProps {
  currentXp: number
  currentLevel: number
  className?: string
}

export function XpProgressBar({
  currentXp,
  currentLevel,
  className,
}: ProgressBarProps) {
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel] ?? 0
  const nextThreshold =
    LEVEL_THRESHOLDS[currentLevel + 1] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]!
  const xpInLevel = currentXp - currentThreshold
  const xpNeeded = nextThreshold - currentThreshold
  const progress = xpNeeded > 0 ? Math.min(100, (xpInLevel / xpNeeded) * 100) : 100

  const isMaxLevel = currentLevel >= LEVEL_THRESHOLDS.length - 1

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex size-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "#CC3A3A" }}
          >
            <Trophy className="size-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Уровень {currentLevel}</p>
            <p className="text-xs text-muted-foreground">
              {currentXp.toLocaleString("ru-RU")} XP
            </p>
          </div>
        </div>
        {!isMaxLevel && (
          <p className="text-xs text-muted-foreground">
            {xpInLevel.toLocaleString("ru-RU")} / {xpNeeded.toLocaleString("ru-RU")} XP до следующего уровня
          </p>
        )}
        {isMaxLevel && (
          <p className="text-xs font-medium text-[#CC3A3A]">
            Максимальный уровень!
          </p>
        )}
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#CC3A3A]/10">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progress}%`,
            backgroundColor: "#CC3A3A",
          }}
        />
      </div>
    </div>
  )
}
