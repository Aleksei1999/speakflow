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
