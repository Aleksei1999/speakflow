"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------
   RAW ENGLISH — «Прожарка» quiz popup (Figma 2173:2630 / 2642 / 2083)
   36 questions in order: A1 (0–11), A2 (12–23), B1 (24–35).
   Flow: question → tap answer (correct=lime, wrong=red) → next → result.
   ------------------------------------------------------------------ */

type Question = { q: string; options: string[]; correct: number };

const QUESTIONS: Question[] = [
  // ---------- A1 (группы 1–4) ----------
  { q: "She ___ to the gym every day.", options: ["gets", "goes", "has", "does"], correct: 1 },
  { q: "British people ___ tea with milk.", options: ["to drink", "drink", "drinks", "are drink"], correct: 1 },
  { q: "___ you like Chinese food?", options: ["Do", "Does", "Are", "Is"], correct: 0 },
  { q: "They didn't ___ the tickets.", options: ["booking", "booked", "to book", "book"], correct: 3 },
  { q: "This is our new teacher. ___ name is Mark.", options: ["His", "Her", "Its", "He"], correct: 0 },
  { q: "Tonight's dinner is ___ than last night's.", options: ["more good", "gooder", "better", "more better"], correct: 2 },
  { q: "Can you look ___ my dog this weekend?", options: ["with", "away", "up", "after"], correct: 3 },
  { q: "I haven't ___ this photo before.", options: ["see", "saw", "to see", "seen"], correct: 3 },
  { q: "He ___ playing the piano.", options: ["are", "does", "is", "has"], correct: 2 },
  { q: "I ___ do my homework last night.", options: ["not could", "didn't can", "couldn't", "can't"], correct: 2 },
  { q: "I ___ my new job last week.", options: ["have begun", "began", "am begin", "begin"], correct: 1 },
  { q: "Can I pay ___ credit card?", options: ["by", "in", "on", "with"], correct: 0 },
  // ---------- A2 (группы 5–8) ----------
  { q: "We ___ take a map.", options: ["should", "should to", "might to", "might"], correct: 0 },
  { q: "I don't get ___ very well with my brother.", options: ["by", "from", "on", "to"], correct: 2 },
  { q: "I haven't tidied my office ___.", options: ["just", "already", "yet", "since"], correct: 2 },
  { q: "It ___ when they went out.", options: ["rained", "was raining", "is raining", "was to rain"], correct: 1 },
  { q: "Richard isn't very good ___.", options: ["to dance", "at dancing", "dancing", "dance"], correct: 1 },
  { q: "Your papers are on the floor. Why don't you ___?", options: ["pick them up", "pick up them", "pick up to them", "pick them"], correct: 0 },
  { q: "When I got to work I remembered that ___ my mobile at home.", options: ["I'd leave", "I was leaving", "I'd left", "I left"], correct: 2 },
  { q: "My father ___ be a builder.", options: ["used to", "was", "use to", "did use to"], correct: 0 },
  { q: "___ I worked hard, I didn't pass the test.", options: ["Although", "So", "Because", "But"], correct: 0 },
  { q: "___ my best friend since 1999.", options: ["I've known", "I knew", "I'm knowing", "I know"], correct: 0 },
  { q: "I'm sure Canada isn't as big ___ Russia.", options: ["as", "than", "to", "like"], correct: 0 },
  { q: "It's important ___ too much alcohol.", options: ["not to drinking", "not to drink", "not drink", "not drinks"], correct: 1 },
  // ---------- B1 (группы 9–12) ----------
  { q: "If we had the money, we ___ get a taxi.", options: ["will can", "can", "would can", "could"], correct: 3 },
  { q: "Would you marry him if he ___ you?", options: ["would ask", "asks", "did ask", "asked"], correct: 3 },
  { q: "___ get in through the window.", options: ["managed to", "could to", "was able", "managed"], correct: 0 },
  { q: "I'm tired. I ___ all day.", options: ["study", "'ve been studying", "'m studying", "was studying"], correct: 1 },
  { q: "We ___ together since last year.", options: ["live", "are living", "lived", "'ve been living"], correct: 3 },
  { q: "That's the boy ___ parents I met.", options: ["which", "whom", "who", "whose"], correct: 3 },
  { q: "He didn't buy that computer, ___?", options: ["is it", "didn't he", "did he", "isn't it"], correct: 2 },
  { q: "I never ___ eat so much.", options: ["used to", "didn't used to", "use to", "didn't use to"], correct: 0 },
  { q: "I studied chemistry at ___ university.", options: ["the", "—", "a", "an"], correct: 1 },
  { q: "Can you tell me where ___?", options: ["the post office is", "is the post office", "the post office", "post office"], correct: 0 },
  { q: "I'll take some water ___ I get thirsty.", options: ["so", "although", "in case", "unless"], correct: 2 },
  { q: "___ Kate nor I want to go to London.", options: ["Neither", "Both", "Either", "Not"], correct: 0 },
];

const LEVEL_LOGOS = ["raw", "rare", "medium-rare", "medium", "medium-well", "well-done"];

/* Tier-based (по-тирно) scoring. a1/a2/b1 = correct out of 12 in each tier.
   Пороги (легко поменять):
     A1 < 5            → Raw
     A1 5–8            → Rare
     A1 ≥ 9            → Medium Rare
     + A2 5–8          → Medium
     + A2 ≥ 9          → Medium Well
     + B1 ≥ 7          → Well Done                                         */
function levelIndex(a1: number, a2: number, b1: number) {
  let lvl = 0;
  if (a1 >= 5) lvl = 1;
  if (a1 >= 9) lvl = 2;
  if (lvl >= 2 && a2 >= 5) lvl = 3;
  if (lvl >= 3 && a2 >= 9) lvl = 4;
  if (lvl >= 4 && b1 >= 7) lvl = 5;
  return lvl;
}

export default function RoastQuiz({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [byTier, setByTier] = useState<[number, number, number]>([0, 0, 0]);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) { setIdx(0); setByTier([0, 0, 0]); setPicked(null); setDone(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const q = QUESTIONS[idx];
  const tier = idx < 12 ? 0 : idx < 24 ? 1 : 2;

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.correct) {
      setByTier((prev) => {
        const next: [number, number, number] = [...prev];
        next[tier] += 1;
        return next;
      });
    }
    setTimeout(() => {
      if (idx + 1 >= QUESTIONS.length) setDone(true);
      else { setIdx((v) => v + 1); setPicked(null); }
    }, 950);
  }

  const logo = done ? LEVEL_LOGOS[levelIndex(byTier[0], byTier[1], byTier[2])] : null;

  return (
    <div className="raw2-modal-overlay" onClick={onClose}>
      <div className={`raw2-quiz-pop ${done ? "result" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="raw2-quiz-close" onClick={onClose} aria-label="Закрыть">×</button>

        {done && logo ? (
          <div className="raw2-quiz-result">
            <p className="rq-top">Ваш результат прожарки</p>
            <img src={`/landing/raw2/levels/${logo}.svg`} className="rq-logo" alt={logo} />
            <p className="rq-bot">Мы уже подбираем<br />вам план обучения!</p>
          </div>
        ) : (
          <>
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
            <p className="rq-counter">{idx + 1}/{QUESTIONS.length}</p>
          </>
        )}
      </div>
    </div>
  );
}
