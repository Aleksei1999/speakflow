"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------
   RAW ENGLISH — «Прожарка» quiz popup (Figma 2173:2630 / 2642 / 2083)
   Flow: question → tap answer (correct=lime, wrong=red) → next → result.
   ⚠️ QUESTIONS and LEVELS below are PLACEHOLDERS — replace with the
   real 12 questions and the real score→level scheme.
   ------------------------------------------------------------------ */

type Question = { q: string; options: string[]; correct: number };

const QUESTIONS: Question[] = [
  { q: "She ___ to the gym every day.", options: ["gets", "goes", "has", "does"], correct: 1 },
  { q: "I ___ coffee in the morning.", options: ["drinks", "drinking", "drink", "drank"], correct: 2 },
  { q: "They ___ football on Sundays.", options: ["plays", "play", "playing", "played"], correct: 1 },
  { q: "There ___ a book on the table.", options: ["are", "is", "be", "am"], correct: 1 },
  { q: "He ___ TV right now.", options: ["watch", "watches", "is watching", "watched"], correct: 2 },
  { q: "We ___ to London last year.", options: ["go", "went", "gone", "going"], correct: 1 },
  { q: "This is ___ interesting film.", options: ["a", "an", "the", "—"], correct: 1 },
  { q: "I have ___ apples than you.", options: ["much", "many", "more", "most"], correct: 2 },
  { q: "If it rains, we ___ at home.", options: ["stay", "will stay", "stayed", "staying"], correct: 1 },
  { q: "She has ___ finished her work.", options: ["yet", "already", "ever", "since"], correct: 1 },
  { q: "The letter ___ by Anna yesterday.", options: ["wrote", "was written", "written", "writes"], correct: 1 },
  { q: "I wish I ___ more free time.", options: ["have", "had", "will have", "having"], correct: 1 },
];

/* score (0..12) → level logo (files in /landing/raw2/levels/*.svg) */
const LEVELS = [
  { min: 0, max: 2, logo: "raw" },
  { min: 3, max: 4, logo: "rare" },
  { min: 5, max: 6, logo: "medium-rare" },
  { min: 7, max: 8, logo: "medium" },
  { min: 9, max: 10, logo: "medium-well" },
  { min: 11, max: 12, logo: "well-done" },
];

function levelFor(score: number) {
  return LEVELS.find((l) => score >= l.min && score <= l.max) ?? LEVELS[LEVELS.length - 1];
}

export default function RoastQuiz({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) { setIdx(0); setScore(0); setPicked(null); setDone(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const q = QUESTIONS[idx];

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const nextScore = i === q.correct ? score + 1 : score;
    setScore(nextScore);
    setTimeout(() => {
      if (idx + 1 >= QUESTIONS.length) setDone(true);
      else { setIdx((v) => v + 1); setPicked(null); }
    }, 950);
  }

  const level = done ? levelFor(score) : null;

  return (
    <div className="raw2-modal-overlay" onClick={onClose}>
      <div className={`raw2-quiz-pop ${done ? "result" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="raw2-quiz-close" onClick={onClose} aria-label="Закрыть">×</button>

        {done && level ? (
          <div className="raw2-quiz-result">
            <p className="rq-top">Ваш результат прожарки</p>
            <img src={`/landing/raw2/levels/${level.logo}.svg`} className="rq-logo" alt={level.logo} />
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
