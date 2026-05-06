// Russian -> Latin transliteration.
//
// Scheme: ICAO Doc 9303 / Russian "passport" rules (2014 edition).
// Differs from GOST 7.79 in a few characters but is what most users see in
// their Russian biometric passports — closest to "what users expect their
// name to look like in English".
//
// Examples:
//   Алексей -> Aleksei
//   Кратковская -> Kratkovskaia (passport scheme; -ская = -skaia)
//   Дмитрий -> Dmitrii
//   Андрей Евгеньевич -> Andrei Evgenevich
//   Юлия -> Iuliia
//
// Behaviour for already-Latin input: returned unchanged (case preserved).
// Mixed strings (e.g. "Anna Каренина") get only the Cyrillic chunks
// transliterated; Latin chunks are left as-is.

const RU_LOWER_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "ie",
  ы: "y",
  ь: "",
  э: "e",
  ю: "iu",
  я: "ia",
}

// Has at least one Cyrillic letter?
const CYR_RE = /[Ѐ-ӿ]/

/**
 * Transliterate a single Cyrillic character (preserving case) into Latin.
 * Returns the original character unchanged if not Cyrillic.
 */
function transliterateChar(ch: string): string {
  const lower = ch.toLowerCase()
  const mapped = RU_LOWER_MAP[lower]
  if (mapped === undefined) return ch // not Cyrillic, leave alone

  if (ch === lower) return mapped // input was lowercase

  // Uppercase input. If mapping is multi-char (zh/kh/ts/ch/sh/shch/ie/iu/ia),
  // capitalize only the first letter (Шапка -> Shapka, not SHapka). For
  // ALL-CAPS contexts we'd want the full upper, but Title Case is the
  // overwhelmingly common case for names — accept the trade-off.
  if (mapped.length === 0) return "" // ь -> ""
  if (mapped.length === 1) return mapped.toUpperCase()
  return mapped.charAt(0).toUpperCase() + mapped.slice(1)
}

/**
 * Transliterate a Russian (Cyrillic) name to Latin.
 *
 * - If `input` is null/undefined/empty -> returns input as-is.
 * - If `input` is pure ASCII (no Cyrillic) -> returns trimmed input unchanged.
 * - Otherwise transliterates Cyrillic chars; non-Cyrillic chars (spaces,
 *   hyphens, ASCII letters, digits) pass through untouched.
 */
export function transliterateRu(input: string | null | undefined): string {
  if (!input) return (input ?? "") as string
  const s = String(input)
  // Fast path: no Cyrillic at all -> return unchanged.
  if (!CYR_RE.test(s)) return s

  let out = ""
  for (const ch of s) {
    out += transliterateChar(ch)
  }
  return out
}

/**
 * Convenience: transliterate full_name as a single string. Equivalent to
 * `transliterateRu(name)`, kept as a named export for self-documenting
 * call sites in API routes.
 */
export function latinizeFullName(name: string | null | undefined): string {
  return transliterateRu(name)
}

/**
 * Build a (firstLatin, lastLatin, fullLatin) triple from possibly-Cyrillic
 * inputs. If `firstName`/`lastName` are missing, they're derived by splitting
 * `fullName` on the first whitespace.
 *
 * The fullLatin is reassembled from the latinized parts so that round-tripping
 * through transliteration produces a consistent form.
 */
export function latinizeNameParts(args: {
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
}): {
  firstLatin: string
  lastLatin: string
  fullLatin: string
} {
  let first = (args.firstName ?? "").trim()
  let last = (args.lastName ?? "").trim()
  const full = (args.fullName ?? "").trim()

  if (!first && !last && full) {
    const idx = full.indexOf(" ")
    if (idx === -1) {
      first = full
      last = ""
    } else {
      first = full.slice(0, idx).trim()
      last = full.slice(idx + 1).trim()
    }
  }

  const firstLatin = transliterateRu(first)
  const lastLatin = transliterateRu(last)
  const fullLatin = [firstLatin, lastLatin].filter(Boolean).join(" ").trim()

  return {
    firstLatin,
    lastLatin,
    fullLatin: fullLatin || transliterateRu(full),
  }
}
