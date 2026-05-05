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
.ob-mark{stroke:#D8F26A;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 12px rgba(216,242,106,.55))}
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
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return null
  el.scrollIntoView({ block: "center", behavior: "smooth" })
  return el.getBoundingClientRect()
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
    // initial measure may happen before scrollIntoView animation finishes — ремирим через 350мс
    measure()
    const t = setTimeout(measure, 380)
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      clearTimeout(t)
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

  // Approximate path length for stroke-dasharray (perimeter of rounded rect).
  const len = rect ? 2 * (ovalW + ovalH) : 0

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
      <div className="ob-veil" onClick={handleSkip} />
      <div className="ob-overlay">
        {rect ? (
          <svg className="ob-svg" key={`${idx}-${tick}`}>
            {/* Wobble path: вытянутый овал-маркер с лёгким перерасходом по углам, как от руки */}
            <path
              className="ob-mark ob-mark--draw"
              style={{ ["--len" as any]: len }}
              d={`
                M ${ovalLeft + 12} ${ovalTop}
                Q ${ovalLeft - 6} ${ovalTop} ${ovalLeft - 4} ${ovalTop + 14}
                L ${ovalLeft - 5} ${ovalTop + ovalH - 14}
                Q ${ovalLeft - 8} ${ovalTop + ovalH + 6} ${ovalLeft + 14} ${ovalTop + ovalH + 4}
                L ${ovalLeft + ovalW - 16} ${ovalTop + ovalH + 5}
                Q ${ovalLeft + ovalW + 6} ${ovalTop + ovalH + 4} ${ovalLeft + ovalW + 4} ${ovalTop + ovalH - 14}
                L ${ovalLeft + ovalW + 5} ${ovalTop + 16}
                Q ${ovalLeft + ovalW + 4} ${ovalTop - 6} ${ovalLeft + ovalW - 18} ${ovalTop - 4}
                L ${ovalLeft + 14} ${ovalTop - 5}
                Q ${ovalLeft - 6} ${ovalTop - 4} ${ovalLeft + 8} ${ovalTop + 4}
              `}
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
