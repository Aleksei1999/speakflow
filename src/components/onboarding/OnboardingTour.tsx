"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

export type TourStep = {
  /** CSS-селектор элемента или null для центра экрана */
  target: string | null
  /** текст плашки */
  text: string
  /** короткий заголовок (опционально) */
  title?: string
  /** где плашка относительно элемента */
  placement?: "top" | "bottom" | "left" | "right" | "auto"
  /** offset в пикселях, чтобы обводка не липла впритык */
  padding?: number
}

interface Props {
  steps: TourStep[]
  /** запускать тур или нет (компонент сам ничего не fetch'ит) */
  active: boolean
  /** колбек когда юзер прошёл / скипнул тур */
  onClose: (reason: "completed" | "skipped") => void
}

const CSS = `
.ob-overlay{position:fixed;inset:0;z-index:9998;pointer-events:none}
.ob-overlay.ob-overlay--blocking{pointer-events:auto;background:rgba(10,10,10,0)}
.ob-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.ob-mark{stroke:#D8F26A;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round}
.ob-svg{filter:drop-shadow(0 0 10px rgba(216,242,106,.45))}
.ob-mark--draw{stroke-dasharray:var(--len);stroke-dashoffset:var(--len);animation:obDraw .75s cubic-bezier(.65,0,.35,1) forwards}
@keyframes obDraw{to{stroke-dashoffset:0}}
.ob-tip{position:absolute;z-index:9999;background:#1A1A18;color:#fff;border-radius:14px;padding:14px 16px;max-width:300px;box-shadow:0 18px 40px rgba(0,0,0,.45);pointer-events:auto;animation:obFadeIn .25s ease-out}
.ob-tip-title{font-size:13px;font-weight:800;letter-spacing:-.2px;margin-bottom:4px;color:#D8F26A}
.ob-tip-text{font-size:14px;line-height:1.5;font-weight:500}
.ob-tip-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}
.ob-tip-meta{font-size:11px;color:rgba(255,255,255,.5);font-weight:600;letter-spacing:.3px}
.ob-tip-actions{display:flex;align-items:center;gap:6px}
.ob-tip-skip{background:transparent;border:none;color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer;padding:6px 8px;border-radius:8px}
.ob-tip-skip:hover{color:#fff;background:rgba(255,255,255,.05)}
.ob-tip-next{background:#D8F26A;color:#0A0A0A;border:none;font-size:13px;font-weight:800;cursor:pointer;padding:8px 14px;border-radius:100px;transition:all .15s}
.ob-tip-next:hover{background:#fff}
.ob-tip-arrow{position:absolute;width:14px;height:14px;background:#1A1A18;transform:rotate(45deg)}
@keyframes obFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.ob-veil{position:fixed;inset:0;background:rgba(10,10,10,.35);z-index:9997;pointer-events:auto;animation:obFadeIn .3s ease-out}
[data-theme="light"] .ob-veil{background:rgba(10,10,10,.18)}
`

function getRect(selector: string | null): DOMRect | null {
  if (!selector) return null
  if (typeof window === "undefined") return null

  const matches = document.querySelectorAll(selector)
  // eslint-disable-next-line no-console
  console.log("[onboarding] lookup", selector, "→", matches.length, "match(es)")

  const el = matches[0] as HTMLElement | undefined
  if (!el) return null

  const r = el.getBoundingClientRect()
  // eslint-disable-next-line no-console
  console.log("[onboarding] rect", selector, {
    top: r.top, left: r.left, width: r.width, height: r.height,
    display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility,
  })

  if (r.width < 4 || r.height < 4) return null

  const inView = r.top >= 0 && r.bottom <= window.innerHeight
  if (!inView) {
    el.scrollIntoView({ block: "center", behavior: "smooth" })
  }
  return r
}

