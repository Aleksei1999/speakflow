// Единая галочка для всех кабинетов. Форма — Figma «Vector 38» (35×29,
// stroke=6, round). Цвет через `color:` в родителе (stroke=currentColor).

import type { SVGProps } from "react"

interface Props extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  /** Ширина в px. Высота автомасштабируется по aspect-ratio 35:29. */
  size?: number | string
  /** Толщина линии в единицах viewBox (35×29). По умолчанию 6. */
  strokeWidth?: number
}

export function CheckIcon({ size = 35, strokeWidth = 6, ...rest }: Props) {
  const height =
    typeof size === "number" ? Math.round((size * 29) / 35) : `calc(${size} * 29 / 35)`
  return (
    <svg
      viewBox="0 0 35 29"
      width={size}
      height={height}
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path
        d="M3 15.902L13.2353 26.0001L32 3.00012"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
