"use client"

// Масштаб модалок, вынесенных порталом в body. Страницы кабинета масштабируются
// через `--raw2-zoom` (пропорционально ширине экрана, cap 1.4), портал в body из-под
// этого zoom выпадает. Берём тот же коэффициент, но не больше, чем влезает в окно
// (с полями 20px), чтобы модалку не резало по высоте на широких мониторах.

import { useEffect, useState } from "react"

export function useFitZoom(width: number, height: number, margin = 40): number {
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const calc = () => {
      const raw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--raw2-zoom")) || 1
      const fit = Math.min(raw, (window.innerHeight - margin) / height, (window.innerWidth - margin) / width)
      setZoom(Math.max(0.5, Math.min(raw, fit)))
    }
    calc()
    window.addEventListener("resize", calc)
    return () => window.removeEventListener("resize", calc)
  }, [width, height, margin])
  return zoom
}
