// @ts-nocheck
// ---------------------------------------------------------------
// Admin role gate for API routes.
//
// Usage:
//   const supabase = await createClient()
//   const gate = await requireAdmin(supabase)
//   if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
//   const adminUser = gate.user
// ---------------------------------------------------------------

type AdminGateOk = { ok: true; user: { id: string; email?: string | null } }
type AdminGateFail = { ok: false; status: 401 | 403; error: string }

export async function requireAdmin(supabase: any): Promise<AdminGateOk | AdminGateFail> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, status: 401, error: "Не авторизован" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || profile.role !== "admin") {
    return { ok: false, status: 403, error: "Доступ только для админов" }
  }

  return { ok: true, user }
}
