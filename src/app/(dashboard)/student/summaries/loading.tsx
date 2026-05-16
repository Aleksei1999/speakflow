import { getTranslations } from "next-intl/server"
import { DashboardSkeleton } from "@/components/loading/dashboard-skeleton"
export default async function L() {
  const t = await getTranslations("dashboard.student.summaries")
  return <DashboardSkeleton label={t("loadingLabel")} />
}
