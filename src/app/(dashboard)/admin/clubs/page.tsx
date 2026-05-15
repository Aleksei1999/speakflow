// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import {
  getCachedAdminClubs,
  getCachedAdminTeachersList,
} from "@/lib/cache/dashboard"
import AdminClubsClient from "./AdminClubsClient"

// Auth check uses cookies() → page is per-request dynamic. Clubs +
// teacher list come from getCachedAdminClubs / getCachedAdminTeachersList
// (unstable_cache, 60-120s TTL, tags 'admin-clubs' / 'admin-teachers-list').
export const revalidate = 60

type Club = {
  id: string
  title: string
  description: string | null
  level: string | null
  scheduled_at: string
  duration_minutes: number
  capacity: number
  registered_count: number
  host_teacher_id: string | null
  host_teacher_name: string | null
  status: "draft" | "published" | "cancelled" | "completed"
}

type TeacherOption = {
  id: string
  full_name: string
}

export default async function AdminClubsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role === "student") redirect("/student")
  if (role === "teacher") redirect("/teacher")
  if (role !== "admin") redirect("/login")

  let clubs: Club[] = []
  let teachers: TeacherOption[] = []
  try {
    const [clubsSnap, teacherList] = await Promise.all([
      getCachedAdminClubs({ limit: 50 }),
      getCachedAdminTeachersList({ limit: 100 }),
    ])
    clubs = (clubsSnap.clubs ?? []) as Club[]
    teachers = teacherList
      // club_hosts.host_id FKs profiles(id); we already cache user_id
      // as `id` in the loader, so the shape matches.
      .filter((t) => !!t.id)
      .map((t) => ({ id: t.id, full_name: t.full_name || "—" }))
  } catch (err) {
    console.error("[admin/clubs] cached loaders failed", err)
  }

  return <AdminClubsClient initial={{ clubs, teachers }} />
}
