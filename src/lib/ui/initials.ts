/** Инициалы по имени: «Иван Петров» → «ИП». */
export function initialsOf(name: string | null | undefined, fallback = "?"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || fallback
}

const AVATAR_PALETTE = ["#b63f37", "#8f5a2b", "#5e6b3a", "#3d5566", "#7a3a54", "#b58f2a"]

/** Стабильный цвет заглушки аватара по строке (имя или id). */
export function paletteFor(seed: string, palette: string[] = AVATAR_PALETTE): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}
