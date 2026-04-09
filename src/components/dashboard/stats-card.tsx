import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  trend?: { value: number; positive: boolean }
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
}: StatsCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(114, 47, 55, 0.1)" }}
        >
          <span className="text-[#CC3A3A]">{icon}</span>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <span
                className={cn(
                  "text-xs font-medium",
                  trend.positive ? "text-green-600" : "text-red-500"
                )}
              >
                {trend.positive ? "+" : ""}
                {trend.value}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
