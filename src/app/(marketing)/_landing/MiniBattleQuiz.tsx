"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type BankItem = { q: string; opts: string[]; correct: number; lvl: 1 | 2 | 3 | 4 }
type Grade = { key: string; name: string; cefr: string; color: string; sub: string; body: string }
type GoalsStepKey = "purpose" | "timeline" | "intensity"
type GoalsStep = {
  key: GoalsStepKey
  title: string
  subtitle: string
  options: { id: string; label: string; desc: string; icon: string }[]
}
type Mode = "intro" | "question" | "result" | "goals" | "form" | "success" | "gameover" | "bonus_offer"
type Mood = "happy" | "neutral" | "worried" | "wow" | "cool" | "dead" | "frozen"

const TOTAL_QUESTIONS = 12
const BONUS_QUESTIONS = 7
const STARTING_LEVEL = 2 as const
const MAX_LIVES = 3

const BANK: BankItem[] = [
  // A1
  { q: "We ___ American.", opts: ["not", "not are", "aren't", "isn't"], correct: 2, lvl: 1 },
  { q: "This is our new teacher. ___ name is Mark.", opts: ["His", "Her", "Its", "He"], correct: 0, lvl: 1 },
  { q: "It's my ___ computer.", opts: ["parents", "parents'", "parent", "parent's"], correct: 3, lvl: 1 },
  { q: "The people ___ in room 12.", opts: ["is", "am", "are", "be"], correct: 2, lvl: 1 },
  { q: "It's ten ___ seven.", opts: ["to", "for", "at", "in"], correct: 0, lvl: 1 },
  { q: "'Was Debussy from France?' 'Yes, ___.'", opts: ["he were", "was", "there were", "he was"], correct: 3, lvl: 1 },
  { q: "I'm Italian. ___ family are from Venice.", opts: ["Our", "My", "Her", "Me"], correct: 1, lvl: 1 },
  { q: "He ___ playing the piano.", opts: ["are", "does", "is", "has"], correct: 2, lvl: 1 },
  { q: "___ the time?", opts: ["What's", "What is it", "What", "What it is"], correct: 0, lvl: 1 },
  { q: "They're ___.", opts: ["bigs cars", "cars bigs", "big cars", "bigs car"], correct: 2, lvl: 1 },
  // A2
  { q: "Would you like ___ coffee?", opts: ["other", "another", "some other", "more one"], correct: 1, lvl: 2 },
  { q: "I haven't ___ this photo before.", opts: ["see", "saw", "to see", "seen"], correct: 3, lvl: 2 },
  { q: "There isn't ___ pasta in the kitchen.", opts: ["some", "many", "a", "any"], correct: 3, lvl: 2 },
  { q: "The elephant is ___ land animal in the world.", opts: ["the bigger", "the most big", "biggest", "the biggest"], correct: 3, lvl: 2 },
  { q: "I ___ do my homework last night.", opts: ["not could", "didn't can", "couldn't", "can't"], correct: 2, lvl: 2 },
  { q: "He ___ jeans.", opts: ["doesn't usually wear", "isn't usually wearing", "wears usually", "doesn't wear usually"], correct: 0, lvl: 2 },
  { q: "I ___ my new job last week.", opts: ["have begun", "began", "am begin", "begin"], correct: 1, lvl: 2 },
  { q: "James would like ___ basketball.", opts: ["playing", "to play", "play", "to playing"], correct: 1, lvl: 2 },
  { q: "Today's breakfast is ___ than yesterday's.", opts: ["more good", "gooder", "better", "more better"], correct: 2, lvl: 2 },
  { q: "___ yesterday?", opts: ["You studied", "Did you studied", "Did you study", "Studied you"], correct: 2, lvl: 2 },
  // B1
  { q: "It ___ when they went out.", opts: ["rained", "was raining", "is raining", "was to rain"], correct: 1, lvl: 3 },
  { q: "That's the hotel ___ we had lunch.", opts: ["what", "where", "that", "which"], correct: 1, lvl: 3 },
  { q: "When I got to work I remembered that ___ my mobile at home.", opts: ["I'd leave", "I was leaving", "I'd left", "I left"], correct: 2, lvl: 3 },
  { q: "I'm sure Canada isn't as big ___ Russia.", opts: ["as", "than", "to", "like"], correct: 0, lvl: 3 },
  { q: "This road was built ___ the Romans.", opts: ["of", "for", "by", "with"], correct: 2, lvl: 3 },
  { q: "My father ___ be a builder.", opts: ["used to", "was", "use to", "did use to"], correct: 0, lvl: 3 },
  { q: "Can you look ___ my dog this weekend?", opts: ["with", "away", "up", "after"], correct: 3, lvl: 3 },
  { q: "I haven't tidied my office ___.", opts: ["just", "already", "yet", "since"], correct: 2, lvl: 3 },
  { q: "If we had the money, we ___ get a taxi.", opts: ["will can", "can", "would can", "could"], correct: 3, lvl: 3 },
  { q: "Michelangelo ___ some of his best works in Rome.", opts: ["painted", "was painted", "is painting", "has painted"], correct: 0, lvl: 3 },
  // B2
  { q: "___ Kate nor I want to go to London.", opts: ["Neither", "Both", "Either", "Not"], correct: 0, lvl: 4 },
  { q: "That's the boy ___ parents I met.", opts: ["which", "whom", "who", "whose"], correct: 3, lvl: 4 },
  { q: "I'll take some water ___ I get thirsty.", opts: ["so", "although", "in case", "unless"], correct: 2, lvl: 4 },
  { q: "He works too hard so it's not ___ he's ill.", opts: ["surprise", "to surprise", "surprising", "surprised"], correct: 2, lvl: 4 },
  { q: "We ___ together since last year.", opts: ["live", "are living", "lived", "'ve been living"], correct: 3, lvl: 4 },
  { q: "They'll move to France when their baby ___.", opts: ["will be born", "is being born", "is born", "would be born"], correct: 2, lvl: 4 },
  { q: "She speaks English ___ than me.", opts: ["more better", "better", "more well", "so better"], correct: 1, lvl: 4 },
  { q: "I ___ go to the dentist yesterday.", opts: ["must", "musted", "had to", "have to"], correct: 2, lvl: 4 },
  { q: "Can you tell me where ___?", opts: ["the post office is", "is the post office", "the post office", "post office"], correct: 0, lvl: 4 },
  { q: "I never ___ eat so much.", opts: ["used to", "didn't used to", "use to", "didn't use to"], correct: 0, lvl: 4 },
]

