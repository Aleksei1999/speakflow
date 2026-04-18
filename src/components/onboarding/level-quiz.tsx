"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
  type JSX,
} from "react"

/* ============================================================
 *  Types
 * ============================================================ */

export type RawLevel =
  | "raw"
  | "rare"
  | "mediumrare"
  | "medium"
  | "mediumwell"
  | "welldone"

export interface QuizResult {
  level: RawLevel
  levelName: string
  xp: number
  correctCount: number
  totalQuestions: number
  percent: number
  answers: Record<number, number>
}

export interface LevelQuizProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (result: QuizResult) => void
}

interface QuestionAnswer {
  t: string
  c: 0 | 1
}

interface Question {
  q: string
  a: QuestionAnswer[]
  cat: string
}

interface RawLevelDef {
  name: string
  key: RawLevel
  range: [number, number]
  desc: string
  emoji: string
}

/* ============================================================
 *  Question bank (ported verbatim from quiz-onboarding-v2.html)
 * ============================================================ */

const L1: Question[] = [
  {
    q: "We ___ from London. We're from Manchester.",
    a: [
      { t: "not are", c: 0 },
      { t: "aren't", c: 1 },
      { t: "isn't", c: 0 },
      { t: "not", c: 0 },
    ],
    cat: "Grammar",
  },
  {
    q: "___ your brother like football?",
    a: [
      { t: "Do", c: 0 },
      { t: "Does", c: 1 },
      { t: "Is", c: 0 },
      { t: "Are", c: 0 },
    ],
    cat: "Grammar",
  },
  {
    q: "She ___ her homework every evening.",
    a: [
      { t: "do", c: 0 },
      { t: "does", c: 1 },
      { t: "make", c: 0 },
      { t: "making", c: 0 },
    ],
    cat: "Grammar",
  },
  {
    q: "Is the Sahara ___ desert in the world?",
    a: [
      { t: "the bigger", c: 0 },
      { t: "the most biggest", c: 0 },
      { t: "the largest", c: 1 },
      { t: "most large", c: 0 },
    ],
    cat: "Superlatives",
  },
  {
    q: "It's my ___ birthday tomorrow.",
    a: [
      { t: "sisters", c: 0 },
      { t: "sister's", c: 1 },
      { t: "sister", c: 0 },
      { t: "sisters'", c: 0 },
    ],
    cat: "Possessives",
  },
  {
    q: "There ___ any milk in the fridge.",
    a: [
      { t: "isn't", c: 1 },
      { t: "aren't", c: 0 },
      { t: "doesn't", c: 0 },
      { t: "wasn't", c: 0 },
    ],
    cat: "Grammar",
  },
  {
    q: "I ___ to the cinema last Saturday.",
    a: [
      { t: "have gone", c: 0 },
      { t: "go", c: 0 },
      { t: "went", c: 1 },
      { t: "was go", c: 0 },
    ],
    cat: "Past Simple",
  },
  {
    q: "What ___ do next weekend?",
    a: [
      { t: "are you going", c: 0 },
      { t: "are you going to", c: 1 },
      { t: "do you go to", c: 0 },
      { t: "you going", c: 0 },
    ],
    cat: "Future Plans",
  },
  {
    q: "We ___ to Australia.",
    a: [
      { t: "haven't be", c: 0 },
      { t: "hasn't been", c: 0 },
      { t: "haven't been", c: 1 },
      { t: "haven't go", c: 0 },
    ],
    cat: "Present Perfect",
  },
  {
    q: "He ___ follow the rules.",
    a: [
      { t: "doesn't can", c: 0 },
      { t: "not can", c: 0 },
      { t: "isn't can", c: 0 },
      { t: "can't", c: 1 },
    ],
    cat: "Modal Verbs",
  },
]

const L2: Question[] = [
  {
    q: "It ___ heavily when they left the office.",
    a: [
      { t: "rained", c: 0 },
      { t: "was raining", c: 1 },
      { t: "is raining", c: 0 },
      { t: "was to rain", c: 0 },
    ],
    cat: "Past Continuous",
  },
  {
    q: "That's the restaurant ___ we had our anniversary dinner.",
    a: [
      { t: "what", c: 0 },
      { t: "where", c: 1 },
      { t: "that", c: 0 },
      { t: "which", c: 0 },
    ],
    cat: "Relative Clauses",
  },
  {
    q: "I don't get ___ very well with my neighbour.",
    a: [
      { t: "by", c: 0 },
      { t: "from", c: 0 },
      { t: "on", c: 1 },
      { t: "to", c: 0 },
    ],
    cat: "Phrasal Verbs",
  },
  {
    q: "___ she studied hard, she failed the exam.",
    a: [
      { t: "Although", c: 1 },
      { t: "So", c: 0 },
      { t: "Because", c: 0 },
      { t: "But", c: 0 },
    ],
    cat: "Linking Words",
  },
  {
    q: "When I arrived at work I realized that ___ my laptop at home.",
    a: [
      { t: "I'd leave", c: 0 },
      { t: "I was leaving", c: 0 },
      { t: "I'd left", c: 1 },
      { t: "I leave", c: 0 },
    ],
    cat: "Past Perfect",
  },
  {
    q: "I haven't finished my report ___.",
    a: [
      { t: "just", c: 0 },
      { t: "already", c: 0 },
      { t: "yet", c: 1 },
      { t: "since", c: 0 },
    ],
    cat: "Present Perfect",
  },
  {
    q: "If we had enough money, we ___ buy a bigger flat.",
    a: [
      { t: "will can", c: 0 },
      { t: "can", c: 0 },
      { t: "would can", c: 0 },
      { t: "could", c: 1 },
    ],
    cat: "Conditionals",
  },
  {
    q: "The Mona Lisa ___ by Leonardo da Vinci.",
    a: [
      { t: "painted", c: 0 },
      { t: "was painted", c: 1 },
      { t: "is painting", c: 0 },
      { t: "has painted", c: 0 },
    ],
    cat: "Passive Voice",
  },
  {
    q: "If you leave early, ___ the train.",
    a: [
      { t: "you catch", c: 0 },
      { t: "you'd catch", c: 0 },
      { t: "you'll catch", c: 1 },
      { t: "you're catching", c: 0 },
    ],
    cat: "First Conditional",
  },
  {
    q: "You eat ___ fast food — you should cut down.",
    a: [
      { t: "too much", c: 1 },
      { t: "enough", c: 0 },
      { t: "very many", c: 0 },
      { t: "much", c: 0 },
    ],
    cat: "Quantifiers",
  },
]

