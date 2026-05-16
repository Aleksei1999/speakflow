import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import LandingClient from "./_landing/LandingClient"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

// Make homepage statically generated, revalidated hourly so Vercel can cache it on the edge.
// Auth state is resolved on the client via useUser() inside LandingClient — see CTA logic there.
export const revalidate = 3600

export default function Home() {
  return <LandingClient />
}
