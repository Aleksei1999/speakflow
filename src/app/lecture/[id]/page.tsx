// @ts-nocheck
// ---------------------------------------------------------------------------
// /lecture/[id] — комната для видео-звонка лекции.
// Auth (server-side): юзер залогинен + лекция опубликована.
// Клиент подключается к LiveKit через /api/livekit/lecture-token.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

import LectureCallClient from "@/components/lecture-call/LectureCallClient"

export const dynamic = "force-dynamic"

export default async function LectureCallPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!id) redirect("/")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/lecture/${id}`)}`)

  const admin = createAdminClient() as any
  const { data: lecture } = await admin
    .from("lectures")
    .select("id, title, is_published")
    .eq("id", id)
    .maybeSingle()
  if (!lecture || lecture.is_published === false) redirect("/")

  const title = (lecture as { title: string | null }).title ?? "Лекция"

  return <LectureCallClient lectureId={id} title={title} />
}
