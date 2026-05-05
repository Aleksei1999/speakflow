// @ts-nocheck
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import OnboardingTour from "./OnboardingTour"
import { TEACHER_TOUR_STEPS } from "./teacher-steps"

interface Props {
  role: "student" | "teacher" | "admin"
}

/**
 * Поднимается клиентом на dashboard root. Сам сходит в profiles за
 * onboarding_step и, если 'pending', запустит тур по шагам соответствующей роли.
 */
export default function OnboardingLauncher({ role }: Props) {
  const [active, setActive] = useState(false)
  const [steps, setSteps] = useState<typeof TEACHER_TOUR_STEPS>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data } = await supabase
        .from("profiles")
        .select("onboarding_step, role")
        .eq("id", user.id)
        .maybeSingle()

      if (cancelled || !data) return
      if (data.onboarding_step !== "pending") return

      // Подбираем набор шагов по реальной роли (на случай несовпадения пропа).
      const actualRole = data.role || role
      if (actualRole === "teacher") {
        setSteps(TEACHER_TOUR_STEPS)
      } else {
        // Для student/admin пока туров нет — сразу помечаем completed.
        await fetch("/api/onboarding/complete", { method: "POST" })
        return
      }

      // Даём 600мс на mount страницы, чтобы data-onboarding-якоря успели смонтироваться.
      setTimeout(() => {
        if (!cancelled) setActive(true)
      }, 600)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [role])

  if (!active || steps.length === 0) return null

  return (
    <OnboardingTour
      steps={steps}
      active={active}
      onClose={async () => {
        setActive(false)
        try {
          await fetch("/api/onboarding/complete", { method: "POST" })
        } catch {}
      }}
    />
  )
}
