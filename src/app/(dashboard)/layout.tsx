import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

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

  return (
    <DashboardShell
      fullName={profile?.full_name ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      role={profile?.role ?? null}
    >
      {children}
    </DashboardShell>
  )
}
