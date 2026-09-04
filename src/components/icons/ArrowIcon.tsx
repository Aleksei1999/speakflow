// Единая стрелка для всех кабинетов (student/teacher/admin + landing +
// комната урока). Форма — Figma «Vector 44» (37×37, длинная стрелка
// влево: линия + треугольник-остриё).
//
// По умолчанию направление left. Right/up/down — через `transform: rotate`
// на корне SVG. Цвет через `color:` в родителе (fill=currentColor).
//
// Правило: fill=currentColor всегда. Задавайте color в CSS/style.

import type { SVGProps } from "react"

type Direction = "left" | "right" | "up" | "down"

const ROTATION: Record<Direction, number> = {
  left: 0,
  right: 180,
  up: 90,
  down: -90,
}

interface Props extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  /** Направление острия. По умолчанию "left". */
  direction?: Direction
  /** Размер в px (квадратный). По умолчанию 37 (натуральный размер Figma). */
  size?: number | string
}

export function ArrowIcon({ direction = "left", size = 37, style, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 37 37"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{
        transform: `rotate(${ROTATION[direction]}deg)`,
        ...style,
      }}
      {...rest}
    >
      <path
        d="M34.5 20.9099C35.8807 20.9099 37 19.7906 37 18.4099C37 17.0292 35.8807 15.9099 34.5 15.9099L34.5 18.4099L34.5 20.9099ZM0.732231 16.6421C-0.24408 17.6185 -0.24408 19.2014 0.732231 20.1777L16.6421 36.0876C17.6184 37.0639 19.2014 37.0639 20.1777 36.0876C21.154 35.1113 21.154 33.5284 20.1777 32.552L6.03553 18.4099L20.1777 4.26778C21.154 3.29146 21.154 1.70855 20.1777 0.732241C19.2014 -0.244069 17.6184 -0.24407 16.6421 0.732241L0.732231 16.6421ZM34.5 18.4099L34.5 15.9099L2.5 15.9099L2.5 18.4099L2.5 20.9099L34.5 20.9099L34.5 18.4099Z"
        fill="currentColor"
      />
    </svg>
  )
}
