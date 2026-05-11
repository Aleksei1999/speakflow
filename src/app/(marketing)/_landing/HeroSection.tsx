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

      {/* Декоративный «дым» из английских слов на фоне. Заполняет
          пустые поля слева и справа от фото. aria-hidden — это чистая
          типографика, не должна попадать в screen reader. */}
      <div className={styles.floatingWords} aria-hidden="true">
        <span className={`${styles.fw} ${styles.fwSans} ${styles.fwWhite} ${styles.fwHuge}`} style={{ top: "6%",  left: "-2%",   opacity: 0.05, transform: "rotate(-6deg)" }}>speak</span>
        <span className={`${styles.fw} ${styles.fwCursive} ${styles.fwRed}  ${styles.fwLg}`}   style={{ top: "18%", left: "12%",   opacity: 0.32, transform: "rotate(-8deg)" }}>fluent</span>
        <span className={`${styles.fw} ${styles.fwSans} ${styles.fwRed}    ${styles.fwMd}`}   style={{ top: "32%", left: "4%",    opacity: 0.16, transform: "rotate(4deg)" }}>practice</span>
        <span className={`${styles.fw} ${styles.fwCursive} ${styles.fwWhite} ${styles.fwSm}`}  style={{ top: "44%", left: "16%",   opacity: 0.42, transform: "rotate(-3deg)" }}>level up</span>
        <span className={`${styles.fw} ${styles.fwSans} ${styles.fwWhite} ${styles.fwXl}`}    style={{ top: "60%", left: "1%",    opacity: 0.07, transform: "rotate(-9deg)" }}>vocabulary</span>
        <span className={`${styles.fw} ${styles.fwSans} ${styles.fwRed}    ${styles.fwSm}`}   style={{ top: "74%", left: "13%",   opacity: 0.55, transform: "rotate(2deg)" }}>streak</span>
        <span className={`${styles.fw} ${styles.fwCursive} ${styles.fwRed}  ${styles.fwMd}`}  style={{ top: "84%", left: "5%",    opacity: 0.22, transform: "rotate(-4deg)" }}>well done</span>

        <span className={`${styles.fw} ${styles.fwSans} ${styles.fwWhite} ${styles.fwHuge}`} style={{ top: "8%",  right: "-1%",  opacity: 0.06, transform: "rotate(6deg)" }}>grammar</span>
        <span className={`${styles.fw} ${styles.fwCursive} ${styles.fwRed}  ${styles.fwLg}`} style={{ top: "22%", right: "10%",  opacity: 0.36, transform: "rotate(7deg)" }}>raw</span>
        <span className={`${styles.fw} ${styles.fwSans} ${styles.fwRed}    ${styles.fwMd}`}  style={{ top: "36%", right: "3%",   opacity: 0.18, transform: "rotate(-5deg)" }}>native</span>
        <span className={`${styles.fw} ${styles.fwCursive} ${styles.fwWhite} ${styles.fwSm}`} style={{ top: "48%", right: "16%",  opacity: 0.5,  transform: "rotate(3deg)" }}>debate</span>
        <span className={`${styles.fw} ${styles.fwSans} ${styles.fwWhite} ${styles.fwXl}`}   style={{ top: "62%", right: "1%",   opacity: 0.08, transform: "rotate(8deg)" }}>achievement</span>
        <span className={`${styles.fw} ${styles.fwSans} ${styles.fwRed}    ${styles.fwSm}`}  style={{ top: "76%", right: "12%",  opacity: 0.45, transform: "rotate(-2deg)" }}>XP +50</span>
        <span className={`${styles.fw} ${styles.fwCursive} ${styles.fwRed}  ${styles.fwMd}`} style={{ top: "86%", right: "5%",   opacity: 0.24, transform: "rotate(5deg)" }}>english</span>
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