const L3: Question[] = [
  {
    q: "___ Tom nor Sarah wanted to attend the meeting.",
    a: [
      { t: "Neither", c: 1 },
      { t: "Both", c: 0 },
      { t: "Either", c: 0 },
      { t: "Not", c: 0 },
    ],
    cat: "Correlative Conjunctions",
  },
  {
    q: "We ___ in this city since we got married.",
    a: [
      { t: "live", c: 0 },
      { t: "are living", c: 0 },
      { t: "lived", c: 0 },
      { t: "'ve been living", c: 1 },
    ],
    cat: "Present Perfect Cont.",
  },
  {
    q: "This coffee isn't ___.",
    a: [
      { t: "enough hot", c: 0 },
      { t: "hot enough", c: 1 },
      { t: "much hot", c: 0 },
      { t: "very much hot", c: 0 },
    ],
    cat: "Word Order",
  },
  {
    q: "Would you accept the offer if they ___ you?",
    a: [
      { t: "would ask", c: 0 },
      { t: "ask", c: 0 },
      { t: "did ask", c: 0 },
      { t: "asked", c: 1 },
    ],
    cat: "Second Conditional",
  },
  {
    q: "I can't ___ to go on holiday this summer.",
    a: [
      { t: "afford", c: 1 },
      { t: "spend", c: 0 },
      { t: "pay", c: 0 },
      { t: "think", c: 0 },
    ],
    cat: "Vocabulary",
  },
  {
    q: "She told me ___ late again.",
    a: [
      { t: "not to be", c: 1 },
      { t: "not be", c: 0 },
      { t: "not being", c: 0 },
      { t: "don't be", c: 0 },
    ],
    cat: "Reported Speech",
  },
  {
    q: "I'm exhausted. I ___ all morning.",
    a: [
      { t: "study", c: 0 },
      { t: "'ve been studying", c: 1 },
      { t: "'m studying", c: 0 },
      { t: "was studying", c: 0 },
    ],
    cat: "Present Perfect Cont.",
  },
  {
    q: "He didn't book that flight, ___?",
    a: [
      { t: "is it", c: 0 },
      { t: "didn't he", c: 0 },
      { t: "did he", c: 1 },
      { t: "isn't it", c: 0 },
    ],
    cat: "Question Tags",
  },
  {
    q: "I'll bring an umbrella ___ it starts raining.",
    a: [
      { t: "so", c: 0 },
      { t: "although", c: 0 },
      { t: "in case", c: 1 },
      { t: "unless", c: 0 },
    ],
    cat: "Conjunctions",
  },
  {
    q: "They don't get ___ very well with each other.",
    a: [
      { t: "together", c: 0 },
      { t: "on", c: 1 },
      { t: "in", c: 0 },
      { t: "by", c: 0 },
    ],
    cat: "Phrasal Verbs",
  },
]

export const QUESTIONS: readonly [Question[], Question[], Question[]] = [L1, L2, L3] as const

const LEVEL_NAMES = [
  "Level 1 · Elementary",
  "Level 2 · Pre-Intermediate",
  "Level 3 · Intermediate",
] as const

export const RAW_LEVELS: readonly RawLevelDef[] = [
  {
    name: "Raw",
    key: "raw",
    range: [0, 20],
    desc:
      "Ты в начале пути. Базовые конструкции пока путаются, но это нормально — все начинали именно так. Speaking clubs помогут заговорить.",
    emoji: "🔥",
  },
  {
    name: "Rare",
    key: "rare",
    range: [21, 35],
    desc:
      "Фундамент есть! Базовая грамматика на месте, но для уверенной речи нужна практика. Идеальный момент подключить speaking clubs.",
    emoji: "📈",
  },
  {
    name: "Medium Rare",
    key: "mediumrare",
    range: [36, 50],
    desc:
      "Ты общаешься, но не всегда уверенно. Пора расширять словарный запас и прокачивать fluency через живое общение.",
    emoji: "⚡",
  },
  {
    name: "Medium",
    key: "medium",
    range: [51, 65],
    desc:
      "Свободно поддерживаешь беседу! Debate clubs и нишевые форматы — твой следующий шаг к совершенству.",
    emoji: "🎯",
  },
  {
    name: "Medium Well",
    key: "mediumwell",
    range: [66, 78],
    desc:
      "Ты уверенно владеешь языком и чувствуешь нюансы. Осталось отточить стиль — и ты Well Done.",
    emoji: "🏆",
  },
  {
    name: "Well Done",
    key: "welldone",
    range: [79, 100],
    desc:
      "Ты думаешь на английском! Полная свобода. Помогай другим расти — стань частью коммьюнити менторов.",
    emoji: "⭐",
  },
] as const

