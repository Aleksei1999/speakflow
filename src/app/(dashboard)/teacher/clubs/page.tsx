// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { getCachedTeacherClubs } from "@/lib/cache/dashboard"
import TeacherClubsClient from "./TeacherClubsClient"

// Auth check uses cookies() → page is per-request dynamic. Club listings
// come from getCachedTeacherClubs (unstable_cache, TTL 60s, tag
// 'teacher-clubs-${userId}'), invalidated when admin assigns/cancels a club
// or when the teacher marks a club seen.
export const revalidate = 60

export default async function TeacherClubsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Reuse cached role from layout.
  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role === "student") redirect("/student")
  if (role === "admin") redirect("/admin")
  if (role !== "teacher") redirect("/login")

  let initial: { clubs: any[]; unread_count: number }
  try {
    initial = await getCachedTeacherClubs(user.id)
  } catch (err) {
    console.error("[teacher/clubs] cached loader failed", err)
    initial = { clubs: [], unread_count: 0 }
  }

  return <TeacherClubsClient initial={initial} />
}
