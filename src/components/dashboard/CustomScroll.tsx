"use client"

// Скролл-область с кастомным скроллбаром по Figma: трек 7px rgba(30,30,30,.14) r3.5,
// ползунок #1E1E1E. Нативный скроллбар скрыт (на macOS он overlay и не совпадает с макетом).
// Классы: `${className}` (обёртка, position:relative), `${className}-scroll`, `${className}-bar`, `${className}-bar-thumb`.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"

export default function CustomScroll({
  children, className, track, scrollRef, ariaLabel, role,
}: {
  children: ReactNode
  className: string
  /** Высота трека в px. Если не задана — трек равен высоте скролл-области. */
  track?: number
  scrollRef?: RefObject<HTMLDivElement | null>
  ariaLabel?: string
  role?: string
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const ref = scrollRef ?? innerRef
  const [bar, setBar] = useState<{ h: number; y: number } | null>(null)
  const sync = () => {
    const el = ref.current
    if (!el) return
    const { scrollHeight: sh, clientHeight: ch, scrollTop: st } = el
    if (sh <= ch + 1) { setBar(null); return }
    const t = track ?? ch
    // минимальная высота ползунка как в макете (≈ .355 трека: 38/107, 67/188, 251/699)
    const h = Math.max(Math.round(t * 0.355), Math.round((t * ch) / sh))
    const y = Math.round(((t - h) * st) / (sh - ch))
    setBar({ h, y })
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const tm = setTimeout(sync, 0)
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    for (const c of Array.from(el.children)) ro.observe(c)
    return () => { clearTimeout(tm); ro.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className={className}>
      <div ref={ref} className={`${className}-scroll`} onScroll={sync} role={role} aria-label={ariaLabel}>
        {children}
      </div>
      {bar && (
        <div className={`${className}-bar`} style={track ? { height: track } : undefined} aria-hidden>
          <div className={`${className}-bar-thumb`} style={{ height: bar.h, transform: `translateY(${bar.y}px)` }} />
        </div>
      )}
    </div>
  )
}