/* ============================================================
 *  State machine
 * ============================================================ */

type Screen = "welcome" | "question" | "levelup" | "result"

interface State {
  screen: Screen
  currentLevel: 0 | 1 | 2
  currentQ: number
  globalQ: number
  xp: number
  scores: [number, number, number]
  answered: boolean
  pickedIdx: number | null
  pickedCorrect: boolean
  answers: Record<number, number>
  levelUpPassed: boolean
}

const INITIAL: State = {
  screen: "welcome",
  currentLevel: 0,
  currentQ: 0,
  globalQ: 0,
  xp: 0,
  scores: [0, 0, 0],
  answered: false,
  pickedIdx: null,
  pickedCorrect: false,
  answers: {},
  levelUpPassed: false,
}

type Action =
  | { type: "reset" }
  | { type: "start" }
  | {
      type: "pick"
      pickedIdx: number
      correct: boolean
      originalIdx: number
    }
  | { type: "advance" }
  | { type: "continue-next-level" }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return { ...INITIAL }
    case "start":
      return { ...INITIAL, screen: "question" }
    case "pick": {
      if (state.answered) return state
      const xpGain = action.correct ? (state.currentLevel + 1) * 3 + 2 : 1
      const scores: [number, number, number] = [...state.scores] as [
        number,
        number,
        number,
      ]
      if (action.correct) scores[state.currentLevel] += 1
      return {
        ...state,
        answered: true,
        pickedIdx: action.pickedIdx,
        pickedCorrect: action.correct,
        xp: state.xp + xpGain,
        scores,
        answers: { ...state.answers, [state.globalQ]: action.originalIdx },
      }
    }
    case "advance": {
      const nextQ = state.currentQ + 1
      const nextGlobal = state.globalQ + 1
      if (nextQ >= 10) {
        if (state.currentLevel < 2) {
          return {
            ...state,
            screen: "levelup",
            levelUpPassed: state.scores[state.currentLevel] >= 5,
            answered: false,
            pickedIdx: null,
            pickedCorrect: false,
          }
        }
        return {
          ...state,
          screen: "result",
          currentQ: nextQ,
          globalQ: nextGlobal,
          answered: false,
          pickedIdx: null,
          pickedCorrect: false,
        }
      }
      return {
        ...state,
        currentQ: nextQ,
        globalQ: nextGlobal,
        answered: false,
        pickedIdx: null,
        pickedCorrect: false,
      }
    }
    case "continue-next-level": {
      const nextLevel = (state.currentLevel + 1) as 0 | 1 | 2
      return {
        ...state,
        screen: "question",
        currentLevel: nextLevel,
        currentQ: 0,
        globalQ: state.globalQ + 1,
        answered: false,
        pickedIdx: null,
        pickedCorrect: false,
      }
    }
    default:
      return state
  }
}

/* ============================================================
 *  Helpers
 * ============================================================ */

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i] as T
    out[i] = out[j] as T
    out[j] = tmp
  }
  return out
}

function resolveRawLevel(pct: number): RawLevelDef {
  let picked: RawLevelDef = RAW_LEVELS[0] as RawLevelDef
  for (const l of RAW_LEVELS) {
    if (pct >= l.range[0]) picked = l
  }
  return picked
}

function usePrefersReducedMotion(): boolean {
  const ref = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    ref.current = mq.matches
  }, [])
  return ref.current
}

/* ============================================================
 *  Component
 * ============================================================ */

const KEYS = ["A", "B", "C", "D"] as const

