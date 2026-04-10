import { MarketingHeader } from "@/components/layout/header"
import { MarketingFooter } from "@/components/layout/footer"
import { StickyCTA } from "@/components/layout/sticky-cta"
import { createClient } from "@/lib/supabase/server"

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    role = profile?.role ?? "student"
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader isAuthenticated={!!user} role={role} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <StickyCTA />
    </div>
  )
}
