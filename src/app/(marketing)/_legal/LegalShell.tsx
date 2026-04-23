// @ts-nocheck
"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RawLogo } from "@/components/ui/raw-logo"
import "../_landing/landing.css"
import "./legal.css"

type Props = {
  eyebrow: string
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function LegalShell({ eyebrow, title, subtitle, children }: Props) {
  useEffect(() => {
    const html = document.documentElement
    const prev = html.dataset.theme
    html.dataset.theme = "light"
    html.dataset.legal = "true"
    return () => {
      if (prev) html.dataset.theme = prev
      else delete html.dataset.theme
      delete html.dataset.legal
    }
  }, [])

  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <div className="legal-nav-inner">
          <Link href="/" aria-label="На главную" style={{ display: "inline-flex", alignItems: "center" }}>
            <RawLogo size={32} />
          </Link>
          <Link href="/" className="legal-back">← На главную</Link>
        </div>
      </nav>

      <main className="legal-container">
        <div className="legal-eyebrow">{eyebrow}</div>
        <h1 className="legal-h1">{title}</h1>
        {subtitle ? <p className="legal-sub">{subtitle}</p> : null}

        <div className="legal-prose">{children}</div>

        <div className="legal-footer">
          Raw English · ИП Кратковская Валерия Витальевна · ОГРНИП 325619600134369 · ИНН 616485783606
        </div>
      </main>
    </div>
  )
}
