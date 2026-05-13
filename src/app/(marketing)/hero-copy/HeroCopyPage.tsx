"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { RawLogo } from "@/components/ui/raw-logo";
import styles from "./hero-copy.module.css";

const navItems = [
  { label: "Английский", href: "#english" },
  { label: "Speaking clubs", href: "#clubs" },
  { label: "Комьюнити", href: "#community" },
  { label: "Для детей", href: "#kids" },
  { label: "Цены", href: "#pricing" },
];

const formatItems = ["Speaking", "Debate club", "Lectures", "Membership"];
const avatarLetters = ["A", "M", "K", "V", "R", "S"];

export function HeroCopyPage() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  return (
    <main className={styles.page} data-theme={theme}>
      <div className={styles.promoBar}>
        <p>
          Speaking challenge стартует 20 мая
          <span>скидка до 40% первым участникам</span>
        </p>
        <a href="#lead">Забрать место</a>
      </div>

      <header className={styles.navbar}>
        <div className={styles.navShell}>
          <Link href="/" className={styles.logoLink} aria-label="Raw English">
            <RawLogo size={42} priority className={styles.logo} />
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
        </div>
      </header>

      <section className={styles.hero} aria-label="RAW English first screen concept">
        <div className={styles.glow} />
        <div className={styles.arrowShape} aria-hidden="true" />

        <div className={styles.heroCanvas}>
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

          <div className={`${styles.statCard} ${styles.statTeachers}`}>
            <b>24/7</b>
            <span>практика в комьюнити</span>
          </div>

          <div className={`${styles.statCard} ${styles.statStudents}`}>
            <b>500+</b>
            <span>учеников уже играют</span>
          </div>

          <div className={`${styles.gameCard} ${styles.streakCard}`}>
            <div className={styles.streakBadge}>★</div>
            <div>
              <b>Streak: 14 days</b>
              <span>Just leveled up!</span>
            </div>
          </div>

          <div className={`${styles.gameCard} ${styles.xpCard}`}>
            <div className={styles.levelDot}>M</div>
            <b>+50 XP за дебаты</b>
            <span>♟</span>
          </div>

          <div className={styles.speechBubble}>
            Уроки, speaking clubs,
            <br />
            лекции и живое комьюнити
          </div>

          <div className={styles.offerPanel}>
            <div className={styles.offerLabel}>RAW English online</div>
            <h1>
              Английский,
              <br />
              который хочется
              <br />
              <span>проходить каждый день</span>
            </h1>

            <p>
              Бесплатно определим уровень и подберём формат: speaking club,
              дебаты, membership или уроки с преподавателем.
            </p>

            <form
              id="lead"
              className={styles.leadForm}
              onSubmit={(event) => event.preventDefault()}
            >
              <input aria-label="Имя" placeholder="Имя" />
              <input aria-label="Телефон или Telegram" placeholder="Телефон или Telegram" />
              <button type="submit">Получить пробный урок</button>
            </form>

            <div className={styles.formMeta}>
              <span>✓ без оплаты</span>
              <span>✓ ответим в Telegram</span>
              <span>✓ уровень за 15 минут</span>
            </div>
          </div>
        </div>

        <div className={styles.bottomRail}>
          <div className={styles.formatStrip}>
            {formatItems.map((item) => (
              <a key={item} href="#formats">
                {item}
              </a>
            ))}
          </div>
          <div className={styles.socialProof}>
            <div className={styles.avatarStack} aria-hidden="true">
              {avatarLetters.map((letter) => (
                <span key={letter}>{letter}</span>
              ))}
            </div>
            <p>
              <b>новые группы</b> каждую неделю
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
