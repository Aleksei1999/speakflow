// @ts-nocheck
// ---------------------------------------------------------------------------
// /group-call/[groupId] — комната для группового звонка.
//
// Auth (server-side):
//   • юзер залогинен;
//   • он участник группы (owner-teacher, member-student или admin)
//     — проверяем через SQL is_group_participant().
// Клиент подключается к LiveKit через /api/livekit/group-token.
// Recording / notes / chat в этой комнате не подключены — чат в модалке
// GroupChatModal, запись только для 1:1 уроков.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

import GroupCallClient from "@/components/group-call/GroupCallClient"

export const dynamic = "force-dynamic"

export default async function GroupCallPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  if (!groupId) redirect("/")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/group-call/${groupId}`)}`)

  const admin = createAdminClient() as any
  const { data: allowed } = await admin.rpc("is_group_participant", {
    gid: groupId,
    uid: user.id,
  })
  if (!allowed) redirect("/")

  const { data: group } = await admin
    .from("teacher_groups")
    .select("id, name")
    .eq("id", groupId)
    .maybeSingle()
  const groupName = (group as { name: string } | null)?.name ?? "Групповой звонок"

  return <GroupCallClient groupId={groupId} groupName={groupName} />
}
