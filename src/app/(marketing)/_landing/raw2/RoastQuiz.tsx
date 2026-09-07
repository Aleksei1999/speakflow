"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------
   RAW ENGLISH — «Прожарка» quiz popup (Figma 2173:2630 / 2642 / 2083)
   36 question variants in 12 groups (3 each): A1 (гр.1–4), A2 (5–8), B1 (9–12).
   Each play: 12 questions — one RANDOM variant per group. 3 lives, 2-min timer.
   ------------------------------------------------------------------ */

type Variant = { q: string; options: string[]; correct: number };
type Question = Variant & { tier: 0 | 1 | 2 };

// 12 groups × 3 variants (order: group 1 → 12, i.e. A1 → B1)
const GROUPS: Variant[][] = [
  // ---- A1 ----
  [
    { q: "She ___ to the gym every day.", options: ["gets", "goes", "has", "does"], correct: 1 },
    { q: "British people ___ tea with milk.", options: ["to drink", "drink", "drinks", "are drink"], correct: 1 },
    { q: "___ you like Chinese food?", options: ["Do", "Does", "Are", "Is"], correct: 0 },
  ],
  [
    { q: "They didn't ___ the tickets.", options: ["booking", "booked", "to book", "book"], correct: 3 },
    { q: "This is our new teacher. ___ name is Mark.", options: ["His", "Her", "Its", "He"], correct: 0 },
    { q: "Tonight's dinner is ___ than last night's.", options: ["more good", "gooder", "better", "more better"], correct: 2 },
  ],
  [
    { q: "Can you look ___ my dog this weekend?", options: ["with", "away", "up", "after"], correct: 3 },
    { q: "I haven't ___ this photo before.", options: ["see", "saw", "to see", "seen"], correct: 3 },
    { q: "He ___ playing the piano.", options: ["are", "does", "is", "has"], correct: 2 },
  ],
  [
    { q: "I ___ do my homework last night.", options: ["not could", "didn't can", "couldn't", "can't"], correct: 2 },
    { q: "I ___ my new job last week.", options: ["have begun", "began", "am begin", "begin"], correct: 1 },
    { q: "Can I pay ___ credit card?", options: ["by", "in", "on", "with"], correct: 0 },
  ],
  // ---- A2 ----
  [
    { q: "We ___ take a map.", options: ["should", "should to", "might to", "might"], correct: 0 },
    { q: "I don't get ___ very well with my brother.", options: ["by", "from", "on", "to"], correct: 2 },
    { q: "I haven't tidied my office ___.", options: ["just", "already", "yet", "since"], correct: 2 },
  ],
  [
    { q: "It ___ when they went out.", options: ["rained", "was raining", "is raining", "was to rain"], correct: 1 },
    { q: "Richard isn't very good ___.", options: ["to dance", "at dancing", "dancing", "dance"], correct: 1 },
    { q: "Your papers are on the floor. Why don't you ___?", options: ["pick them up", "pick up them", "pick up to them", "pick them"], correct: 0 },
  ],
  [
    { q: "When I got to work I remembered that ___ my mobile at home.", options: ["I'd leave", "I was leaving", "I'd left", "I left"], correct: 2 },
    { q: "My father ___ be a builder.", options: ["used to", "was", "use to", "did use to"], correct: 0 },
    { q: "___ I worked hard, I didn't pass the test.", options: ["Although", "So", "Because", "But"], correct: 0 },
  ],
  [
    { q: "___ my best friend since 1999.", options: ["I've known", "I knew", "I'm knowing", "I know"], correct: 0 },
    { q: "I'm sure Canada isn't as big ___ Russia.", options: ["as", "than", "to", "like"], correct: 0 },
    { q: "It's important ___ too much alcohol.", options: ["not to drinking", "not to drink", "not drink", "not drinks"], correct: 1 },
  ],
  // ---- B1 ----
  [
    { q: "If we had the money, we ___ get a taxi.", options: ["will can", "can", "would can", "could"], correct: 3 },
    { q: "Would you marry him if he ___ you?", options: ["would ask", "asks", "did ask", "asked"], correct: 3 },
    { q: "___ get in through the window.", options: ["managed to", "could to", "was able", "managed"], correct: 0 },
  ],
  [
    { q: "I'm tired. I ___ all day.", options: ["study", "'ve been studying", "'m studying", "was studying"], correct: 1 },
    { q: "We ___ together since last year.", options: ["live", "are living", "lived", "'ve been living"], correct: 3 },
    { q: "That's the boy ___ parents I met.", options: ["which", "whom", "who", "whose"], correct: 3 },
  ],
  [
    { q: "He didn't buy that computer, ___?", options: ["is it", "didn't he", "did he", "isn't it"], correct: 2 },
    { q: "I never ___ eat so much.", options: ["used to", "didn't used to", "use to", "didn't use to"], correct: 0 },
    { q: "I studied chemistry at ___ university.", options: ["the", "—", "a", "an"], correct: 1 },
  ],
  [
    { q: "Can you tell me where ___?", options: ["the post office is", "is the post office", "the post office", "post office"], correct: 0 },
    { q: "I'll take some water ___ I get thirsty.", options: ["so", "although", "in case", "unless"], correct: 2 },
    { q: "___ Kate nor I want to go to London.", options: ["Neither", "Both", "Either", "Not"], correct: 0 },
  ],
];

