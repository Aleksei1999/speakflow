"use client"

import { DashboardError } from "@/components/errors/dashboard-error"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <DashboardError error={error} reset={reset} homeHref="/admin" />
}
