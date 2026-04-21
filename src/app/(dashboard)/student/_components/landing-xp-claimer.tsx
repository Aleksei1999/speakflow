"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const LANDING_XP_KEY = "raw_landing_xp_pending"

type Toast = { amount: number } | null

export function LandingXpClaimer() {
  const router = useRouter()
  const [toast, setToast] = useState<Toast>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    let raw: string | null
    try {
      raw = window.localStorage.getItem(LANDING_XP_KEY)
    } catch {
      return
    }
    if (!raw) return

    let payload: { xp?: number; lvl?: number } | null = null
    try {
      payload = JSON.parse(raw)
    } catch {
      try { window.localStorage.removeItem(LANDING_XP_KEY) } catch {}
      return
    }

    const xp = Math.floor(Number(payload?.xp) || 0)
    const level = Math.floor(Number(payload?.lvl) || 0)
    if (xp <= 0) {
      try { window.localStorage.removeItem(LANDING_XP_KEY) } catch {}
      return
    }

    const cancelled = { current: false }

    fetch("/api/onboarding/claim-landing-xp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xp, level }),
    })
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as { credited?: number }
      })
      .then((data) => {
        if (cancelled.current) return
        try { window.localStorage.removeItem(LANDING_XP_KEY) } catch {}
        const credited = Number(data?.credited) || 0
        if (credited > 0) {
          setToast({ amount: credited })
          router.refresh()
          window.setTimeout(() => setToast(null), 4200)
        }
      })
      .catch(() => {
        // Leave localStorage so next dashboard visit retries.
      })

    return () => { cancelled.current = true }
  }, [router])

  if (!toast) return null

  return (
    <>
      <div className="lxp-toast" role="status" aria-live="polite">
        <div className="lxp-toast__icon">🔥</div>
        <div className="lxp-toast__body">
          <div className="lxp-toast__title">+{toast.amount} XP с лендинга</div>
          <div className="lxp-toast__sub">Записано в твой прогресс</div>
        </div>
      </div>
      <style>{`
        .lxp-toast {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          background: linear-gradient(135deg, #2a1510 0%, #3a1a14 100%);
          border: 1px solid rgba(255, 97, 74, .45);
          border-radius: 14px;
          box-shadow: 0 14px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04) inset;
          color: #fff;
          font-family: Inter, system-ui, sans-serif;
          animation: lxpIn .35s cubic-bezier(.2,.7,.2,1.1);
        }
        .lxp-toast__icon { font-size: 28px; line-height: 1; }
        .lxp-toast__title { font-size: 14px; font-weight: 700; letter-spacing: .2px; }
        .lxp-toast__sub { font-size: 12px; color: rgba(255,255,255,.65); margin-top: 2px; }
        @keyframes lxpIn {
          from { transform: translateY(16px) scale(.96); opacity: 0; }
          to   { transform: translateY(0) scale(1);     opacity: 1; }
        }
      `}</style>
    </>
  )
}
