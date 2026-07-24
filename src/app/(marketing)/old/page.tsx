import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import LandingClient from "../_landing/LandingClient"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

// Previous (Duolingo-style) landing, kept at /old for reference/rollback.
export const revalidate = 3600

export default function OldHome() {
  return <LandingClient />
}
