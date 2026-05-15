import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import StudentMaterialsClient from "./StudentMaterialsClient"

type InitialSnapshot = {
  materials: any[]
  counts: Record<string, number>
}

const EMPTY_SNAPSHOT: InitialSnapshot = {
  materials: [],
  counts: {
    all: 0, pdf: 0, ppt: 0, doc: 0, video: 0, audio: 0, img: 0, link: 0,
    "A1-A2": 0, B1: 0, B2: 0, "C1+": 0,
  },
}

export const dynamic = "force-dynamic"

export default async function StudentMaterialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Use the per-request cached role (already loaded by (dashboard)/layout.tsx
  // via getCachedProfile → unstable_cache). Reading from `profiles` here
  // again would be a redundant Supabase round-trip on every render.
  const role = await getCachedRole(user.id)
  if (role !== "student") {
    if (role === "teacher") redirect("/teacher")
    if (role === "admin") redirect("/admin")
    redirect("/login")
  }

  // Load on client only — avoids self-fetch loop on reload (host+cookie
  // sometimes resolves to the CF/RU proxy and stalls). Client uses relative URL.
  return <StudentMaterialsClient initial={EMPTY_SNAPSHOT} />
}
