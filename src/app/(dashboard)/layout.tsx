import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { LEVEL_XP_THRESHOLDS, type RoastLevel } from "@/lib/level-utils"
import {
  getCachedProfile,
  getCachedUserProgress,
  getCachedTeacherStats,
} from "@/lib/cache/dashboard"

// Layout is still force-dynamic (we still need fresh auth check and
// the children may be dynamic). The three Supabase reads below are
// served from `unstable_cache` keyed by user.id with short TTLs and
// per-user tags — see src/lib/cache/dashboard.ts. Mutation sites
// call `revalidateTag` to evict on writes.
export const dynamic = "force-dynamic"

const LEVEL_ORDER = ["Raw", "Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"] as const

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // All three reads are now served from the per-user tagged cache.
  // We still fan them out in parallel — the first miss after
  // invalidation has the same shape as the old uncached code.
  const [profile, progressRaw, teacherRaw] = await Promise.all([
    getCachedProfile(user.id),
    getCachedUserProgress(user.id),
    getCachedTeacherStats(user.id),
  ])

  const role = profile?.role ?? null

  let gamification: {
    xp: number
    level: string
    nextLevel: string | null
    nextLevelXp: number
    currentStreak: number
  } | null = null

  let teacherStats: {
    rating: number
    totalReviews: number
    yearsExperience: number | null
  } | null = null

  if (role === "student") {
    const progress = progressRaw as { total_xp: number | null; english_level: string | null; current_streak: number | null } | null
    const level: RoastLevel = (progress?.english_level && LEVEL_ORDER.includes(progress.english_level as (typeof LEVEL_ORDER)[number]))
      ? (progress.english_level as RoastLevel)
      : "Raw"
    const thresholds = LEVEL_XP_THRESHOLDS[level]
    const xp = progress?.total_xp ?? 0

    gamification = {
      xp,
      level,
      nextLevel: thresholds?.nextLevel ?? null,
      nextLevelXp: thresholds?.next ?? xp,
      currentStreak: progress?.current_streak ?? 0,
    }
  } else if (role === "teacher") {
    const t = teacherRaw as { rating: number | null; total_reviews: number | null; experience_years: number | null } | null
    teacherStats = {
      rating: Number(t?.rating ?? 0),
      totalReviews: t?.total_reviews ?? 0,
      yearsExperience: t?.experience_years ?? null,
    }
  }

  return (
    <DashboardShell
      fullName={profile?.full_name ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      role={role}
      gamification={gamification}
      teacherStats={teacherStats}
    >
      {children}
    </DashboardShell>
  )
}