const LEVEL_LOGOS = ["raw", "rare", "medium-rare", "medium", "medium-well", "well-done"];
// Формат ровно как в БД (level_tests.level) — чтобы админка через
// fromRoastLevel() смогла показать CEFR-тег на заявке.
const ROAST_DB_NAMES = ["Raw", "Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"];
const LIVES = 3;
const TIME = 120; // 2:00

function buildQuiz(): Question[] {
  return GROUPS.map((variants, g) => {
    const v = variants[Math.floor(Math.random() * variants.length)];
    return { ...v, tier: (g < 4 ? 0 : g < 8 ? 1 : 2) as 0 | 1 | 2 };
  });
}

/* Tier-based (по-тирно) scoring — 4 questions per tier (a1/a2/b1 = 0..4).
   Пороги (легко поменять):
     A1 < 2  → Raw    | A1 = 2 → Rare | A1 ≥ 3 → Medium Rare
     + A2 = 2 → Medium | + A2 ≥ 3 → Medium Well | + B1 ≥ 3 → Well Done   */
function levelIndex(a1: number, a2: number, b1: number) {
  let lvl = 0;
  if (a1 >= 2) lvl = 1;
  if (a1 >= 3) lvl = 2;
  if (lvl >= 2 && a2 >= 2) lvl = 3;
  if (lvl >= 3 && a2 >= 3) lvl = 4;
  if (lvl >= 4 && b1 >= 3) lvl = 5;
  return lvl;
}

const Heart = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 39 33" aria-hidden fill={on ? "#CC3A3A" : "none"} stroke="#CC3A3A" strokeWidth="5" strokeLinejoin="round">
    <path d="M19.5092 5.01562C22.3226 2.67627 26.3272 1.81831 29.7406 3.09082C33.9595 4.66 36.4763 8.24249 36.4994 12.7236L36.4965 13.0547C36.4114 16.4449 34.699 19.059 32.9633 21.1025L32.9642 21.1035C29.9833 24.6576 26.3047 27.3392 22.5355 29.6182L22.5365 29.6191C20.8571 30.6353 18.6158 30.9172 16.6469 29.7061V29.7051C12.2624 27.0612 7.85993 23.9147 4.71619 19.3311L4.41541 18.8818C1.82465 14.9219 1.79162 9.81952 4.74646 6.24609C8.52659 1.66017 15.0547 1.33677 19.5092 5.01562Z" />
  </svg>
);

