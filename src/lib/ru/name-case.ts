// Склонение русских имён (библиотека petrovich). Нужно для подписей вида «от Валерии Кратковской»
// в расписании лектория. Латиница и всё, что не похоже на кириллическое имя, возвращается как есть.
import petrovich from "petrovich"

const MALE_A_ENDINGS = /^(никита|илья|фома|кузьма|лука|савва|данила|гаврила|миша|саша|паша|лёша|леша|дима|серёжа|сережа|ваня|коля|петя|женя|толя|витя|костя|гоша|юра|слава|стёпа|степа)$/i

function guessGender(first: string, last: string): "male" | "female" {
  const f = first.toLowerCase()
  const l = last.toLowerCase()
  if (MALE_A_ENDINGS.test(f)) return "male"
  if (/(ова|ева|ёва|ина|ына|ская|цкая|ая|яя)$/.test(l)) return "female"
  if (/(ов|ев|ёв|ин|ын|ский|цкий|ой|ый|ий)$/.test(l)) return "male"
  if (/[ая]$/.test(f) || /ь$/.test(f) && /(любовь|нинель|рахиль|юдифь|эсфирь|адель|николь|мишель|гретель|ассоль)$/.test(f)) return "female"
  return "male"
}

function decline(fullName: string, kase: "genitive" | "instrumental"): string {
  const name = fullName.trim().replace(/\s+/g, " ")
  if (!name || !/^[а-яё\s-]+$/i.test(name)) return name
  const parts = name.split(" ")
  const first = parts[0]
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined
  const middle = parts.length > 2 ? parts.slice(1, -1).join(" ") : undefined
  try {
    const gender = guessGender(first, last ?? "")
    const r = petrovich({ gender, first, middle, last }, kase)
    return [r.first, r.middle, r.last].filter(Boolean).join(" ")
  } catch {
    return name
  }
}

/** «Валерия Кратковская» → «Валерии Кратковской». Латиницу не трогает. */
function nameGenitive(fullName: string): string {
  return decline(fullName, "genitive")
}

/** «Александр Петров» → «Александром Петровым» (для «Урок с …»). Латиницу не трогает. */
export function nameInstrumental(fullName: string): string {
  return decline(fullName, "instrumental")
}

/** Подпись лектора: «от Валерии Кратковской»; для латиницы — «от Valeria Kratkovskaya». */
export function fromLecturer(fullName: string | null | undefined): string {
  const n = (fullName ?? "").trim()
  return n ? `от ${nameGenitive(n)}` : ""
}
