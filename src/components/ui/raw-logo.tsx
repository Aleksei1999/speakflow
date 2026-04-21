import Image from "next/image"

type RawLogoProps = {
  className?: string
  size?: number
  priority?: boolean
}

const SVG_W = 330
const SVG_H = 188
const RATIO = SVG_W / SVG_H

/**
 * Unified Raw English brand mark. Renders the full illustrated SVG
 * (stylized "Raw english" wordmark + mascot) sourced from
 * /public/logo-raw-full.svg. The intrinsic colors in the SVG are
 * #cc3a3a (red) and #1e1e1e (near-black). Consumers that need the
 * logo on a dark background can apply filter classes like
 * `brightness-0 invert` via `className`.
 */
export function RawLogo({ className, size = 32, priority = false }: RawLogoProps) {
  const width = Math.round(size * RATIO)
  return (
    <Image
      src="/logo-raw-full.svg"
      alt="Raw English"
      width={width}
      height={size}
      priority={priority}
      className={className}
      style={{ width: "auto", height: size }}
      unoptimized
    />
  )
}