type LogItem = { text: string; options: string[]; chosen: number; correct: number; lvl: 1 | 2 | 3 };

export default function RoastQuiz({ onClose }: { onClose: () => void }) {
  const [qs] = useState<Question[]>(() => buildQuiz());
  const [idx, setIdx] = useState(0);
  const [byTier, setByTier] = useState<[number, number, number]>([0, 0, 0]);
  const [lives, setLives] = useState(LIVES);
  const [timeLeft, setTimeLeft] = useState(TIME);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [log, setLog] = useState<LogItem[]>([]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // countdown
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [done]);
  useEffect(() => { if (!done && timeLeft <= 0) setDone(true); }, [timeLeft, done]);

  // Persist result to sessionStorage so форма заявки (LandingRaw2.onSubmit)
  // сможет догнать его до /api/landing/lead и создать level_tests с email.
  // log[] нужен админке — она рендерит «Вопрос N / варианты / выбранное+правильное».
  useEffect(() => {
    if (!done) return;
    try {
      const idx = levelIndex(byTier[0], byTier[1], byTier[2]);
      sessionStorage.setItem(
        "raw2_roast_quiz",
        JSON.stringify({
          level: ROAST_DB_NAMES[idx],
          tierScores: byTier,
          log,
          ts: Date.now(),
        }),
      );
    } catch {}
  }, [done, byTier, log]);

  if (qs.length === 0) return null;

  const q = qs[idx];

  function pick(i: number) {
    if (picked !== null || done) return;
    setPicked(i);
    const correct = i === q.correct;
    const livesAfter = correct ? lives : lives - 1;
    setLog((prev) => [...prev, { text: q.q, options: q.options, chosen: i, correct: q.correct, lvl: (q.tier + 1) as 1 | 2 | 3 }]);
    if (correct) {
      setByTier((prev) => {
        const next: [number, number, number] = [...prev];
        next[q.tier] += 1;
        return next;
      });
    } else {
      setLives(livesAfter);
    }
    setTimeout(() => {
      if (livesAfter <= 0 || idx + 1 >= qs.length) setDone(true);
      else { setIdx((v) => v + 1); setPicked(null); }
    }, 950);
  }

  const logo = done ? LEVEL_LOGOS[levelIndex(byTier[0], byTier[1], byTier[2])] : null;
  const mm = Math.floor(timeLeft / 60);
  const ss = String(timeLeft % 60).padStart(2, "0");

  return (
    <div className="raw2-modal-overlay" onClick={onClose}>
      <div className={`raw2-quiz-pop ${done ? "result" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="raw2-quiz-close" onClick={onClose} aria-label="Закрыть">×</button>

        {done && logo ? (
          <div className="raw2-quiz-result">
            <p className="rq-top">Ваш результат прожарки</p>
            <img src={`/landing/raw2/levels/${logo}.svg`} className="rq-logo" alt={logo} />
            <p className="rq-bot">Мы уже подбираем<br />вам план обучения!</p>
            <a
              href="#contact"
              className="btn btn-red rq-cta"
              onClick={onClose}
            >
              Выучить английский
            </a>
          </div>
        ) : (
          <>
            <div className="rq-bar">
              <div className="rq-lives">
                {[0, 1, 2].map((i) => <Heart key={i} on={i < lives} />)}
              </div>
            </div>
            <p className="rq-q">{q.q}</p>
            <div className="rq-options">
              {q.options.map((opt, i) => {
                let cls = "rq-opt";
                if (picked !== null) cls += i === q.correct ? " correct" : " wrong";
                return (
                  <button key={i} type="button" className={cls} onClick={() => pick(i)} disabled={picked !== null}>
                    {opt}
                  </button>
                );
              })}
            </div>
            <p className="rq-counter">{idx + 1}/{qs.length}</p>
          </>
        )}
      </div>
    </div>
  );
}
