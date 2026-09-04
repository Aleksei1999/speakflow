// Список зелёных плашек «Домашние задания / Библиотека / История занятий».
// Используется на всех дашбордах (teacher/admin/student). Дизайн: Figma 2208:3327,
// стрелка ← из node 2208:1189 (заливная #1E1E1E, круг Ø71 с белой обводкой,
// сидит серединой на правом крае плашки).
//
// Стили — public/dashboard/shared-pills.css (класс .hw-pill-list).

import Link from "next/link"

export interface HwPillItem {
  label: React.ReactNode
  /** URL для Link. Если задан onClick — рендерим <button>. */
  href?: string
  onClick?: () => void
  /** DOM id — например для якорной навигации (#library). */
  id?: string
}

interface HwPillListProps {
  items: HwPillItem[]
  className?: string
}

export function HwPillList({ items, className }: HwPillListProps) {
  return (
    <div className={`hw-pill-list${className ? ` ${className}` : ""}`}>
      {items.map((item, i) => {
        const inner = (
          <>
            <span className="hw-pill-body">
              <span className="hw-pill-text">{item.label}</span>
            </span>
            <span className="hw-pill-arrow" aria-hidden>
              <HwPillArrow />
            </span>
          </>
        )
        if (item.href) {
          return (
            <Link key={i} href={item.href} className="hw-pill" id={item.id}>
              {inner}
            </Link>
          )
        }
        return (
          <button key={i} type="button" className="hw-pill" id={item.id} onClick={item.onClick}>
            {inner}
          </button>
        )
      })}
    </div>
  )
}

function HwPillArrow() {
  return (
    <svg
      viewBox="0 0 37 37"
      width="32"
      height="32"
      fill="none"
      style={{ transform: "scaleX(-1)" }}
    >
      <path
        d="M2.5 15.9099C1.11929 15.9099 0 17.0292 0 18.4099C0 19.7906 1.11929 20.9099 2.5 20.9099V18.4099V15.9099ZM36.2678 20.1777C37.2441 19.2014 37.2441 17.6184 36.2678 16.6421L20.3579 0.732233C19.3816 -0.244078 17.7986 -0.244078 16.8223 0.732233C15.846 1.70854 15.846 3.29146 16.8223 4.26777L30.9645 18.4099L16.8223 32.552C15.846 33.5283 15.846 35.1113 16.8223 36.0876C17.7986 37.0639 19.3816 37.0639 20.3579 36.0876L36.2678 20.1777ZM2.5 18.4099V20.9099H34.5V18.4099V15.9099H2.5V18.4099Z"
        fill="currentColor"
      />
    </svg>
  )
}
