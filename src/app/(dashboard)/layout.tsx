import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

const LEVEL_ORDER = ["Raw", "Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"] as const
const LEVEL_XP_THRESHOLDS: Record<string, { next: string | null; target: number }> = {
  Raw: { next: "Rare", target: 100 },
  Rare: { next: "Medium Rare", target: 250 },
  "Medium Rare": { next: "Medium", target: 500 },
  Medium: { next: "Medium Well", target: 1000 },
  "Medium Well": { next: "Well Done", target: 2000 },
  "Well Done": { next: null, target: 5000 },
}

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
    const level = (progress?.english_level && LEVEL_ORDER.includes(progress.english_level as (typeof LEVEL_ORDER)[number]))
      ? progress.english_level as string
      : "Raw"
    const thresholds = LEVEL_XP_THRESHOLDS[level]

    gamification = {
      xp: progress?.total_xp ?? 0,
      level,
      nextLevel: thresholds?.next ?? null,
      nextLevelXp: thresholds?.target ?? 100,
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