const GRADES: Grade[] = [
  { key: "raw", name: "Raw", cefr: "A1", color: "#E24B4A", sub: "Начинаем с самых основ — у тебя всё впереди.", body: "#E24B4A" },
  { key: "mrare", name: "Medium rare", cefr: "A2", color: "#D4542E", sub: "База заложена, время её укрепить.", body: "#C8472A" },
  { key: "medium", name: "Medium", cefr: "B1", color: "#B56A2E", sub: "Уверенный средний уровень — движемся дальше.", body: "#9B5A24" },
  { key: "mwell", name: "Medium well", cefr: "B2", color: "#8B5A3C", sub: "Сильный английский. Отшлифуем до свободного.", body: "#6B4530" },
  { key: "welldone", name: "Well-done", cefr: "C1+", color: "#5C3A1E", sub: "Идеально прожарен. Нужна практика, а не база.", body: "#4A2E18" },
]

const GOALS_STEPS: GoalsStep[] = [
  {
    key: "purpose",
    title: "Зачем тебе английский?",
    subtitle: "Это поможет подобрать правильную программу",
    options: [
      { id: "work", label: "Для работы", desc: "Карьера, встречи, переписка", icon: "work" },
      { id: "travel", label: "Для путешествий", desc: "Общение в поездках", icon: "travel" },
      { id: "move", label: "Для переезда", desc: "Жизнь за границей", icon: "move" },
      { id: "study", label: "Для учёбы", desc: "Университет, курсы", icon: "study" },
      { id: "exam", label: "Для экзамена", desc: "IELTS, TOEFL, ЕГЭ", icon: "exam" },
      { id: "myself", label: "Для себя", desc: "Хобби, фильмы, книги", icon: "heart" },
    ],
  },
  {
    key: "timeline",
    title: "Когда хочешь увидеть результат?",
    subtitle: "От этого зависит интенсивность",
    options: [
      { id: "fast", label: "1–3 месяца", desc: "Срочно нужен результат", icon: "rocket" },
      { id: "med", label: "3–6 месяцев", desc: "Стабильный рост", icon: "chart" },
      { id: "long", label: "6–12 месяцев", desc: "В удобном ритме", icon: "calendar" },
      { id: "open", label: "Без дедлайна", desc: "Просто двигаюсь", icon: "flow" },
    ],
  },
  {
    key: "intensity",
    title: "Сколько готов заниматься?",
    subtitle: "Подберём удобное расписание",
    options: [
      { id: "light", label: "1 час в неделю", desc: "Минимум, но регулярно", icon: "leaf" },
      { id: "basic", label: "2–3 часа", desc: "Стандарт", icon: "flame1" },
      { id: "strong", label: "4–5 часов", desc: "Заметный прогресс", icon: "flame2" },
      { id: "pro", label: "6+ часов", desc: "Интенсив", icon: "flame3" },
    ],
  },
]

const CEFR_LABEL: Record<number, string> = { 1: "A1", 2: "A2", 3: "B1", 4: "B2" }

function cefrWord(cefr: string): string {
  return (
    {
      A1: "beginner",
      A2: "elementary",
      B1: "intermediate",
      B2: "upper-int",
      "C1+": "advanced",
    } as Record<string, string>
  )[cefr] || ""
}

