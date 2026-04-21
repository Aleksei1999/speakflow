import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { LEVEL_XP_THRESHOLDS, type RoastLevel } from "@/lib/level-utils"

const LEVEL_ORDER = ["Raw", "Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"] as const

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profileRaw } = await (supabase as any)
    .from("profiles")
    .select("full_name, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle()

  const profile = profileRaw as { full_name: string | null; avatar_url: string | null; role: "student" | "teacher" | "admin" | null } | null
  const role = profile?.role ?? null

  let gamification: {
    xp: number
    level: string
    nextLevel: string | null
    nextLevelXp: number
    currentStreak: number
  } | null = null

  if (role === "student") {
    const { data: progressRaw } = await (supabase as any)
      .from("user_progress")
      .select("total_xp, english_level, current_streak")
      .eq("user_id", user.id)
      .maybeSingle()

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
  }

  return (
    <DashboardShell
      fullName={profile?.full_name ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      role={role}
      gamification={gamification}
    >
      {children}
    </DashboardShell>
  )
}
