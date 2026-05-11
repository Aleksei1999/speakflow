"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import styles from "../hero-copy/hero-copy.module.css"

// Извлечён hero-блок из /hero-copy/HeroCopyPage.tsx, чтобы переиспользовать
// его на главной (LandingClient). Тема (light/dark) теперь синхронизируется
// с глобальным <html data-theme>, который у нас выставляется landing.js
// темо-тогглом и dashboard-shell'ом.

const avatarLetters = ["A", "M", "K", "V", "R"]

// Конфиг для фоновых слов. size = Sm | Md | Lg | Xl | Huge,
// font = sans | cursive, color = red | white.
// delay — кгда начинать typing-анимацию (каскад слева→направо).
type FloatingWord = {
  text: string
  top: string
  left?: string
  right?: string
  size: "Sm" | "Md" | "Lg" | "Xl" | "Huge"
  font: "sans" | "cursive"
  color: "red" | "white"
  opacity: number
  rotate: number
  delay: number
}

const floatingWords: FloatingWord[] = [
  // LEFT — большие
  { text: "speak",       top: "5%",  left: "-1%",  size: "Huge", font: "sans",    color: "white", opacity: 0.05, rotate: -6, delay: 0.2 },
  { text: "fluent",      top: "16%", left: "12%",  size: "Lg",   font: "cursive", color: "red",   opacity: 0.32, rotate: -8, delay: 0.5 },
  { text: "vocabulary",  top: "58%", left: "0%",   size: "Xl",   font: "sans",    color: "white", opacity: 0.07, rotate: -9, delay: 1.3 },
  // LEFT — мелкие
  { text: "practice",    top: "30%", left: "3%",   size: "Sm",   font: "sans",    color: "red",   opacity: 0.5,  rotate: 4,  delay: 0.7 },
  { text: "level up",    top: "44%", left: "16%",  size: "Sm",   font: "cursive", color: "white", opacity: 0.55, rotate: -3, delay: 0.9 },
  { text: "streak",      top: "72%", left: "13%",  size: "Sm",   font: "sans",    color: "red",   opacity: 0.6,  rotate: 2,  delay: 1.5 },
  { text: "well done",   top: "84%", left: "4%",   size: "Md",   font: "cursive", color: "red",   opacity: 0.4,  rotate: -4, delay: 1.7 },
  { text: "rare",        top: "11%", left: "5%",   size: "Sm",   font: "cursive", color: "white", opacity: 0.4,  rotate: 6,  delay: 0.35 },
  { text: "raw",         top: "24%", left: "2%",   size: "Sm",   font: "sans",    color: "white", opacity: 0.35, rotate: -2, delay: 0.6 },
  { text: "club",        top: "38%", left: "11%",  size: "Sm",   font: "sans",    color: "white", opacity: 0.4,  rotate: 5,  delay: 0.85 },
  { text: "medium",      top: "52%", left: "7%",   size: "Sm",   font: "cursive", color: "red",   opacity: 0.48, rotate: -7, delay: 1.05 },
  { text: "wine night",  top: "66%", left: "16%",  size: "Sm",   font: "cursive", color: "white", opacity: 0.42, rotate: 3,  delay: 1.25 },
  { text: "fire",        top: "78%", left: "0%",   size: "Sm",   font: "sans",    color: "red",   opacity: 0.55, rotate: -5, delay: 1.55 },
  { text: "next level",  top: "91%", left: "14%",  size: "Sm",   font: "cursive", color: "white", opacity: 0.5,  rotate: 4,  delay: 1.85 },

  // RIGHT — большие
  { text: "grammar",     top: "7%",  right: "-1%", size: "Huge", font: "sans",    color: "white", opacity: 0.06, rotate: 6,  delay: 0.25 },
  { text: "achievement", top: "60%", right: "0%",  size: "Xl",   font: "sans",    color: "white", opacity: 0.08, rotate: 8,  delay: 1.4 },
  { text: "english",     top: "85%", right: "4%",  size: "Lg",   font: "cursive", color: "red",   opacity: 0.24, rotate: 5,  delay: 1.75 },
  // RIGHT — мелкие
  { text: "native",      top: "20%", right: "3%",  size: "Sm",   font: "sans",    color: "red",   opacity: 0.5,  rotate: -5, delay: 0.55 },
  { text: "debate",      top: "32%", right: "15%", size: "Sm",   font: "cursive", color: "white", opacity: 0.55, rotate: 3,  delay: 0.75 },
  { text: "XP +50",      top: "46%", right: "11%", size: "Sm",   font: "sans",    color: "red",   opacity: 0.6,  rotate: -2, delay: 0.95 },
  { text: "speaking",    top: "26%", right: "8%",  size: "Sm",   font: "sans",    color: "white", opacity: 0.45, rotate: 7,  delay: 0.65 },
  { text: "C1",          top: "12%", right: "16%", size: "Sm",   font: "cursive", color: "red",   opacity: 0.5,  rotate: -4, delay: 0.4  },
  { text: "feedback",    top: "39%", right: "1%",  size: "Sm",   font: "cursive", color: "red",   opacity: 0.42, rotate: 2,  delay: 0.85 },
  { text: "story",       top: "53%", right: "16%", size: "Sm",   font: "sans",    color: "white", opacity: 0.48, rotate: -6, delay: 1.1  },
  { text: "well done.",  top: "74%", right: "16%", size: "Sm",   font: "cursive", color: "red",   opacity: 0.55, rotate: 4,  delay: 1.45 },
  { text: "challenge",   top: "70%", right: "2%",  size: "Sm",   font: "sans",    color: "red",   opacity: 0.4,  rotate: -3, delay: 1.6  },
  { text: "talk",        top: "92%", right: "13%", size: "Sm",   font: "sans",    color: "white", opacity: 0.5,  rotate: 6,  delay: 1.95 },
]

