// Список зелёных плашек «Домашние задания / Библиотека / История занятий».
// Используется на всех дашбордах (teacher/admin/student). Дизайн: Figma 2208:3327,
// стрелка ← из node 2208:1189 (заливная #1E1E1E, круг Ø71 с белой обводкой,
// сидит серединой на правом крае плашки).
//
// Стили — public/dashboard/shared-pills.css (класс .hw-pill-list).

import Link from "next/link"
import { ArrowIcon } from "@/components/icons/ArrowIcon"

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
  return <ArrowIcon direction="left" size={32} />
}
