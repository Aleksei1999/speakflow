import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { ReferralsClient, type ReferralsData } from "./_components/referrals-client"

// Реферальная страница SSR: тянет /api/referrals/me с cookie и передаёт в клиент.
export const dynamic = "force-dynamic"

export default async function ReferralsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Пытаемся получить данные с API. Backend-агент может ещё не зарелизить endpoint —
  // тогда отдаём разумный дефолт: пустой код, пустые invitees. Клиент сам сделает retry
  // на mount через window.fetch, если пустой код.
  let data: ReferralsData | null = null
  try {
    const hdrs = await headers()
    const host = hdrs.get("host") ?? ""
    const proto =
      hdrs.get("x-forwarded-proto") ??
      (host.includes("localhost") ? "http" : "https")
    const cookieStore = await cookies()
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ")
    const res = await fetch(`${proto}://${host}/api/referrals/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    })
    if (res.ok) {
      const json = await res.json()
      data = normalize(json)
    }
  } catch {
    // noop — клиент покажет пустое состояние и попробует ещё раз
  }

  if (!data) {
    data = {
      code: "",
      share_url: "",
      stats: { sent: 0, registered: 0, activated: 0 },
      cap_remaining: 10,
      invitees: [],
    }
  }

  return <ReferralsClient initialData={data} />
}

function normalize(json: any): ReferralsData {
  const stats = json?.stats ?? {}
  return {
    code: typeof json?.code === "string" ? json.code : "",
    share_url: typeof json?.share_url === "string" ? json.share_url : "",
    stats: {
      sent: Number(stats.sent ?? 0),
      registered: Number(stats.registered ?? 0),
      activated: Number(stats.activated ?? 0),
    },
    cap_remaining: Number(json?.cap_remaining ?? 10),
    invitees: Array.isArray(json?.invitees)
      ? json.invitees.map((i: any) => ({
          masked_email: String(i?.masked_email ?? ""),
          status: (i?.status ?? "sent") as InviteStatus,
          created_at: String(i?.created_at ?? ""),
          activated_at: i?.activated_at ? String(i.activated_at) : null,
          xp_awarded: Number(i?.xp_awarded ?? 0),
        }))
      : [],
  }
}

type InviteStatus = "sent" | "registered" | "activated" | "expired"