function SteakSVG({ mood, size = 100, color = "#D33F3F" }: { mood: Mood; size?: number; color?: string }) {
  const face: Record<Mood, React.ReactNode> = {
    happy: (
      <>
        <ellipse cx="36" cy="46" rx="3.5" ry="5" fill="white" />
        <ellipse cx="60" cy="46" rx="3.5" ry="5" fill="white" />
        <circle cx="36" cy="47" r="2.2" fill="#1a1a1a" />
        <circle cx="60" cy="47" r="2.2" fill="#1a1a1a" />
        <path d="M 34 60 Q 48 70, 62 60" stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </>
    ),
    neutral: (
      <>
        <ellipse cx="36" cy="46" rx="3.5" ry="5" fill="white" />
        <ellipse cx="60" cy="46" rx="3.5" ry="5" fill="white" />
        <circle cx="36" cy="47" r="2.2" fill="#1a1a1a" />
        <circle cx="60" cy="47" r="2.2" fill="#1a1a1a" />
        <path d="M 36 62 L 60 62" stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </>
    ),
    worried: (
      <>
        <ellipse cx="36" cy="46" rx="3.5" ry="5" fill="white" />
        <ellipse cx="60" cy="46" rx="3.5" ry="5" fill="white" />
        <circle cx="36" cy="47" r="2.2" fill="#1a1a1a" />
        <circle cx="60" cy="47" r="2.2" fill="#1a1a1a" />
        <path d="M 34 65 Q 48 58, 62 65" stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </>
    ),
    wow: (
      <>
        <ellipse cx="36" cy="46" rx="4" ry="5.5" fill="white" />
        <ellipse cx="60" cy="46" rx="4" ry="5.5" fill="white" />
        <circle cx="36" cy="47" r="2.4" fill="#1a1a1a" />
        <circle cx="60" cy="47" r="2.4" fill="#1a1a1a" />
        <ellipse cx="48" cy="64" rx="5" ry="6" fill="#1a1a1a" />
      </>
    ),
    cool: (
      <>
        <rect x="26" y="42" width="16" height="10" rx="3" fill="#1a1a1a" />
        <rect x="54" y="42" width="16" height="10" rx="3" fill="#1a1a1a" />
        <rect x="42" y="46" width="12" height="2" fill="#1a1a1a" />
        <path d="M 36 62 Q 48 72, 60 62" stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </>
    ),
    dead: (
      <>
        <path d="M34 44 L42 52 M42 44 L34 52" stroke="#1a1a1a" strokeWidth={2.4} strokeLinecap="round" />
        <path d="M54 44 L62 52 M62 44 L54 52" stroke="#1a1a1a" strokeWidth={2.4} strokeLinecap="round" />
        <path d="M 36 64 Q 48 58, 60 64" stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </>
    ),
    frozen: (
      <>
        {/* squinting eyes */}
        <path d="M32 47 L42 47" stroke="#1a1a1a" strokeWidth={2.4} strokeLinecap="round" />
        <path d="M54 47 L64 47" stroke="#1a1a1a" strokeWidth={2.4} strokeLinecap="round" />
        {/* chattering zigzag mouth */}
        <path
          d="M 34 62 L 38 58 L 42 62 L 46 58 L 50 62 L 54 58 L 58 62 L 62 58"
          stroke="#1a1a1a"
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* snowflakes */}
        <text x="14" y="34" fontSize="14" opacity="0.85">❄</text>
        <text x="76" y="30" fontSize="11" opacity="0.7">❄</text>
        <text x="78" y="80" fontSize="9" opacity="0.6">❄</text>
      </>
    ),
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <ellipse cx="48" cy="52" rx="34" ry="36" fill={color} />
      <ellipse cx="24" cy="56" rx="5" ry="3" fill="#FF8A7A" opacity="0.65" />
      <ellipse cx="72" cy="56" rx="5" ry="3" fill="#FF8A7A" opacity="0.65" />
      {face[mood]}
      <ellipse cx="48" cy="94" rx="22" ry="3" fill="black" opacity="0.25" />
    </svg>
  )
}

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="18" viewBox="0 0 11 13" style={{ opacity: active ? 1 : 0.25 }} aria-hidden>
      <path
        d="M5.5 1 C5.5 3.5, 9 4.5, 9 8 C9 10.5, 7.5 12, 5.5 12 C3.5 12, 2 10.5, 2 8 C2 5.5, 3.5 5.5, 5.5 1 Z"
        fill={active ? "var(--red)" : "var(--text3)"}
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r="8" fill="rgba(74,222,128,0.2)" />
      <path d="M5 9 L8 12 L13 6" stroke="#4ADE80" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ dir = "right" }: { dir?: "left" | "right" }) {
  const d = dir === "left" ? "M11 3 L5 9 L11 15" : "M7 3 L13 9 L7 15"
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GoalIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    work: (
      <>
        <rect x="3" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M8 6 V4 Q8 3, 9 3 H13 Q14 3, 14 4 V6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
    travel: <path d="M11 2 L13 9 L20 11 L13 13 L11 20 L9 13 L2 11 L9 9 Z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />,
    move: (
      <>
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M3 11 H19 M11 3 Q15 11, 11 19 M11 3 Q7 11, 11 19" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </>
    ),
    study: (
      <>
        <path d="M11 3 L20 8 L11 13 L2 8 Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
        <path d="M6 10 V15 Q6 17, 11 17 Q16 17, 16 15 V10" stroke="currentColor" strokeWidth="1.8" fill="none" />
      </>
    ),
    exam: (
      <>
        <rect x="4" y="3" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M7 8 H15 M7 12 H15 M7 16 H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
    heart: <path d="M11 18 C4 13, 2 9, 4 6 C6 3, 10 4, 11 7 C12 4, 16 3, 18 6 C20 9, 18 13, 11 18 Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />,
    rocket: (
      <>
        <path d="M11 2 Q16 7, 16 12 V16 H6 V12 Q6 7, 11 2 Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
        <circle cx="11" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M7 16 L5 19 M15 16 L17 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
    chart: (
      <>
        <path d="M3 18 L8 12 L12 15 L19 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 5 H19 V10" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M3 9 H19 M8 3 V6 M14 3 V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    flow: <path d="M3 11 Q7 6, 11 11 Q15 16, 19 11" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />,
    leaf: (
      <>
        <path d="M5 19 Q5 8, 16 4 Q19 10, 16 14 Q12 18, 5 19 Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
        <path d="M5 19 L12 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
    flame1: <path d="M11 2 Q12 6, 15 8 Q18 10, 17 14 Q16 19, 11 19 Q6 19, 5 14 Q4 10, 8 9 Q9 6, 11 2 Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />,
    flame2: (
      <>
        <path d="M11 2 Q12 6, 15 8 Q18 10, 17 14 Q16 19, 11 19 Q6 19, 5 14 Q4 10, 8 9 Q9 6, 11 2 Z" fill="currentColor" opacity="0.25" />
        <path d="M11 2 Q12 6, 15 8 Q18 10, 17 14 Q16 19, 11 19 Q6 19, 5 14 Q4 10, 8 9 Q9 6, 11 2 Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      </>
    ),
    flame3: (
      <>
        <path d="M11 2 Q12 6, 15 8 Q18 10, 17 14 Q16 19, 11 19 Q6 19, 5 14 Q4 10, 8 9 Q9 6, 11 2 Z" fill="currentColor" opacity="0.55" />
        <path d="M11 2 Q12 6, 15 8 Q18 10, 17 14 Q16 19, 11 19 Q6 19, 5 14 Q4 10, 8 9 Q9 6, 11 2 Z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      </>
    ),
  }
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      {icons[name] || icons.heart}
    </svg>
  )
}

type AnsweredByLevel = Record<1 | 2 | 3 | 4, { right: number; total: number }>

function freshAnswered(): AnsweredByLevel {
  return {
    1: { right: 0, total: 0 },
    2: { right: 0, total: 0 },
    3: { right: 0, total: 0 },
    4: { right: 0, total: 0 },
  }
}

function determineGradeIdx(acc: AnsweredByLevel): number {
  const pct: Record<1 | 2 | 3 | 4, number | null> = { 1: null, 2: null, 3: null, 4: null }
  for (const lvl of [1, 2, 3, 4] as const) {
    const s = acc[lvl]
    pct[lvl] = s.total > 0 ? s.right / s.total : null
  }
  const allSeen = ([1, 2, 3, 4] as const).every((l) => pct[l] !== null)
  if (allSeen && ([1, 2, 3, 4] as const).every((l) => (pct[l] ?? 0) >= 0.8)) return 4
  for (let lvl = 4; lvl >= 1; lvl--) {
    const p = pct[lvl as 1 | 2 | 3 | 4]
    if (p === null || p < 0.6) continue
    const lowerOk: boolean[] = []
    for (let l2 = 1; l2 < lvl; l2++) {
      const lp = pct[l2 as 1 | 2 | 3 | 4]
      if (lp === null) continue
      lowerOk.push(lp >= 0.6)
    }
    if (lowerOk.every((v) => v)) return lvl - 1
  }
  return 0
}

type Props = {
  isAuthenticated?: boolean
  ctaHref?: string
}

export default function MiniBattleQuiz({ isAuthenticated = false, ctaHref = "/register" }: Props) {
  const [mode, setMode] = useState<Mode>("intro")
  const [qIndex, setQIndex] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [currentLvl, setCurrentLvl] = useState<1 | 2 | 3 | 4>(STARTING_LEVEL)
  const [answered, setAnswered] = useState<AnsweredByLevel>(freshAnswered)
  const [usedIdx, setUsedIdx] = useState<Set<number>>(new Set())
  const [totalRight, setTotalRight] = useState(0)
  const [currentQ, setCurrentQ] = useState<{ q: BankItem; idx: number } | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [goalsStep, setGoalsStep] = useState(0)
  const [goals, setGoals] = useState<{ purpose: string | null; timeline: string | null; intensity: string | null }>({
    purpose: null,
    timeline: null,
    intensity: null,
  })
  const [bonusActive, setBonusActive] = useState(false)

  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const gradeIdx = useMemo(() => determineGradeIdx(answered), [answered])
  const grade = GRADES[gradeIdx]

  const pickQuestion = useCallback(
    (used: Set<number>, lvl: 1 | 2 | 3 | 4): { q: BankItem; idx: number } | null => {
      let pool = BANK.map((q, i) => ({ q, i })).filter((x) => !used.has(x.i) && x.q.lvl === lvl)
      if (!pool.length) pool = BANK.map((q, i) => ({ q, i })).filter((x) => !used.has(x.i) && Math.abs(x.q.lvl - lvl) <= 1)
      if (!pool.length) pool = BANK.map((q, i) => ({ q, i })).filter((x) => !used.has(x.i))
      if (!pool.length) return null
      const chosen = pool[Math.floor(Math.random() * pool.length)]
      return { q: chosen.q, idx: chosen.i }
    },
    []
  )

  const resetAll = useCallback(() => {
    setQIndex(0)
    setLives(MAX_LIVES)
    setCurrentLvl(STARTING_LEVEL)
    setAnswered(freshAnswered())
    setUsedIdx(new Set())
    setTotalRight(0)
    setCurrentQ(null)
    setPicked(null)
    setLocked(false)
    setGoalsStep(0)
    setGoals({ purpose: null, timeline: null, intensity: null })
    setBonusActive(false)
  }, [])

  const startBattle = useCallback(() => {
    resetAll()
    const next = pickQuestion(new Set(), STARTING_LEVEL)
    if (!next) return
    setUsedIdx(new Set([next.idx]))
    setCurrentQ(next)
    setMode("question")
  }, [resetAll, pickQuestion])

  const handleAnswer = useCallback(
    (chosen: number) => {
      if (locked || !currentQ) return
      setPicked(chosen)
      setLocked(true)

      const q = currentQ.q
      const isCorrect = chosen === q.correct

      const nextAnswered: AnsweredByLevel = {
        ...answered,
        [q.lvl]: {
          right: answered[q.lvl].right + (isCorrect ? 1 : 0),
          total: answered[q.lvl].total + 1,
        },
      }
      setAnswered(nextAnswered)
      const nextTotalRight = totalRight + (isCorrect ? 1 : 0)
      setTotalRight(nextTotalRight)
      const nextLives = lives - (isCorrect ? 0 : 1)
      setLives(nextLives)
      const nextLvl = (isCorrect ? Math.min(4, currentLvl + 1) : Math.max(1, currentLvl - 1)) as 1 | 2 | 3 | 4
      setCurrentLvl(nextLvl)

      if (lockTimer.current) clearTimeout(lockTimer.current)
      lockTimer.current = setTimeout(() => {
        const nextIndex = qIndex + 1
        if (nextLives <= 0) {
          setMode("gameover")
          return
        }
        // Конец основного раунда (12 вопросов)
        if (!bonusActive && nextIndex >= TOTAL_QUESTIONS) {
          // Идеальный счёт → предлагаем бонусные 7 вопросов + Speaking Club
          if (nextTotalRight >= TOTAL_QUESTIONS) {
            setMode("bonus_offer")
            return
          }
          setMode("result")
          return
        }
        // Конец бонусного раунда (12 + 7 = 19)
        if (bonusActive && nextIndex >= TOTAL_QUESTIONS + BONUS_QUESTIONS) {
          setMode("result")
          return
        }
        // В бонусе всегда тянем самый высокий уровень (C1+)
        const askLvl: 1 | 2 | 3 | 4 = bonusActive ? 4 : nextLvl
        const next = pickQuestion(usedIdx, askLvl)
        if (!next) {
          setMode("result")
          return
        }
        setUsedIdx((prev) => {
          const s = new Set(prev)
          s.add(next.idx)
          return s
        })
        setCurrentQ(next)
        setPicked(null)
        setLocked(false)
        setQIndex(nextIndex)
      }, 1100)
    },
    [locked, currentQ, answered, totalRight, lives, currentLvl, qIndex, usedIdx, pickQuestion, bonusActive]
  )

  const acceptBonus = useCallback(() => {
    setBonusActive(true)
    // Берём первый бонус-вопрос на C1+ (lvl=4)
    const next = pickQuestion(usedIdx, 4)
    if (!next) {
      setMode("result")
      return
    }
    setUsedIdx((prev) => {
      const s = new Set(prev)
      s.add(next.idx)
      return s
    })
    setCurrentQ(next)
    setPicked(null)
    setLocked(false)
    setQIndex(TOTAL_QUESTIONS) // продолжаем с 13-го
    setMode("question")
  }, [pickQuestion, usedIdx])

  useEffect(() => {
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current)
    }
  }, [])

  // Persist result to localStorage so /register (and other onboarding steps)
  // can read it via the existing `raw_quiz_result` key.
  useEffect(() => {
    if (mode !== "result" && mode !== "gameover") return
    if (typeof window === "undefined") return
    const rawLevel =
      grade.key === "mrare" ? "mediumrare" : grade.key === "mwell" ? "mediumwell" : grade.key
    const totalAnswered = qIndex || 1
    const percent = Math.round((totalRight / totalAnswered) * 100)
    const payload = {
      level: rawLevel,
      levelName: grade.name,
      xp: totalRight * 5,
      correctCount: totalRight,
      totalQuestions: totalAnswered,
      percent,
      answers: {} as Record<number, number>,
      cefr: grade.cefr,
    }
    try {
      window.localStorage.setItem("raw_quiz_result", JSON.stringify(payload))
    } catch {
      /* ignore quota/private-mode errors */
    }
  }, [mode, grade, totalRight, qIndex])

  // Persist goals (purpose/timeline/intensity) as human-readable labels so
  // the /register profile-summary can show them without recomputing.
  useEffect(() => {
    if (typeof window === "undefined") return
    const purposeLabel = GOALS_STEPS[0].options.find((o) => o.id === goals.purpose)?.label
    const timelineLabel = GOALS_STEPS[1].options.find((o) => o.id === goals.timeline)?.label
    const intensityLabel = GOALS_STEPS[2].options.find((o) => o.id === goals.intensity)?.label
    if (!purposeLabel && !timelineLabel && !intensityLabel) return
    try {
      window.localStorage.setItem(
        "raw_quiz_goals",
        JSON.stringify({
          purpose: goals.purpose,
          purposeLabel: purposeLabel || null,
          timeline: goals.timeline,
          timelineLabel: timelineLabel || null,
          intensity: goals.intensity,
          intensityLabel: intensityLabel || null,
        })
      )
    } catch {
      /* ignore */
    }
  }, [goals])

  const skipToResult = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("Остановить и увидеть предварительный результат?")) {
      setMode("result")
    }
  }, [])

  const pickGoal = useCallback(
    (id: string) => {
      const stepKey = GOALS_STEPS[goalsStep].key
      setGoals((prev) => ({ ...prev, [stepKey]: id }))
      setTimeout(() => {
        if (goalsStep < GOALS_STEPS.length - 1) setGoalsStep((s) => s + 1)
        else setMode("form")
      }, 320)
    },
    [goalsStep]
  )

  const totalLen = bonusActive ? TOTAL_QUESTIONS + BONUS_QUESTIONS : TOTAL_QUESTIONS
  const progressPct = (qIndex / totalLen) * 100
  const mood: Mood = lives === 3 ? "happy" : lives === 2 ? "neutral" : "worried"

  return (
    <div className="mini-battle">
      <style dangerouslySetInnerHTML={{ __html: MINI_BATTLE_CSS }} />

      {mode === "intro" && (
        <div className="mb-intro">
          <div className="mb-intro-label">Без регистрации · 2 минуты</div>
          <h3 className="mb-intro-title">
            Проверь себя.
            <br />
            <span className="mb-brand">Mini battle.</span>
          </h3>
          <div className="mb-intro-mascot">
            <SteakSVG mood="happy" size={140} />
          </div>
          <div className="mb-cta-title">Ready to battle?</div>
          <p className="mb-intro-desc">
            12 вопросов, чтобы определить твой уровень английского. Помоги Стейку дойти до well-done — он переживает.
          </p>
          <div className="mb-stats">
            <div className="mb-stat"><div className="mb-stat-val">12</div><div className="mb-stat-label">вопросов</div></div>
            <div className="mb-stat"><div className="mb-stat-val">3</div><div className="mb-stat-label">жизни</div></div>
            <div className="mb-stat"><div className="mb-stat-val">2 мин</div><div className="mb-stat-label">время</div></div>
          </div>
          <button className="mb-btn-primary" onClick={startBattle} type="button">
            Start battle
          </button>
        </div>
      )}

      {mode === "question" && currentQ && (
        <div className="mb-game-wrap">
          <div className="mb-hud">
            <div className="mb-lives">
              {Array.from({ length: MAX_LIVES }, (_, i) => (
                <HeartIcon key={i} active={i < lives} />
              ))}
            </div>
            <div className="mb-progress">
              <div className="mb-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mb-q-counter">
              {qIndex + 1}/{totalLen}{bonusActive ? " 🔥" : ""}
            </div>
            <button className="mb-skip-btn" onClick={skipToResult} type="button">
              Пропустить
            </button>
          </div>
          <div className="mb-question-card" key={qIndex}>
            <div className="mb-q-head">
              <div style={{ flexShrink: 0 }}>
                <SteakSVG mood={mood} size={56} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="mb-q-meta">
                  Question {qIndex + 1} · {CEFR_LABEL[currentQ.q.lvl]}
                </div>
                <div
                  className="mb-q-text"
                  dangerouslySetInnerHTML={{
                    __html: currentQ.q.q.replace("___", '<span class="mb-q-blank">___</span>'),
                  }}
                />
              </div>
            </div>
            <div className="mb-options">
              {currentQ.q.opts.map((o, i) => {
                let cls = "mb-option"
                if (locked) {
                  if (i === currentQ.q.correct) cls += " is-correct"
                  else if (i === picked) cls += " is-wrong mb-shake"
                }
                return (
                  <button key={i} type="button" className={cls} disabled={locked} onClick={() => handleAnswer(i)}>
                    <span className="mb-opt-letter">{["A", "B", "C", "D"][i]}</span>
                    <span className="mb-opt-text">{o}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {mode === "gameover" && (
        <div className="mb-gameover">
          <div style={{ marginBottom: 16 }}>
            <SteakSVG mood="frozen" size={130} color="#7AB8D8" />
          </div>
          <div className="mb-cta-title" style={{ color: "#3B82F6" }}>
            Frozen…
          </div>
          <p className="mb-intro-desc">
            Жизни закончились на {qIndex} вопросе — стейк остыл. Но мы уже примерно поняли твой уровень.
          </p>
          <button className="mb-btn-primary" onClick={() => setMode("result")} type="button" style={{ marginBottom: 10 }}>
            Показать результат
          </button>
          <button className="mb-btn-ghost" onClick={startBattle} type="button">
            Попробовать ещё раз
          </button>
        </div>
      )}

      {mode === "bonus_offer" && (
        <div className="mb-gameover">
          <div style={{ marginBottom: 16 }}>
            <SteakSVG mood="cool" size={130} color="#5C3A1E" />
          </div>
          <div className="mb-cta-title" style={{ color: "var(--red)" }}>
            🔥 Идеальный раунд!
          </div>
          <p className="mb-intro-desc">
            Все 12 из 12 правильно. Хочешь ещё <b>7 вопросов на C1+</b> и попробовать наш Speaking Club?
          </p>
          <button
            className="mb-btn-primary"
            onClick={acceptBonus}
            type="button"
            style={{ marginBottom: 10 }}
          >
            Поехали — +7 вопросов
          </button>
          <button
            className="mb-btn-ghost"
            onClick={() => setMode("result")}
            type="button"
          >
            Просто результат
          </button>
        </div>
      )}

      {mode === "result" && (
        <div className="mb-result">
          <div className="mb-result-label">твоя прожарка</div>
          <div className="mb-result-mascot">
            <SteakSVG
              mood={gradeIdx >= 3 ? "cool" : gradeIdx >= 2 ? "happy" : gradeIdx >= 1 ? "neutral" : "wow"}
              size={150}
              color={grade.body}
            />
          </div>
          <div className="mb-result-name" style={{ color: grade.color }}>
            {grade.name}
          </div>
          <div className="mb-result-tag">
            {grade.cefr} · {cefrWord(grade.cefr)}
          </div>
          <p className="mb-result-sub">{grade.sub}</p>
          <div className="mb-grade-bar">
            {GRADES.map((g, i) => (
              <div
                key={g.key}
                className="mb-grade-seg"
                style={i <= gradeIdx ? { background: g.color } : undefined}
              />
            ))}
          </div>

          <div className="mb-result-stats">
            <div className="mb-rs">
              <div className="mb-rs-val">
                {totalRight}/{qIndex}
              </div>
              <div className="mb-rs-label">правильно</div>
            </div>
            <div className="mb-rs">
              <div className="mb-rs-val" style={{ color: "var(--red)" }}>+{totalRight * 5}</div>
              <div className="mb-rs-label">XP</div>
            </div>
            <div className="mb-rs">
              <div className="mb-rs-val">{lives}</div>
              <div className="mb-rs-label">жизней</div>
            </div>
          </div>

          <div className="mb-breakdown">
            <h4>По уровням:</h4>
            {([1, 2, 3, 4] as const).map((lvl) => {
              const s = answered[lvl]
              const label = CEFR_LABEL[lvl]
              const pct = s.total > 0 ? Math.round((s.right / s.total) * 100) : 0
              const color =
                s.total === 0
                  ? "var(--border)"
                  : pct >= 60
                    ? "#4ADE80"
                    : pct >= 30
                      ? "#FFD93D"
                      : "var(--red)"
              return (
                <div className="mb-bd-row" key={lvl}>
                  <div className="mb-bd-level">{label}</div>
                  <div className="mb-bd-track">
                    <div className="mb-bd-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="mb-bd-score">
                    {s.right}/{s.total}
                  </div>
                </div>
              )
            })}
          </div>

          {bonusActive && (
            <div
              className="mb-cta-card"
              style={{
                background:
                  "linear-gradient(135deg, rgba(74,222,128,0.10), rgba(211,63,63,0.06))",
                borderColor: "rgba(74,222,128,0.35)",
              }}
            >
              <div className="mb-cta-label" style={{ color: "#16A34A" }}>
                🎤 Для продвинутых
              </div>
              <div className="mb-cta-card-title">Speaking Club — еженедельные разговорные клубы</div>
              <div className="mb-cta-desc">
                Раз в неделю собираемся группой 4–6 человек на твоём уровне.
                Свободный английский, темы из жизни, ведущий-носитель или сильный преподаватель. На C1+ — самые интересные дискуссии.
              </div>
              <div className="mb-cta-features">
                <div className="mb-cta-feat"><CheckIcon /> 60 минут живого разговора</div>
                <div className="mb-cta-feat"><CheckIcon /> Темы C1+ и выше</div>
                <div className="mb-cta-feat"><CheckIcon /> Первая встреча — бесплатно</div>
              </div>
              <Link
                href={isAuthenticated ? "/student/clubs" : "/register?goal=clubs"}
                className="mb-btn-primary mb-btn-full"
                style={{ textDecoration: "none", textAlign: "center", display: "inline-flex", justifyContent: "center" }}
              >
                Записаться в Speaking Club
              </Link>
            </div>
          )}

          <div className="mb-cta-card">
            <div className="mb-cta-label">Следующий шаг</div>
            <div className="mb-cta-card-title">Бесплатный пробный урок под твой {grade.cefr}</div>
            <div className="mb-cta-desc">
              45 минут с преподавателем. Подберём программу под твой уровень и цели — никаких обязательств.
            </div>
            <div className="mb-cta-features">
              <div className="mb-cta-feat"><CheckIcon /> Персональная программа под {grade.name}</div>
              <div className="mb-cta-feat"><CheckIcon /> Пробный урок бесплатно</div>
              <div className="mb-cta-feat"><CheckIcon /> Можно отменить в любой момент</div>
            </div>
            <button
              className="mb-btn-primary mb-btn-full"
              type="button"
              onClick={() => {
                setGoalsStep(0)
                setMode("goals")
              }}
            >
              Записаться на пробный
            </button>
          </div>

          <button className="mb-btn-ghost mb-btn-full" onClick={startBattle} type="button">
            Сыграть ещё раз
          </button>
        </div>
      )}

      {mode === "goals" && (
        <div className="mb-goals-wrap">
          <div className="mb-goals-head">
            <button
              className="mb-goals-back"
              type="button"
              onClick={() => {
                if (goalsStep > 0) setGoalsStep((s) => s - 1)
                else setMode("result")
              }}
              aria-label="Назад"
            >
              <ChevronIcon dir="left" />
            </button>
            <div className="mb-goals-progress">
              <div
                className="mb-goals-progress-fill"
                style={{ width: `${(goalsStep / GOALS_STEPS.length) * 100}%` }}
              />
            </div>
            <div className="mb-goals-step">
              {goalsStep + 1}/{GOALS_STEPS.length}
            </div>
          </div>

          <div className="mb-goals-content">
            <div className="mb-goals-mascot">
              <SteakSVG
                mood={goalsStep === 0 ? "happy" : goalsStep === 1 ? "neutral" : "cool"}
                size={82}
                color={grade.body}
              />
            </div>
            <h3 className="mb-goals-title">{GOALS_STEPS[goalsStep].title}</h3>
            <p className="mb-goals-subtitle">{GOALS_STEPS[goalsStep].subtitle}</p>

            <div className="mb-goals-options">
              {GOALS_STEPS[goalsStep].options.map((o) => {
                const isPicked = goals[GOALS_STEPS[goalsStep].key] === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`mb-goal-opt${isPicked ? " is-picked" : ""}`}
                    onClick={() => pickGoal(o.id)}
                  >
                    <div className="mb-goal-opt-icon">
                      <GoalIcon name={o.icon} />
                    </div>
                    <div className="mb-goal-opt-body">
                      <div className="mb-goal-opt-label">{o.label}</div>
                      <div className="mb-goal-opt-desc">{o.desc}</div>
                    </div>
                    <div className="mb-goal-opt-arrow">
                      <ChevronIcon />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {mode === "form" && (
        <div className="mb-form-wrap">
          <div className="mb-form-head">
            <button
              className="mb-goals-back"
              type="button"
              onClick={() => {
                setGoalsStep(GOALS_STEPS.length - 1)
                setMode("goals")
              }}
              aria-label="Назад"
            >
              <ChevronIcon dir="left" />
            </button>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div className="mb-form-step-label">Последний шаг</div>
            </div>
            <div style={{ width: 36 }} />
          </div>

          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <SteakSVG mood="cool" size={72} color={grade.body} />
          </div>
          <h3 className="mb-form-title">{isAuthenticated ? "Готово!" : "Создай аккаунт"}</h3>
          <p className="mb-form-sub">
            {isAuthenticated ? "Продолжай прокачку в кабинете" : "И записывайся на бесплатный пробный"}
          </p>

          <div className="mb-profile-summary">
            <div className="mb-ps-row">
              <span className="mb-ps-k">Уровень</span>
              <span className="mb-ps-v" style={{ color: grade.color }}>
                {grade.name} · {grade.cefr}
              </span>
            </div>
            <div className="mb-ps-row">
              <span className="mb-ps-k">Цель</span>
              <span className="mb-ps-v">
                {GOALS_STEPS[0].options.find((o) => o.id === goals.purpose)?.label || "—"}
              </span>
            </div>
            <div className="mb-ps-row">
              <span className="mb-ps-k">Срок</span>
              <span className="mb-ps-v">
                {GOALS_STEPS[1].options.find((o) => o.id === goals.timeline)?.label || "—"}
              </span>
            </div>
            <div className="mb-ps-row">
              <span className="mb-ps-k">Интенсивность</span>
              <span className="mb-ps-v">
                {GOALS_STEPS[2].options.find((o) => o.id === goals.intensity)?.label || "—"}
              </span>
            </div>
          </div>

          <div className="mb-form-cta-row">
            <Link href={ctaHref} className="mb-btn-primary mb-btn-full">
              {isAuthenticated ? "Перейти в кабинет" : "Создать аккаунт"}
            </Link>
            <p className="mb-form-hint">
              {isAuthenticated
                ? `Твой уровень: ${grade.cefr}. Записывайся на урок и практикуй слабые места.`
                : `На странице регистрации подтвердим твой уровень (${grade.cefr}) и подберём преподавателя.`}
            </p>
          </div>

          <button className="mb-btn-ghost mb-btn-full" type="button" onClick={() => setMode("result")}>
            Вернуться к результату
          </button>
        </div>
      )}
    </div>
  )
}

const MINI_BATTLE_CSS = `
.mini-battle {
  max-width: 720px;
  margin: 30px auto 0;
  padding: 32px 24px;
  background: var(--card);
  border: 2px solid var(--border);
  border-radius: 28px;
  position: relative;
  overflow: hidden;
  text-align: left;
}
.mini-battle::before {
  content: '';
  position: absolute;
  top: -100px;
  right: -100px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--red-bg) 0%, transparent 70%);
  pointer-events: none;
}
.mini-battle > * { position: relative; }

.mini-battle button {
  font-family: inherit;
  cursor: pointer;
}

/* Intro */
.mb-intro { text-align: center; padding: 8px 0; animation: mb-pop 0.5s ease-out; }
.mb-intro-label {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--red);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 14px;
}
.mb-intro-title {
  font-size: clamp(28px, 5vw, 42px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin-bottom: 10px;
  color: var(--text);
}
.mb-brand {
  font-family: 'Gluten', cursive;
  color: var(--red);
  font-weight: 600;
  display: inline-block;
  letter-spacing: 0;
}
.mb-intro-mascot { margin: 20px 0 14px; display: flex; justify-content: center; }
.mb-intro-mascot svg { animation: mb-float 3.5s ease-in-out infinite; }
.mb-cta-title {
  font-family: 'Gluten', cursive;
  color: var(--red);
  font-size: 34px;
  line-height: 1;
  margin: 10px 0;
  font-weight: 600;
}
.mb-intro-desc {
  color: var(--text2);
  font-size: 15px;
  max-width: 440px;
  margin: 0 auto 22px;
  line-height: 1.55;
}
.mb-stats { display: flex; justify-content: center; gap: 28px; margin-bottom: 24px; flex-wrap: wrap; }
.mb-stat { text-align: center; }
.mb-stat-val {
  font-family: 'Gluten', cursive;
  color: var(--red);
  font-size: 28px;
  line-height: 1;
  font-weight: 600;
}
.mb-stat-label {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--text3);
  text-transform: uppercase;
  font-weight: 700;
  margin-top: 4px;
}

/* Buttons */
.mb-btn-primary {
  background: var(--red);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  padding: 16px 28px;
  border-radius: 14px;
  box-shadow: 0 4px 0 #991F1F, 0 8px 24px rgba(230,57,70,0.2);
  transition: transform 0.1s, box-shadow 0.1s, background 0.2s;
  width: 100%;
  max-width: 320px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  box-sizing: border-box;
  border: none;
}
.mb-btn-primary:hover { transform: translateY(-1px); background: var(--red-light, var(--red)); }
.mb-btn-primary:active { transform: translateY(3px); box-shadow: 0 1px 0 #991F1F; }
.mb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.mb-btn-full { max-width: none !important; width: 100%; }

.mb-btn-ghost {
  background: transparent;
  color: var(--text2);
  border: 1px solid var(--border);
  padding: 14px 24px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  width: 100%;
  max-width: 320px;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  box-sizing: border-box;
  margin-top: 10px;
}
.mb-btn-ghost:hover { background: var(--bg2); color: var(--text); border-color: var(--red); }

/* Game / HUD */
.mb-game-wrap { animation: mb-pop 0.45s ease-out; }
.mb-hud {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 20px;
}
.mb-lives { display: flex; gap: 4px; flex-shrink: 0; }
.mb-progress { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.mb-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--red), var(--red-light));
  border-radius: 3px;
  transition: width 0.5s ease;
}
.mb-q-counter { font-size: 12px; font-weight: 700; color: var(--text3); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.mb-skip-btn {
  font-size: 12px;
  color: var(--text3);
  padding: 4px 10px;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
  font-weight: 600;
}
.mb-skip-btn:hover { color: var(--text); background: var(--border); }

/* Question */
.mb-question-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 24px;
  animation: mb-slide-in 0.35s ease-out;
}
.mb-q-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 22px; }
.mb-q-meta {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--text3);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 6px;
}
.mb-q-text { font-size: 18px; font-weight: 700; line-height: 1.4; color: var(--text); }
.mb-q-blank {
  background: var(--red-bg);
  color: var(--red);
  padding: 1px 12px;
  border-radius: 6px;
  font-style: italic;
  display: inline-block;
}
.mb-options { display: flex; flex-direction: column; gap: 10px; }
.mb-option {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  width: 100%;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  box-sizing: border-box;
}
.mb-option:hover:not(:disabled) {
  background: var(--bg2);
  border-color: var(--red);
  transform: translateY(-1px);
}
.mb-option:disabled { cursor: default; }
.mb-opt-letter {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--bg2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--text2);
}
.mb-option.is-correct { background: rgba(74,222,128,0.12); border-color: #4ADE80; }
.mb-option.is-correct .mb-opt-letter { background: #4ADE80; color: #0a0a0a; border-color: #4ADE80; }
.mb-option.is-wrong { background: var(--red-bg); border-color: var(--red); }
.mb-option.is-wrong .mb-opt-letter { background: var(--red); color: #fff; border-color: var(--red); }
.mb-option.is-wrong .mb-opt-text { text-decoration: line-through; opacity: 0.75; }
.mb-shake { animation: mb-shake 0.35s; }

/* Gameover */
.mb-gameover { text-align: center; padding: 12px 0; animation: mb-pop 0.5s ease-out; }

/* Result */
.mb-result { text-align: center; padding: 6px 0; animation: mb-pop 0.6s ease-out; }
.mb-result-label {
  font-size: 11px;
  letter-spacing: 0.25em;
  color: var(--text3);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 12px;
}
.mb-result-mascot { margin: 8px 0 16px; display: flex; justify-content: center; }
.mb-result-mascot svg { animation: mb-float 3s ease-in-out infinite; }
.mb-result-name {
  font-family: 'Gluten', cursive;
  font-size: 48px;
  line-height: 1;
  margin-bottom: 8px;
  font-weight: 600;
  letter-spacing: 0;
}
.mb-result-tag {
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--text2);
  margin-bottom: 14px;
}
.mb-result-sub {
  font-size: 15px;
  color: var(--text2);
  max-width: 420px;
  margin: 0 auto 22px;
  line-height: 1.5;
}
.mb-grade-bar { display: flex; justify-content: center; gap: 6px; margin-bottom: 24px; }
.mb-grade-seg {
  flex: 1;
  max-width: 56px;
  height: 8px;
  border-radius: 4px;
  background: var(--border);
  transition: background 0.5s;
}
.mb-result-stats {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-around;
}
.mb-rs { text-align: center; }
.mb-rs-val {
  font-family: 'Gluten', cursive;
  font-size: 24px;
  line-height: 1;
  color: var(--text);
  font-weight: 600;
}
.mb-rs-label {
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text3);
  font-weight: 700;
  margin-top: 4px;
}

/* Breakdown */
.mb-breakdown {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 22px;
  text-align: left;
}
.mb-breakdown h4 {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 14px;
  color: var(--text2);
}
.mb-bd-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.mb-bd-row:last-child { margin-bottom: 0; }
.mb-bd-level { font-size: 12px; font-weight: 800; color: var(--text); width: 28px; flex-shrink: 0; }
.mb-bd-track { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.mb-bd-fill { height: 100%; border-radius: 3px; transition: width 0.8s ease; }
.mb-bd-score {
  font-size: 11px;
  color: var(--text3);
  width: 36px;
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

/* CTA card */
.mb-cta-card {
  background: linear-gradient(135deg, var(--red-bg), transparent);
  border: 1px solid var(--red);
  border-radius: 18px;
  padding: 22px 20px;
  margin-bottom: 14px;
  text-align: left;
  position: relative;
  overflow: hidden;
}
.mb-cta-card::before {
  content: '';
  position: absolute;
  top: -20px;
  right: -20px;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, var(--red-bg), transparent 70%);
  pointer-events: none;
}
.mb-cta-label {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--red);
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 8px;
  position: relative;
}
.mb-cta-card-title {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.25;
  margin-bottom: 6px;
  position: relative;
  color: var(--text);
}
.mb-cta-desc {
  font-size: 13px;
  color: var(--text2);
  margin-bottom: 16px;
  position: relative;
  line-height: 1.5;
}
.mb-cta-features { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; position: relative; }
.mb-cta-feat { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); font-weight: 500; }
.mb-cta-feat svg { flex-shrink: 0; }

/* Goals */
.mb-goals-wrap { animation: mb-pop 0.4s ease-out; }
.mb-goals-head { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
.mb-goals-back {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--bg2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  transition: background 0.15s;
  flex-shrink: 0;
}
.mb-goals-back:hover { background: var(--card); border-color: var(--red); color: var(--red); }
.mb-goals-progress { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.mb-goals-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--red), var(--red-light));
  border-radius: 3px;
  transition: width 0.5s ease;
}
.mb-goals-step { font-size: 12px; font-weight: 700; color: var(--text3); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.mb-goals-content { text-align: center; }
.mb-goals-mascot { margin: 6px 0 16px; display: flex; justify-content: center; }
.mb-goals-mascot svg { animation: mb-float 3s ease-in-out infinite; }
.mb-goals-title { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; color: var(--text); }
.mb-goals-subtitle { font-size: 14px; color: var(--text2); margin-bottom: 22px; }
.mb-goals-options { display: flex; flex-direction: column; gap: 10px; text-align: left; }
.mb-goal-opt {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bg2);
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 14px 16px;
  color: var(--text);
  width: 100%;
  transition: all 0.15s;
  box-sizing: border-box;
}
.mb-goal-opt:hover { background: var(--card); border-color: var(--red); transform: translateX(2px); }
.mb-goal-opt.is-picked { background: var(--red-bg); border-color: var(--red); transform: scale(0.98); }
.mb-goal-opt-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--red-bg);
  color: var(--red);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.mb-goal-opt.is-picked .mb-goal-opt-icon { background: var(--red); color: #fff; }
.mb-goal-opt-body { flex: 1; min-width: 0; text-align: left; }
.mb-goal-opt-label { font-size: 15px; font-weight: 700; line-height: 1.2; margin-bottom: 2px; color: var(--text); }
.mb-goal-opt-desc { font-size: 12px; color: var(--text3); line-height: 1.3; }
.mb-goal-opt-arrow { color: var(--text3); flex-shrink: 0; }

/* Form */
.mb-form-wrap { animation: mb-pop 0.4s ease-out; text-align: left; }
.mb-form-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.mb-form-step-label {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--red);
  text-transform: uppercase;
  font-weight: 800;
}
.mb-form-title {
  font-size: 22px;
  font-weight: 800;
  text-align: center;
  margin-bottom: 6px;
  letter-spacing: -0.01em;
  color: var(--text);
}
.mb-form-sub { font-size: 14px; color: var(--text2); text-align: center; margin-bottom: 22px; }
.mb-profile-summary {
  background: linear-gradient(135deg, var(--red-bg), transparent);
  border: 1px solid var(--red);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 20px;
}
.mb-ps-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; gap: 12px; }
.mb-ps-k { color: var(--text3); font-weight: 600; }
.mb-ps-v { color: var(--text); font-weight: 700; text-align: right; }
.mb-form-cta-row { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 8px; }
.mb-form-hint { font-size: 12px; color: var(--text3); text-align: center; line-height: 1.5; margin: 4px 0 0; }

/* Animations */
@keyframes mb-pop {
  0% { transform: scale(0.94); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes mb-slide-in {
  0% { transform: translateX(20px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes mb-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes mb-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

@media (max-width: 520px) {
  .mini-battle { padding: 22px 16px; border-radius: 22px; }
  .mb-question-card { padding: 18px; }
  .mb-q-text { font-size: 16px; }
  .mb-option { padding: 12px 14px; font-size: 14px; }
  .mb-stats { gap: 18px; }
  .mb-result-name { font-size: 40px; }
  .mb-hud { gap: 10px; padding: 10px 12px; }
  .mb-skip-btn { font-size: 11px; padding: 4px 8px; }
}
`
