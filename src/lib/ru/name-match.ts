// Нестрогое сравнение имён людей: «Дмитрий Кузин» ↔ «Dmitrii Kuzin», «Валерия Кратковская» ↔ «Valeria Kratkovskaya».
// Кириллица транслитерируется, буквы y/j/i унифицируются, повторы схлопываются, всё кроме букв выкидывается.
// Нужно там, где имя ведущего лекции вписано текстом, а профиль учителя заведён латиницей (или наоборот).

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "iu", я: "ia",
}

export function nameKey(raw: string | null | undefined): string {
  if (!raw) return ""
  const lower = raw.toLowerCase()
  let out = ""
  for (const ch of lower) out += TRANSLIT[ch] ?? ch
  out = out
    .replace(/[^a-z]+/g, " ")
    .replace(/[yj]/g, "i")
    .replace(/ks/g, "x")
    .replace(/(.)\1+/g, "$1")
    .trim()
    .split(/\s+/)
    .sort() // порядок «Имя Фамилия» / «Фамилия Имя» не важен
    .join(" ")
  return out
}

export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = nameKey(a), kb = nameKey(b)
  return !!ka && ka === kb
}
