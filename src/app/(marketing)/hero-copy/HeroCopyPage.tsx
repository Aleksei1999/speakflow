"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { RawLogo } from "@/components/ui/raw-logo";
import styles from "./hero-copy.module.css";

const navItems = [
  { label: "Платформа", href: "#platform" },
  { label: "Геймификация", href: "#gamification" },
  { label: "Форматы", href: "#formats" },
  { label: "Membership", href: "#membership" },
  { label: "Цены", href: "#pricing" },
];

const avatarLetters = ["A", "M", "K", "V", "R"];

export function HeroCopyPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  return (
    <main className={styles.page} data-theme={theme}>
      <header className={styles.navbar}>
        <Link href="/" className={styles.logoLink} aria-label="Raw English">
          <RawLogo size={38} priority className={styles.logo} />
        </Link>

        <nav className={styles.navLinks} aria-label="Hero copy navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.navActions}>
          <button
            type="button"
            className={styles.themeToggle}
            aria-label="Переключить тему"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <span>{theme === "dark" ? "🌙" : "☀️"}</span>
          </button>
          <Link href="/teach" className={styles.teacherButton}>
            Для преподавателя
          </Link>
          <Link href="/login" className={styles.loginButton}>
            Войти
          </Link>
        </div>
      </header>

      <section className={styles.hero} aria-label="RAW English hero concept">
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
              alt="Преподаватель RAW English за столом с учебными материалами"
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
            <a href="#platform" className={styles.secondaryCta}>
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
    </main>
  );
}
