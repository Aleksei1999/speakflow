// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal } from "lucide-react"
import { XpProgressBar } from "@/components/gamification/progress-bar"
import { AchievementBadge } from "@/components/gamification/achievement-badge"
import { StreakCounter } from "@/components/gamification/streak-counter"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default async function StudentAchievementsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [
    progressResult,
    achievementsResult,
    userAchievementsResult,
    leaderboardResult,
  ] = await Promise.all([
    supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", user.id)
      .single(),
    supabase.from("achievements").select("*").order("threshold", { ascending: true }),
    supabase
      .from("user_achievements")
      .select("achievement_id, earned_at")
      .eq("user_id", user.id),
    supabase
      .from("user_progress")
      .select("user_id, total_xp, current_level, profiles!user_progress_user_id_fkey(full_name, avatar_url)")
      .order("total_xp", { ascending: false })
      .limit(10),
  ])

  const progress = progressResult.data
  const allAchievements = achievementsResult.data ?? []
  const earnedMap = new Map<string, string>()
  for (const ua of userAchievementsResult.data ?? []) {
    earnedMap.set(ua.achievement_id, ua.earned_at)
  }

  const leaderboard = (leaderboardResult.data ?? []) as any[]

  // Determine progress toward each achievement based on category
  function getAchievementProgress(achievement: any): number {
    if (!progress) return 0
    switch (achievement.category) {
      case "lessons":
        return progress.lessons_completed
      case "streak":
        return progress.current_streak
      case "xp":
        return progress.total_xp
      default:
        return 0
    }
  }

  const earnedAchievements = allAchievements.filter((a) => earnedMap.has(a.id))
  const lockedAchievements = allAchievements.filter((a) => !earnedMap.has(a.id))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Достижения</h1>
        <p className="text-sm text-muted-foreground">
          Ваш прогресс и награды
        </p>
      </div>

      {/* XP Progress */}
      <Card>
        <CardContent>
          <XpProgressBar
            currentXp={progress?.total_xp ?? 0}
            currentLevel={progress?.current_level ?? 1}
          />
        </CardContent>
      </Card>

      {/* Streak */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Серия занятий
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StreakCounter
            currentStreak={progress?.current_streak ?? 0}
            longestStreak={progress?.longest_streak ?? 0}
          />
        </CardContent>
      </Card>

      {/* Achievements Grid */}
      <div className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Medal className="size-5 text-[#CC3A3A]" />
          Награды
          <Badge variant="secondary" className="text-xs">
            {earnedAchievements.length} / {allAchievements.length}
          </Badge>
        </h2>

        {allAchievements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Trophy className="mb-3 size-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Награды скоро появятся
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Earned first, then locked */}
            {earnedAchievements.map((achievement) => (
              <AchievementBadge
                key={achievement.id}
                title={achievement.title}
                description={achievement.description}
                icon={achievement.icon}
                earned
                earnedAt={earnedMap.get(achievement.id)}
              />
            ))}
            {lockedAchievements.map((achievement) => (
              <AchievementBadge
                key={achievement.id}
                title={achievement.title}
                description={achievement.description}
                icon={achievement.icon}
                earned={false}
                progress={getAchievementProgress(achievement)}
                threshold={achievement.threshold}
              />
            ))}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4 text-[#CC3A3A]" />
            Таблица лидеров
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Пока нет данных
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, index) => {
                const profile = entry.profiles
                const name = profile?.full_name ?? "Пользователь"
                const isCurrentUser = entry.user_id === user.id
                const rank = index + 1

                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                      isCurrentUser
                        ? "bg-[#CC3A3A]/5 ring-1 ring-[#CC3A3A]/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                        rank <= 3
                          ? "bg-[#CC3A3A] text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {rank}
                    </span>

                    <Avatar size="sm">
                      {profile?.avatar_url ? (
                        <AvatarImage
                          src={profile.avatar_url}
                          alt={name}
                        />
                      ) : null}
                      <AvatarFallback>{getInitials(name)}</AvatarFallback>
                    </Avatar>

                    <div className="flex flex-1 flex-col min-w-0">
                      <p className="truncate text-sm font-medium">
                        {name}
                        {isCurrentUser && (
                          <span className="ml-1 text-xs text-[#CC3A3A]">
                            (вы)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Уровень {entry.current_level}
                      </p>
                    </div>

                    <p className="text-sm font-semibold">
                      {entry.total_xp.toLocaleString("ru-RU")} XP
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