export default function OnboardingTour({ steps, active, onClose }: Props) {
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [tick, setTick] = useState(0) // force remeasure
  const closedRef = useRef(false)

  const step = steps[idx]
  const total = steps.length

  // Re-measure target when step changes / on resize / scroll.
  useLayoutEffect(() => {
    if (!active || !step) return
    const measure = () => {
      const r = getRect(step.target)
      setRect(r)
    }
    // initial measure may happen before scrollIntoView animation finishes — ремирим несколько раз
    measure()
    const t1 = setTimeout(measure, 200)
    const t2 = setTimeout(measure, 480)
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [active, step, idx, tick])

  if (!active || !step || closedRef.current) return null

  const padding = step.padding ?? 8

  // Compute oval rect (offset by padding) and tip position.
  let ovalLeft = 0,
    ovalTop = 0,
    ovalW = 0,
    ovalH = 0,
    tipStyle: React.CSSProperties = {},
    arrowStyle: React.CSSProperties | null = null

  if (rect) {
    ovalLeft = rect.left - padding
    ovalTop = rect.top - padding
    ovalW = rect.width + padding * 2
    ovalH = rect.height + padding * 2

    // Decide placement
    const placement = step.placement === "auto" || !step.placement
      ? rect.top > 200 ? "top" : "bottom"
      : step.placement

    const tipW = 300
    const tipH = 130 // approx
    if (placement === "top") {
      tipStyle = {
        left: Math.max(12, Math.min(window.innerWidth - tipW - 12, rect.left + rect.width / 2 - tipW / 2)),
        top: Math.max(12, ovalTop - tipH - 16),
      }
      arrowStyle = {
        left: rect.left + rect.width / 2 - 7 - (typeof tipStyle.left === "number" ? tipStyle.left : 0),
        bottom: -7,
      }
    } else if (placement === "bottom") {
      tipStyle = {
        left: Math.max(12, Math.min(window.innerWidth - tipW - 12, rect.left + rect.width / 2 - tipW / 2)),
        top: ovalTop + ovalH + 16,
      }
      arrowStyle = {
        left: rect.left + rect.width / 2 - 7 - (typeof tipStyle.left === "number" ? tipStyle.left : 0),
        top: -7,
      }
    } else if (placement === "right") {
      tipStyle = {
        left: ovalLeft + ovalW + 16,
        top: Math.max(12, rect.top + rect.height / 2 - tipH / 2),
      }
      arrowStyle = { left: -7, top: tipH / 2 - 7 }
    } else {
      tipStyle = {
        left: Math.max(12, ovalLeft - tipW - 16),
        top: Math.max(12, rect.top + rect.height / 2 - tipH / 2),
      }
      arrowStyle = { right: -7, top: tipH / 2 - 7 }
    }
  } else {
    // no target — center tip
    tipStyle = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    }
  }

  // Hand-drawn marker outline. We trace the perimeter of a "stadium"
  // (rounded rect with semicircular caps), add deterministic wobble per
  // sample, slightly tilt the whole thing, and overshoot the seam by ~15%
  // so the stroke crosses past its start like a real marker pass.
  // For thin/tall rects this collapses naturally to an oval; for wide ones
  // it stays a sane pill — never a giant stretched ellipse.
  const ovalPath = useMemo(() => {
    if (!rect) return { d: "", length: 0 }
    const padX = 8
    const padY = 6
    const left = ovalLeft - padX
    const top = ovalTop - padY
    const w = ovalW + padX * 2
    const h = ovalH + padY * 2
    const cap = h / 2 // полукруг по высоте
    const cx = left + w / 2
    const cy = top + h / 2
    const tilt = -0.025 // ~-1.4° для лёгкого «от руки»
    const cosT = Math.cos(tilt)
    const sinT = Math.sin(tilt)

    const segArc = 24
    const segStraight = Math.max(2, Math.round((w - 2 * cap) / 14))

    // Список сегментов периметра в порядке обхода:
    //   top straight → right arc → bottom straight → left arc → overshoot top
    const raw: [number, number][] = []
    // top straight (left to right)
    for (let i = 0; i <= segStraight; i++) {
      const x = left + cap + (w - 2 * cap) * (i / segStraight)
      raw.push([x, top])
    }
    // right cap (от 270° через 0° к 90°)
    const rcx = left + w - cap
    for (let i = 1; i <= segArc; i++) {
      const t = -Math.PI / 2 + Math.PI * (i / segArc)
      raw.push([rcx + cap * Math.cos(t), cy + cap * Math.sin(t)])
    }
    // bottom straight (right to left)
    for (let i = 1; i <= segStraight; i++) {
      const x = left + w - cap - (w - 2 * cap) * (i / segStraight)
      raw.push([x, top + h])
    }
    // left cap (от 90° через 180° к 270°)
    const lcx = left + cap
    for (let i = 1; i <= segArc; i++) {
      const t = Math.PI / 2 + Math.PI * (i / segArc)
      raw.push([lcx + cap * Math.cos(t), cy + cap * Math.sin(t)])
    }
    // overshoot — продолжаем по верхней прямой ~25% длины
    const overshoot = Math.max(2, Math.round(segStraight * 0.35))
    for (let i = 1; i <= overshoot; i++) {
      const x = left + cap + (w - 2 * cap) * (i / segStraight)
      raw.push([x, top])
    }

    // tilt + jitter
    const pts: [number, number][] = raw.map(([x, y], i) => {
      const dx = x - cx
      const dy = y - cy
      const rx = dx * cosT - dy * sinT
      const ry = dx * sinT + dy * cosT
      const jx = Math.sin(i * 1.7 + 0.3) * 1.4
      const jy = Math.cos(i * 1.3 + 0.7) * 1.2
      return [cx + rx + jx, cy + ry + jy]
    })

    let length = 0
    let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
    for (let i = 1; i < pts.length; i++) {
      const dxp = pts[i][0] - pts[i - 1][0]
      const dyp = pts[i][1] - pts[i - 1][1]
      length += Math.sqrt(dxp * dxp + dyp * dyp)
      d += ` L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`
    }
    return { d, length }
  }, [rect, ovalLeft, ovalTop, ovalW, ovalH])

  const len = ovalPath.length

  const handleNext = () => {
    if (idx < total - 1) {
      setIdx(idx + 1)
    } else {
      closedRef.current = true
      onClose("completed")
    }
  }
  const handleSkip = () => {
    closedRef.current = true
    onClose("skipped")
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ob-veil" />
      <div className="ob-overlay">
        {rect ? (
          <svg className="ob-svg" key={`${idx}-${tick}`}>
            <defs>
              <filter id="ob-rough" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="3" />
                <feDisplacementMap in="SourceGraphic" scale="2.4" />
              </filter>
            </defs>
            <path
              className="ob-mark ob-mark--draw"
              style={{ ["--len" as any]: len }}
              filter="url(#ob-rough)"
              d={ovalPath.d}
            />
          </svg>
        ) : null}

        <div className="ob-tip" style={tipStyle}>
          {arrowStyle ? <div className="ob-tip-arrow" style={arrowStyle} /> : null}
          {step.title ? <div className="ob-tip-title">{step.title}</div> : null}
          <div className="ob-tip-text">{step.text}</div>
          <div className="ob-tip-row">
            <div className="ob-tip-meta">
              {idx + 1} / {total}
            </div>
            <div className="ob-tip-actions">
              <button className="ob-tip-skip" onClick={handleSkip}>
                Пропустить
              </button>
              <button className="ob-tip-next" onClick={handleNext}>
                {idx === total - 1 ? "Готово" : "Дальше →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