export default function HeroSection() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    if (typeof document === "undefined") return
    const sync = () => {
      const t = document.documentElement.getAttribute("data-theme")
      setTheme(t === "light" ? "light" : "dark")
    }
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => mo.disconnect()
  }, [])

  return (
    <section
      className={styles.hero}
      data-theme={theme}
      aria-label="RAW English hero"
      data-level="1"
      data-xp="5"
    >
      {/* data-theme и --hero-* живут на .page; если мы embed'им только
          .hero на главной, оборачиваем в page-классы через явный wrapper. */}
      <div className={styles.glow} />

      {/* Декоративный «дым» из английских слов на фоне с typing-
          эффектом (clip-path-from-right). Заполняет пустые поля
          слева и справа от фото. aria-hidden — это чистая типографика. */}
      <div className={styles.floatingWords} aria-hidden="true">
        {floatingWords.map((w, i) => (
          <span
            key={i}
            className={[
              styles.fw,
              w.font === "cursive" ? styles.fwCursive : styles.fwSans,
              w.color === "red" ? styles.fwRed : styles.fwWhite,
              styles[`fw${w.size}`],
            ].join(" ")}
            style={{
              top: w.top,
              left: w.left,
              right: w.right,
              opacity: w.opacity,
              // CSS-vars: длительность печати пропорциональна длине
              // слова, плюс собственный delay каскада.
              ["--rot" as any]: `${w.rotate}deg`,
              ["--type-dur" as any]: `${Math.max(0.5, w.text.length * 0.07)}s`,
              ["--type-delay" as any]: `${w.delay}s`,
            }}
          >
            {w.text}
          </span>
        ))}
      </div>

      <div className={styles.heroGrid}>
        <div className={styles.leftPanel}>
          <h1>
            <span>Make it</span>
            <strong>well done.</strong>
          </h1>

          <div className={styles.streakCard}>
            <div className={styles.streakBadge}>★</div>
            <div>
              <b>Streak: 14 days</b>
              <span>Just leveled up!</span>
            </div>
          </div>
        </div>

        <div className={styles.photoStage}>
          <Image
            src="/landing/raw-hero-teacher-reference.png"
            alt="Преподаватель RAW English"
            width={1672}
            height={941}
            priority
            className={styles.heroPhoto}
          />
          <div className={styles.tableShade} />
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.speechBubble}>
            Уроки английского,
            <br />
            коммьюнити, лекции
            <br />и speaking clubs
          </div>

          <h2>
            Прожарь свой
            <br />
            английский от <span className={styles.h2Accent}>raw</span>
            <br />
            до <span className={styles.h2Cursive}>well done.</span>
          </h2>

          <div className={styles.xpCard}>
            <div className={styles.levelDot}>M</div>
            <b>+50 XP за дебаты</b>
            <span>♟</span>
          </div>
        </div>
      </div>

      <div className={styles.ctaDock}>
        <div className={styles.ctaButtons}>
          <Link href="/register" className={styles.primaryCta}>
            <span>🔥</span>
            Начать прохождение
          </Link>
          <a href="#lvl4" className={styles.secondaryCta}>
            Как это работает
          </a>
        </div>

        <div className={styles.socialProof}>
          <div className={styles.avatarStack} aria-hidden="true">
            {avatarLetters.map((letter) => (
              <span key={letter}>{letter}</span>
            ))}
          </div>
          <p>
            <b>500+</b> учеников уже играют
          </p>
        </div>
      </div>
    </section>
  )
}
