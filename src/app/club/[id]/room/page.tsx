// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeLessonAccess } from "@/lib/lesson-access"
import { JITSI_CONFIG } from "@/lib/jitsi/config"
import { generateJitsiToken } from "@/lib/jitsi/jwt"
import { ClubRoomClient } from "@/components/club/club-room-client"
import { ClubGate } from "@/components/club/club-gate"

export const dynamic = "force-dynamic"

export default async function ClubRoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email, role")
    .eq("id", user.id)
    .single()
  if (!profile) redirect("/login")

  const admin = createAdminClient()

  // Authoritative club + host + my registration in parallel.
  const [{ data: club }, { data: hostRow }, { data: regRow }] =
    await Promise.all([
      admin
        .from("clubs")
        .select(
          "id, topic, starts_at, duration_min, cancelled_at, is_published"
        )
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("club_hosts")
        .select("host_id")
        .eq("club_id", id)
        .eq("host_id", user.id)
        .maybeSingle(),
      admin
        .from("club_registrations")
        .select("id, status")
        .eq("club_id", id)
        .eq("user_id", user.id)
        .in("status", ["registered", "pending_payment", "attended"])
        .maybeSingle(),
    ])

  if (!club) {
    redirect("/")
  }
  if (!club.is_published || club.cancelled_at) {
    redirect("/")
  }

  const isHost = !!hostRow
  const isRegisteredStudent = !!regRow
  const isAdmin = profile.role === "admin"

  if (!isHost && !isRegisteredStudent && !isAdmin) {
    // Send back to the right list page.
    if (profile.role === "teacher") redirect("/teacher/clubs")
    redirect("/student/clubs")
  }

  const access = computeLessonAccess({
    scheduledAt: club.starts_at,
    durationMinutes: club.duration_min ?? 60,
  })

  const backHref =
    profile.role === "teacher"
      ? "/teacher/clubs"
      : profile.role === "admin"
        ? "/admin/clubs"
        : "/student/clubs"

  if (access.status !== "live") {
    return (
      <ClubGate
        scheduledAt={club.starts_at}
        durationMinutes={club.duration_min ?? 60}
        title={club.topic}
        initialStatus={access.status}
        cancelled={!!club.cancelled_at}
        backHref={backHref}
      />
    )
  }

  const roomName = `speakflow-club-${club.id}`
  const token = await generateJitsiToken(roomName, {
    id: profile.id,
    name: profile.full_name || profile.email || "Гость",
    email: profile.email || "guest@speakflow",
    avatarUrl: profile.avatar_url,
    isModerator: isHost || isAdmin,
  })

  return (
    <ClubRoomClient
      clubId={club.id}
      title={club.topic}
      scheduledAt={club.starts_at}
      durationMinutes={club.duration_min ?? 60}
      jitsiDomain={JITSI_CONFIG.domain}
      jitsiToken={token}
      jitsiRoom={roomName}
      userId={profile.id}
      userName={profile.full_name || profile.email || "Гость"}
      isModerator={isHost || isAdmin}
      backHref={backHref}
    />
  )
}