export function LevelQuiz({
  open,
  onOpenChange,
  onComplete,
}: LevelQuizProps): JSX.Element {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const reducedMotion = usePrefersReducedMotion()
  const completedRef = useRef(false)

  // Reset state whenever overlay is re-opened
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      dispatch({ type: "reset" })
      completedRef.current = false
    }
    wasOpen.current = open
  }, [open])

  // Shuffled answers for the current question — stable until question changes
  const shuffledAnswers = useMemo(() => {
    if (state.screen !== "question") return []
    const q = QUESTIONS[state.currentLevel][state.currentQ]
    if (!q) return []
    return shuffle(
      q.a.map((a, idx) => ({ ...a, originalIdx: idx })),
    )
    // Re-shuffle on each new (level, question) pair
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen, state.currentLevel, state.currentQ])

  // Auto-advance after a pick
  useEffect(() => {
    if (state.screen !== "question" || !state.answered) return
    const t = setTimeout(() => {
      dispatch({ type: "advance" })
    }, 1100)
    return () => clearTimeout(t)
  }, [state.screen, state.answered, state.globalQ])

  // Keyboard shortcuts A/B/C/D
  useEffect(() => {
    if (!open || state.screen !== "question" || state.answered) return
    const handler = (e: KeyboardEvent) => {
      const idx = KEYS.indexOf(
        e.key.toUpperCase() as (typeof KEYS)[number],
      )
      if (idx === -1 || idx >= shuffledAnswers.length) return
      const picked = shuffledAnswers[idx]
      if (!picked) return
      dispatch({
        type: "pick",
        pickedIdx: idx,
        correct: picked.c === 1,
        originalIdx: picked.originalIdx,
      })
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, state.screen, state.answered, shuffledAnswers])

  // When we reach "result", save to localStorage (once) — onComplete fires on user click
  const totalCorrect = state.scores[0] + state.scores[1] + state.scores[2]
  const percent = Math.round((totalCorrect / 30) * 100)
  const resolvedLevel = useMemo(() => resolveRawLevel(percent), [percent])

  useEffect(() => {
    if (state.screen !== "result") return
    if (typeof window === "undefined") return
    try {
      const result: QuizResult = {
        level: resolvedLevel.key,
        levelName: resolvedLevel.name,
        xp: state.xp,
        correctCount: totalCorrect,
        totalQuestions: 30,
        percent,
        answers: state.answers,
      }
      window.localStorage.setItem("raw_quiz_result", JSON.stringify(result))
    } catch {
      // ignore storage errors
    }
  }, [
    state.screen,
    resolvedLevel.key,
    resolvedLevel.name,
    state.xp,
    totalCorrect,
    percent,
    state.answers,
  ])

  const handleStart = useCallback(() => dispatch({ type: "start" }), [])
  const handleRestart = useCallback(() => dispatch({ type: "reset" }), [])
  const handleClose = useCallback(
    () => onOpenChange(false),
    [onOpenChange],
  )
  const handleComplete = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    const result: QuizResult = {
      level: resolvedLevel.key,
      levelName: resolvedLevel.name,
      xp: state.xp,
      correctCount: totalCorrect,
      totalQuestions: 30,
      percent,
      answers: state.answers,
    }
    onComplete(result)
    onOpenChange(false)
  }, [
    resolvedLevel.key,
    resolvedLevel.name,
    state.xp,
    totalCorrect,
    percent,
    state.answers,
    onComplete,
    onOpenChange,
  ])

  const onPick = useCallback(
    (idx: number) => {
      if (state.answered) return
      const picked = shuffledAnswers[idx]
      if (!picked) return
      dispatch({
        type: "pick",
        pickedIdx: idx,
        correct: picked.c === 1,
        originalIdx: picked.originalIdx,
      })
    },
    [state.answered, shuffledAnswers],
  )

  if (!open) return <></>

  const progressPct =
    state.screen === "result"
      ? 100
      : state.screen === "welcome"
        ? 0
        : (state.globalQ / 30) * 100

  const showProgress = state.screen !== "welcome"

  return (
    <div className="rq-overlay" role="dialog" aria-modal="true" aria-label="Тест уровня английского">
      <style>{CSS}</style>
      <div className="rq-card">
        <div className="rq-accent" />
        <header className="rq-header">
          <div className="rq-logo">
            Raw <span>english</span>
          </div>
          <button
            type="button"
            className="rq-close"
            onClick={handleClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </header>

        {showProgress && (
          <div className="rq-progress">
            <div className="rq-prog-top">
              <div className="rq-step">
                {state.screen === "result"
                  ? "Результат"
                  : `Вопрос ${Math.min(state.globalQ + 1, 30)} / 30`}
              </div>
              <div
                className={`rq-level-badge rq-level-badge--${state.currentLevel + 1}`}
              >
                {LEVEL_NAMES[state.currentLevel]}
              </div>
              <div
                className={`rq-xp${state.answered ? " rq-xp-bump" : ""}`}
                key={state.xp}
              >
                ⚡ <span>{state.xp}</span> XP
              </div>
            </div>
            <div className="rq-bar">
              <div className="rq-bar-fill" style={{ width: `${progressPct}%` }} />
              <div className="rq-bar-segments">
                <div className="rq-bar-seg" />
                <div className="rq-bar-seg" />
                <div className="rq-bar-seg" />
              </div>
            </div>
          </div>
        )}

        <div className="rq-body">
          {state.screen === "welcome" && (
            <WelcomeScreen reducedMotion={reducedMotion} />
          )}

          {state.screen === "question" && (
            <QuestionScreen
              question={QUESTIONS[state.currentLevel][state.currentQ] as Question}
              globalQ={state.globalQ}
              shuffled={shuffledAnswers}
              answered={state.answered}
              pickedIdx={state.pickedIdx}
              currentLevel={state.currentLevel}
              onPick={onPick}
            />
          )}

          {state.screen === "levelup" && (
            <LevelUpScreen
              passed={state.levelUpPassed}
              nextLevelName={
                LEVEL_NAMES[(state.currentLevel + 1) as 0 | 1 | 2] ?? ""
              }
            />
          )}

          {state.screen === "result" && (
            <ResultScreen
              level={resolvedLevel}
              xp={state.xp}
              correct={totalCorrect}
              percent={percent}
              reducedMotion={reducedMotion}
            />
          )}
        </div>

        <footer className="rq-footer">
          {state.screen === "welcome" && (
            <button
              type="button"
              className="rq-btn rq-btn--red"
              onClick={handleStart}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Начать тест
            </button>
          )}

          {state.screen === "levelup" && (
            <button
              type="button"
              className="rq-btn rq-btn--red"
              onClick={() => dispatch({ type: "continue-next-level" })}
            >
              Продолжить →
            </button>
          )}

          {state.screen === "result" && (
            <>
              <button
                type="button"
                className="rq-btn rq-btn--lime"
                onClick={handleComplete}
              >
                🔥 Начать прокачку
              </button>
              <button
                type="button"
                className="rq-btn rq-btn--ghost"
                onClick={handleRestart}
              >
                Пройти ещё раз
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

/* ============================================================
 *  Sub-screens
 * ============================================================ */

function WelcomeScreen({ reducedMotion }: { reducedMotion: boolean }): JSX.Element {
  return (
    <div className="rq-slide rq-welcome">
      <div className={`rq-w-icon${reducedMotion ? "" : " rq-w-icon-float"}`}>
        🔥
      </div>
      <h2>
        Определи свой уровень
        <br />
        <span className="rq-gl">прожарки</span>
      </h2>
      <p>
        30 вопросов, 3 уровня сложности. Тест адаптируется под тебя — чем лучше
        отвечаешь, тем сложнее становится.
      </p>
      <div className="rq-w-tags">
        <span className="rq-w-tag rq-w-tag--time">⏱ 5–7 мин</span>
        <span className="rq-w-tag rq-w-tag--q">📝 30 вопросов</span>
        <span className="rq-w-tag rq-w-tag--free">✨ Бесплатно</span>
      </div>
      <div className="rq-w-levels">
        <span className="rq-w-lv rq-w-lv--1">Elementary</span>
        <span className="rq-w-lv rq-w-lv--2">Pre-Intermediate</span>
        <span className="rq-w-lv rq-w-lv--3">Intermediate</span>
      </div>
      <div className="rq-w-note">Тест определит твой уровень от Raw до Well Done</div>
    </div>
  )
}

interface ShuffledAnswer extends QuestionAnswer {
  originalIdx: number
}

function QuestionScreen({
  question,
  globalQ,
  shuffled,
  answered,
  pickedIdx,
  currentLevel,
  onPick,
}: {
  question: Question
  globalQ: number
  shuffled: ShuffledAnswer[]
  answered: boolean
  pickedIdx: number | null
  currentLevel: 0 | 1 | 2
  onPick: (idx: number) => void
}): JSX.Element {
  const xpGain = (currentLevel + 1) * 3 + 2
  // Render question text with backticks treated as <code>
  const parts = useMemo(() => parseQuestionText(question.q), [question.q])

  return (
    <div className="rq-slide" key={globalQ}>
      <div className="rq-label">
        <div className="rq-label-dot" />
        {question.cat}
      </div>
      <div className="rq-num">{String(globalQ + 1).padStart(2, "0")}</div>
      <div className="rq-text">
        {parts.map((p, i) =>
          p.code ? (
            <code key={i}>{p.text}</code>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </div>
      <div className="rq-answers">
        {shuffled.map((a, i) => {
          const isPicked = pickedIdx === i
          const showCorrect = answered && a.c === 1
          const showWrong = answered && isPicked && a.c !== 1
          const cls =
            "rq-ans" +
            (showCorrect ? " rq-ans-correct" : "") +
            (showWrong ? " rq-ans-wrong" : "")
          return (
            <button
              key={`${globalQ}-${i}`}
              type="button"
              className={cls}
              onClick={() => onPick(i)}
              disabled={answered}
            >
              <div className="rq-ans-key">{KEYS[i]}</div>
              <div className="rq-ans-text">{a.t}</div>
              {showCorrect && isPicked && (
                <div className="rq-xp-pop">+{xpGain} XP</div>
              )}
              {showWrong && <div className="rq-xp-pop rq-xp-pop--mini">+1 XP</div>}
              {showCorrect && !isPicked && (
                <div className="rq-ans-hint">✓ Верно</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LevelUpScreen({
  passed,
  nextLevelName,
}: {
  passed: boolean
  nextLevelName: string
}): JSX.Element {
  return (
    <div className="rq-slide rq-levelup">
      <div
        className={`rq-lu-badge ${passed ? "rq-lu-badge--up" : "rq-lu-badge--same"}`}
      >
        {passed ? "🚀" : "💪"}
      </div>
      <h3>
        {passed ? "Level Up!" : "Продолжаем!"}{" "}
        <span className="rq-gl">{nextLevelName}</span>
      </h3>
      <p>
        {passed
          ? "Отличный результат! Переходим к более сложным вопросам."
          : "Не сдавайся — следующий блок покажет твой потенциал."}
      </p>
    </div>
  )
}

function ResultScreen({
  level,
  xp,
  correct,
  percent,
  reducedMotion,
}: {
  level: RawLevelDef
  xp: number
  correct: number
  percent: number
  reducedMotion: boolean
}): JSX.Element {
  const confetti = useMemo(() => {
    if (reducedMotion || percent <= 50) return []
    const colors = ["#E63946", "#D8F26A", "#1E1E1E", "#F06A52", "#D4A040"]
    return Array.from({ length: 30 }).map((_, i) => {
      const pick = colors[i % colors.length] ?? "#E63946"
      return {
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        duration: 1 + Math.random(),
        color: pick,
      }
    })
  }, [percent, reducedMotion])

  const barStyle: CSSProperties = { ["--rq-w" as string]: `${percent}%` }

  return (
    <div className="rq-slide rq-result">
      <div className="rq-confetti-wrap" aria-hidden="true">
        {confetti.map((c, i) => (
          <div
            key={i}
            className="rq-confetti"
            style={{
              left: `${c.left}%`,
              top: "-10px",
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>
      <div className={`rq-reveal rq-reveal--${level.key}`}>
        <div className="rq-reveal-emoji">{level.emoji}</div>
        <div className="rq-reveal-name">{level.name}</div>
        <div className="rq-reveal-sub">Your level</div>
      </div>
      <h2>
        Твой уровень — <span className="rq-gl">{level.name}</span>
      </h2>
      <p className="rq-desc">{level.desc}</p>
      <div className="rq-stats">
        <div className="rq-stat">
          <div className="rq-stat-val rq-stat-val--red">{xp}</div>
          <div className="rq-stat-lbl">XP</div>
        </div>
        <div className="rq-stat">
          <div className="rq-stat-val rq-stat-val--lime">{correct}/30</div>
          <div className="rq-stat-lbl">Верно</div>
        </div>
        <div className="rq-stat">
          <div className="rq-stat-val rq-stat-val--dark">{percent}%</div>
          <div className="rq-stat-lbl">Результат</div>
        </div>
      </div>
      <div className="rq-bar-wrap">
        <div className="rq-bar-top">
          <div className="rq-bar-lbl">Прогресс</div>
          <div className="rq-bar-val">{level.name}</div>
        </div>
        <div className="rq-r-bar">
          <div className="rq-r-bar-fill" style={barStyle} />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 *  Text parsing — preserves `code` spans
 * ============================================================ */

interface TextPart {
  text: string
  code: boolean
}
function parseQuestionText(src: string): TextPart[] {
  // HTML source used literal ___ not backticks, but also may include <code>.
  // Wrap ___ in a code span for visual consistency with the original CSS.
  const out: TextPart[] = []
  const regex = /___/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(src)) !== null) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), code: false })
    out.push({ text: "___", code: true })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ text: src.slice(last), code: false })
  return out
}

/* ============================================================
 *  Scoped CSS
 * ============================================================ */

const CSS = `
.rq-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--font-sans,Inter,sans-serif);color:#1A1A1A}
.rq-overlay *{box-sizing:border-box}
.rq-card{width:100%;max-width:580px;background:#fff;border-radius:28px;box-shadow:0 8px 0 rgba(0,0,0,.06),0 30px 80px rgba(0,0,0,.15);position:relative;overflow:hidden;max-height:92vh;display:flex;flex-direction:column}
.rq-accent{position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#E63946,#D8F26A);z-index:5}
.rq-header{padding:20px 24px 0;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:2}
.rq-logo{font-family:var(--font-gluten,'Gluten',cursive);font-size:1.1rem;color:#E63946;font-weight:600}
.rq-logo span{font-family:var(--font-sans,Inter,sans-serif);font-weight:600;font-size:.75rem;color:#1A1A1A}
.rq-close{width:36px;height:36px;border-radius:10px;border:1px solid rgba(0,0,0,.06);background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#999;font-size:1.1rem;transition:all .2s}
.rq-close:hover{border-color:#E63946;color:#E63946}
.rq-close:focus-visible{outline:2px solid #E63946;outline-offset:2px}
.rq-progress{padding:14px 24px 0}
.rq-prog-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px}
.rq-step{font-size:.68rem;font-weight:700;color:#999;letter-spacing:.5px}
.rq-level-badge{padding:3px 10px;border-radius:8px;font-size:.6rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.rq-level-badge--1{background:rgba(230,57,70,.08);color:#E63946}
.rq-level-badge--2{background:rgba(240,140,60,.08);color:#D4880A}
.rq-level-badge--3{background:rgba(216,242,106,.15);color:#5A7A00}
.rq-xp{padding:3px 10px;border-radius:8px;background:rgba(230,57,70,.08);color:#E63946;font-size:.62rem;font-weight:700;display:flex;align-items:center;gap:3px;transition:transform .3s}
.rq-xp-bump{animation:rq-xp-bump .4s ease}
@keyframes rq-xp-bump{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
.rq-bar{height:5px;background:rgba(0,0,0,.06);border-radius:100px;overflow:hidden;position:relative}
.rq-bar-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,#E63946,#D8F26A);transition:width .5s cubic-bezier(.16,1,.3,1)}
.rq-bar-segments{position:absolute;inset:0;display:flex;pointer-events:none}
.rq-bar-seg{flex:1;border-right:2px solid #fff}
.rq-bar-seg:last-child{border-right:none}
.rq-body{padding:24px;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;position:relative}
.rq-slide{animation:rq-slide-in .4s cubic-bezier(.16,1,.3,1) both}
@keyframes rq-slide-in{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
.rq-gl{font-family:var(--font-gluten,'Gluten',cursive);color:#E63946;font-weight:600}

.rq-welcome{text-align:center}
.rq-w-icon{width:80px;height:80px;border-radius:50%;margin:0 auto 20px;background:#E63946;display:flex;align-items:center;justify-content:center;font-size:2rem;box-shadow:0 5px 0 rgba(180,30,45,.35),0 0 0 10px rgba(230,57,70,.08),0 0 40px rgba(230,57,70,.1)}
.rq-w-icon-float{animation:rq-float 3s ease-in-out infinite}
@keyframes rq-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.rq-welcome h2{font-size:1.5rem;font-weight:800;letter-spacing:-.5px;margin-bottom:8px;line-height:1.2}
.rq-welcome p{font-size:.88rem;color:#555;line-height:1.6;max-width:400px;margin:0 auto 20px}
.rq-w-tags{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.rq-w-tag{padding:6px 14px;border-radius:10px;font-size:.7rem;font-weight:600;display:flex;align-items:center;gap:4px}
.rq-w-tag--time{background:rgba(230,57,70,.06);color:#E63946}
.rq-w-tag--q{background:rgba(216,242,106,.12);color:#5A7A00}
.rq-w-tag--free{background:rgba(0,0,0,.03);color:#999}
.rq-w-levels{display:flex;gap:6px;justify-content:center;margin-bottom:6px;flex-wrap:wrap}
.rq-w-lv{padding:4px 10px;border-radius:8px;font-size:.6rem;font-weight:700;letter-spacing:.3px}
.rq-w-lv--1{background:rgba(230,57,70,.08);color:#E63946}
.rq-w-lv--2{background:rgba(240,140,60,.08);color:#D4880A}
.rq-w-lv--3{background:rgba(216,242,106,.12);color:#5A7A00}
.rq-w-note{font-size:.7rem;color:#999;margin-bottom:20px}

.rq-label{font-size:.58rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#E63946;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.rq-label-dot{width:5px;height:5px;border-radius:50%;background:#E63946}
.rq-num{font-family:var(--font-gluten,'Gluten',cursive);font-size:2.5rem;color:rgba(0,0,0,.06);line-height:1;margin-bottom:4px}
.rq-text{font-size:1.08rem;font-weight:700;letter-spacing:-.2px;margin-bottom:18px;line-height:1.4;color:#1A1A1A}
.rq-text code{font-family:inherit;background:rgba(230,57,70,.06);color:#E63946;padding:1px 6px;border-radius:4px;font-weight:800}

.rq-answers{display:flex;flex-direction:column;gap:7px}
.rq-ans{width:100%;padding:14px 18px;background:#FAFAF8;border:2px solid transparent;border-radius:14px;font-family:inherit;font-size:.88rem;font-weight:600;color:#1A1A1A;cursor:pointer;text-align:left;display:flex;align-items:center;gap:12px;transition:all .2s cubic-bezier(.16,1,.3,1);position:relative}
.rq-ans:hover:not(:disabled){border-color:rgba(230,57,70,.15);background:#fff;transform:translateX(3px)}
.rq-ans:active:not(:disabled){transform:scale(.98)}
.rq-ans:disabled{cursor:default}
.rq-ans:focus-visible{outline:2px solid #E63946;outline-offset:2px}
.rq-ans-key{width:30px;height:30px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:#999;background:#fff;border:1px solid rgba(0,0,0,.06);transition:all .2s}
.rq-ans:hover:not(:disabled) .rq-ans-key{background:#E63946;color:#fff;border-color:#E63946;box-shadow:0 2px 0 rgba(180,30,45,.3)}
.rq-ans-text{flex:1}
.rq-ans-hint{font-size:.65rem;font-weight:700;color:#5A7A00}
.rq-ans-correct{border-color:#D8F26A;background:rgba(216,242,106,.08)}
.rq-ans-correct .rq-ans-key{background:#D8F26A;color:#1E1E1E;border-color:#D8F26A;box-shadow:0 2px 0 rgba(140,180,40,.3)}
.rq-ans-wrong{border-color:#E63946;background:rgba(230,57,70,.04)}
.rq-ans-wrong .rq-ans-key{background:#E63946;color:#fff;border-color:#E63946}
.rq-xp-pop{font-family:var(--font-gluten,'Gluten',cursive);font-size:1rem;color:#5A7A00;animation:rq-xp-fly .8s ease forwards;margin-left:auto}
.rq-xp-pop--mini{color:#E63946;font-size:.82rem}
@keyframes rq-xp-fly{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-20px)}}

.rq-levelup{text-align:center;padding:20px 0}
.rq-lu-badge{width:72px;height:72px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;animation:rq-lu-pop .5s cubic-bezier(.16,1,.3,1) both}
@keyframes rq-lu-pop{from{transform:scale(0) rotate(-20deg)}to{transform:scale(1) rotate(0)}}
.rq-lu-badge--up{background:#D8F26A;box-shadow:0 4px 0 rgba(140,180,40,.4),0 0 30px rgba(216,242,106,.15)}
.rq-lu-badge--same{background:#E63946;box-shadow:0 4px 0 rgba(180,30,45,.35),0 0 30px rgba(230,57,70,.1)}
.rq-levelup h3{font-size:1.2rem;font-weight:800;margin-bottom:6px}
.rq-levelup p{font-size:.82rem;color:#555;line-height:1.5;max-width:380px;margin:0 auto}

.rq-result{text-align:center;position:relative}
.rq-reveal{width:110px;height:110px;border-radius:50%;margin:0 auto 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:rq-r-pop .6s cubic-bezier(.16,1,.3,1) .2s both}
@keyframes rq-r-pop{from{opacity:0;transform:scale(.4) rotate(-15deg)}to{opacity:1;transform:scale(1) rotate(0)}}
.rq-reveal--raw{background:#E63946;box-shadow:0 6px 0 rgba(180,30,45,.35),0 0 0 10px rgba(230,57,70,.1),0 0 40px rgba(230,57,70,.12)}
.rq-reveal--rare{background:linear-gradient(135deg,#EF505E,#E63946);box-shadow:0 6px 0 rgba(200,50,50,.35),0 0 0 10px rgba(230,57,70,.08),0 0 40px rgba(230,57,70,.1)}
.rq-reveal--mediumrare{background:linear-gradient(135deg,#F06A52,#D4A040);box-shadow:0 6px 0 rgba(200,100,50,.3),0 0 0 10px rgba(240,106,82,.08),0 0 40px rgba(240,106,82,.1)}
.rq-reveal--medium{background:linear-gradient(135deg,#D4A040,#B8D050);box-shadow:0 6px 0 rgba(180,180,50,.3),0 0 0 10px rgba(184,208,80,.1),0 0 40px rgba(184,208,80,.08)}
.rq-reveal--mediumwell{background:linear-gradient(135deg,#B8D050,#D8F26A);box-shadow:0 6px 0 rgba(150,200,50,.35),0 0 0 10px rgba(216,242,106,.1),0 0 40px rgba(216,242,106,.1)}
.rq-reveal--welldone{background:#D8F26A;box-shadow:0 6px 0 rgba(140,180,40,.4),0 0 0 10px rgba(216,242,106,.15),0 0 40px rgba(216,242,106,.15)}
.rq-reveal-emoji{font-size:1.5rem}
.rq-reveal-name{font-family:var(--font-gluten,'Gluten',cursive);font-size:1.2rem;color:#fff;line-height:1}
.rq-reveal-sub{font-size:.45rem;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.rq-reveal--mediumwell .rq-reveal-name,.rq-reveal--welldone .rq-reveal-name{color:#1E1E1E}
.rq-reveal--mediumwell .rq-reveal-sub,.rq-reveal--welldone .rq-reveal-sub{color:rgba(0,0,0,.35)}
.rq-result h2{font-size:1.3rem;font-weight:800;letter-spacing:-.5px;margin-bottom:6px}
.rq-desc{font-size:.85rem;color:#555;line-height:1.6;max-width:400px;margin:0 auto 18px}
.rq-stats{display:flex;gap:8px;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
.rq-stat{padding:10px 16px;border-radius:14px;background:#FAFAF8;text-align:center;min-width:80px}
.rq-stat-val{font-family:var(--font-gluten,'Gluten',cursive);font-size:1.2rem;line-height:1}
.rq-stat-val--red{color:#E63946}
.rq-stat-val--lime{color:#5A7A00}
.rq-stat-val--dark{color:#1E1E1E}
.rq-stat-lbl{font-size:.55rem;color:#999;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.rq-bar-wrap{max-width:320px;margin:0 auto 20px}
.rq-bar-top{display:flex;justify-content:space-between;margin-bottom:5px}
.rq-bar-lbl{font-size:.62rem;color:#999;font-weight:600}
.rq-bar-val{font-size:.62rem;color:#E63946;font-weight:700}
.rq-r-bar{height:7px;background:rgba(0,0,0,.06);border-radius:100px;overflow:hidden}
.rq-r-bar-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,#E63946,#D8F26A);animation:rq-bar-grow 1s .5s cubic-bezier(.16,1,.3,1) both}
@keyframes rq-bar-grow{from{width:0}to{width:var(--rq-w,100%)}}
.rq-confetti-wrap{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:10}
.rq-confetti{position:absolute;width:8px;height:8px;border-radius:2px;animation:rq-confetti-fall 1.5s ease-out forwards}
@keyframes rq-confetti-fall{0%{opacity:1;transform:translateY(0) rotate(0) scale(1)}100%{opacity:0;transform:translateY(300px) rotate(720deg) scale(.3)}}

.rq-footer{padding:0 24px 20px}
.rq-btn{width:100%;padding:15px;border:none;border-radius:14px;font-family:inherit;font-size:.92rem;font-weight:700;cursor:pointer;transition:all .3s;display:flex;align-items:center;justify-content:center;gap:8px}
.rq-btn:focus-visible{outline:2px solid #1E1E1E;outline-offset:2px}
.rq-btn--red{background:#E63946;color:#fff;box-shadow:0 4px 0 rgba(180,30,45,.4)}
.rq-btn--red:hover{transform:translateY(-2px);box-shadow:0 6px 0 rgba(180,30,45,.4),0 12px 30px rgba(230,57,70,.12)}
.rq-btn--lime{background:#D8F26A;color:#1E1E1E;box-shadow:0 4px 0 rgba(140,180,40,.45)}
.rq-btn--lime:hover{transform:translateY(-2px);box-shadow:0 6px 0 rgba(140,180,40,.45),0 12px 30px rgba(216,242,106,.12)}
.rq-btn--ghost{background:#FAFAF8;color:#1A1A1A;border:1px solid rgba(0,0,0,.06);box-shadow:0 3px 0 rgba(0,0,0,.06);margin-top:7px}
.rq-btn--ghost:hover{border-color:#E63946;color:#E63946}
.rq-btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}

@media(max-width:600px){
  .rq-overlay{padding:0;align-items:flex-end}
  .rq-card{max-width:100%;border-radius:24px 24px 0 0;max-height:96vh}
  .rq-header{padding:16px 18px 0}
  .rq-progress{padding:10px 18px 0}
  .rq-body{padding:18px}
  .rq-footer{padding:0 18px 16px}
  .rq-text{font-size:.98rem}
  .rq-ans{padding:12px 14px;font-size:.82rem}
  .rq-ans-key{width:26px;height:26px;font-size:.65rem}
  .rq-welcome h2{font-size:1.25rem}
  .rq-reveal{width:90px;height:90px}
  .rq-stats{gap:6px}
  .rq-stat{padding:8px 12px;min-width:70px}
}

@media(prefers-reduced-motion: reduce){
  .rq-slide,.rq-w-icon-float,.rq-lu-badge,.rq-reveal,.rq-confetti,.rq-xp-pop,.rq-r-bar-fill{animation:none!important}
}
`
