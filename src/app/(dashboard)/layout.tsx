import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { LEVEL_XP_THRESHOLDS, type RoastLevel } from "@/lib/level-utils"

// Don't cache the layout — avatar_url / role / progress must always reflect
// current DB state (e.g. fresh OAuth identity, post-migration backfills).
export const dynamic = "force-dynamic"

const LEVEL_ORDER = ["Raw", "Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"] as const

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Parallelize profile + user_progress + teacher_profiles in a single round-trip —
  // we don't know the role yet, so we eagerly fetch both progress sources and pick
  // the relevant one below. Cheaper than a second sequential round-trip.
  const [{ data: profileRaw }, { data: progressRaw }, { data: teacherRaw }] = await Promise.all([
    (supabase as any)
      .from("profiles")
      .select("full_name, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle(),
    (supabase as any)
      .from("user_progress")
      .select("total_xp, english_level, current_streak")
      .eq("user_id", user.id)
      .maybeSingle(),
    (supabase as any)
      .from("teacher_profiles")
      .select("rating, total_reviews, experience_years")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  const profile = profileRaw as { full_name: string | null; avatar_url: string | null; role: "student" | "teacher" | "admin" | null } | null
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
