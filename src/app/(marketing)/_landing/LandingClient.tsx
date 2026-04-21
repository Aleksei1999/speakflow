// @ts-nocheck
"use client"

import { useEffect, createElement } from "react"
import Script from "next/script"
import Link from "next/link"
import "./landing.css"
import "./icons3d.css"

function I3(props: {
  kind: string
  size?: string
  stand?: boolean | ""
  float?: boolean | ""
  tilt?: boolean | ""
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}) {
  const { kind, size, stand, float, tilt, style, className, children } = props
  const attrs: Record<string, unknown> = { kind, style, className, children }
  if (size) attrs["data-size"] = size
  if (stand || stand === "") attrs["data-stand"] = ""
  if (float || float === "") attrs["data-float"] = ""
  if (tilt || tilt === "") attrs["data-tilt"] = ""
  return createElement("i3", attrs)
}

export default function LandingClient() {
  useEffect(() => {
    const html = document.documentElement
    const prevTheme = html.dataset.theme
    html.dataset.theme = "dark"
    html.dataset.landing = "true"
    return () => {
      if (prevTheme) html.dataset.theme = prevTheme
      else delete html.dataset.theme
      delete html.dataset.landing
    }
  }, [])

  return (
    <>
      <Script
        src="/landing/icons3d.js"
        strategy="afterInteractive"
        onLoad={() => (window as unknown as { I3?: { hydrate: () => void } }).I3?.hydrate()}
      />
      <Script src="/landing/landing.js" strategy="afterInteractive" />

      {/* Game XP Bar */}
      <div className="game-bar" id="gameBar">
        <div className="game-bar-inner">
          <div className="gb-level">
            <span className="num" id="gbLvl">1</span> Level
          </div>
          <div className="gb-track">
            <div className="gb-fill" id="gbFill"></div>
          </div>
          <div className="gb-xp">
            <b id="gbXP">0</b> / 100 XP
          </div>
        </div>
      </div>

      {/* Level Up Overlay */}
      <div className="lu-overlay" id="luOverlay">
        <div className="lu-box">
          <div className="lu-emoji" id="luEmoji">⭐</div>
          <div className="lu-title">Level Up!</div>
          <div className="lu-name" id="luName">Level 2</div>
          <div className="lu-sub" id="luSub">Ты узнал, как это работает</div>
        </div>
      </div>

      <canvas id="confetti"></canvas>

      {/* Nav */}
      <nav id="navbar">
        <div className="logo-wrap">
          <svg className="logo-svg" viewBox="0 0 180 50" xmlns="http://www.w3.org/2000/svg">
            <g className="raw-blob">
              <path d="M8,28c-1.5-3,0-8,3-12s8-6,13-5c2,0.4,3.5,1.5,4,3c1-2,3-4,6-4.5c4-0.8,8,1,10,4c0.5,0.8,0.8,1.8,1,2.8c1.5-1,3.5-1.5,5.5-1c3,0.8,5,3,5,6c-1,1-2,2-4,3c2,0,3.5,0.8,4.5,2c1.5,2,1,4.5-0.5,6c-2,2-5,2.5-8,2c-1,2-3,3-6,3c-2,0-3.5-0.8-4.5-2c-1,1.5-3,2.5-5,2.5c-3,0.2-6-1-8-3c-1.5,1-3.5,1.5-5.5,1c-4-1-6.5-4-6-7c0.2-1,0.5-1.8,1-2.5c-1.5-0.2-3-0.8-4-2C8.5,32,7.5,30,8,28z" />
              <text x="14" y="30" fontFamily="Gluten,cursive" fontSize="20" fontWeight="600" fill="#fff">R</text>
              <text x="28" y="30" fontFamily="Gluten,cursive" fontSize="20" fontWeight="600" fill="#fff">a</text>
              <text x="42" y="30" fontFamily="Gluten,cursive" fontSize="20" fontWeight="600" fill="#fff">w</text>
              <circle cx="10" cy="14" r="1.8" />
              <circle cx="57" cy="12" r="1.2" />
              <circle cx="5" cy="22" r="1" />
            </g>
            <text className="eng-text" x="12" y="46" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="600" letterSpacing="0.5">english</text>
          </svg>
        </div>
        <div className="nav-right">
          <ul className="nav-links">
            <li><a href="#lvl4">Платформа</a></li>
            <li><a href="#lvl5">Геймификация</a></li>
            <li><a href="#lvl6">Форматы</a></li>
            <li><a href="#lvl7">Membership</a></li>
          </ul>
          <div className="theme-toggle" id="themeToggle">
            <div className="theme-knob" id="themeKnob">🌙</div>
          </div>
          <Link href="/register" className="nav-cta">
            <span style={{ fontFamily: "'Gluten',cursive", fontWeight: 600 }}>well done</span>
          </Link>
        </div>
      </nav>

      {/* LEVEL 1: HERO */}
      <section className="hero" data-level="1" data-xp="5">
        <div className="hero-avatars">
          <div className="floating-person fp1">
            <div className="person-avatar"><I3 kind="face-m1"></I3></div>
            <div className="person-bubble">
              Just leveled up! <I3 kind="fire" size="sm" style={{ verticalAlign: "-4px" }}></I3>
            </div>
          </div>
          <div className="floating-person fp2">
            <div className="person-avatar"><I3 kind="face-m2"></I3></div>
            <div className="person-bubble">
              +50 XP за дебаты <I3 kind="sword" size="sm" style={{ verticalAlign: "-4px" }}></I3>
            </div>
          </div>
          <div className="floating-person fp3">
            <div className="person-avatar"><I3 kind="face-m3"></I3></div>
            <div className="person-bubble">
              Streak: 14 days <I3 kind="xp-star" size="sm" style={{ verticalAlign: "-4px" }}></I3>
            </div>
          </div>
          <div className="floating-person fp4">
            <div className="person-avatar"><I3 kind="face-m4"></I3></div>
            <div className="person-bubble">
              Wine club tonight <I3 kind="wine" size="sm" style={{ verticalAlign: "-4px" }}></I3>
            </div>
          </div>
        </div>
        <div className="hero-badge">EdTech Platform + Gamification</div>
        <h1>Make it<br /><span className="gluten">well done.</span></h1>
        <p className="hero-sub">
          Персональная платформа с геймификацией, живое коммьюнити, уроки и speaking clubs. Прожарь свой английский от <strong>Raw</strong> до <strong>Well Done</strong>.
        </p>
        <div className="hero-cta">
          <div className="hero-buttons">
            <a href="#lvl3" className="btn-primary">
              <I3 kind="fire" size="sm" style={{ verticalAlign: "-4px", marginRight: 4 }}></I3> Начать прохождение
            </a>
            <a href="#lvl4" className="btn-ghost">Как это работает</a>
          </div>
          <div className="social-proof">
            <div className="sp-faces">
              <div className="sp-face"><I3 kind="face-m1"></I3></div>
              <div className="sp-face"><I3 kind="face-m2"></I3></div>
              <div className="sp-face"><I3 kind="face-m3"></I3></div>
              <div className="sp-face"><I3 kind="face-m4"></I3></div>
              <div className="sp-face"><I3 kind="face-m5"></I3></div>
            </div>
            <div className="sp-text"><strong>500+</strong> учеников уже играют</div>
          </div>
        </div>
        <div
          className="scroll-hint"
          onClick={() => document.querySelector("[data-level='2']")?.scrollIntoView({ behavior: "smooth" })}
        >
          <div className="scroll-line"></div>Level 2 ↓
        </div>
      </section>

      <div className="marquee-wrap">
        <div className="marquee">
          <span>Speaking Clubs</span><span>Gamification</span><span>XP System</span><span>Native Speakers</span><span>Debate Club</span><span>Wine Club</span><span>Streaks</span><span>Achievements</span>
          <span>Speaking Clubs</span><span>Gamification</span><span>XP System</span><span>Native Speakers</span><span>Debate Club</span><span>Wine Club</span><span>Streaks</span><span>Achievements</span>
        </div>
      </div>

      {/* LEVEL 2: SOCIAL PROOF */}
      <section data-level="2" data-xp="10" data-lu="Зал славы открыт">
        <div style={{ textAlign: "center", marginBottom: 40 }} className="reveal">
          <div className="level-label"><span className="ll-num">2</span> Level</div>
          <h2 className="section-title">Они прошли путь.<br />Теперь <span className="gluten">they speak.</span></h2>
        </div>
        <div className="testimonials">
          <div className="testimonial reveal">
            <div className="testimonial-emotion">
              <I3 kind="steak-raw" size="md"></I3>
              <span style={{ color: "var(--text3)", margin: "0 6px" }}>→</span>
              <I3 kind="steak-mr" size="md"></I3>
            </div>
            <div className="testimonial-text">Годами учила по учебникам и боялась рот открыть. Тут XP за ошибки! Серьёзно — ошибаешься и получаешь очки за смелость.</div>
            <div className="testimonial-author">
              <div className="ta-avatar"><I3 kind="face-m1"></I3></div>
              <div>
                <div className="ta-name">Анна</div>
                <div className="ta-level">Raw → Medium Rare</div>
              </div>
            </div>
          </div>
          <div className="testimonial reveal">
            <div className="testimonial-emotion">
              <I3 kind="steak-rare" size="md"></I3>
              <span style={{ color: "var(--text3)", margin: "0 6px" }}>→</span>
              <I3 kind="steak-medium" size="md"></I3>
            </div>
            <div className="testimonial-text">Пришёл на Debate Club с дрожащими коленями. Стрик 30 дней не прерывал — теперь аргументирую лучше, чем на русском!</div>
            <div className="testimonial-author">
              <div className="ta-avatar"><I3 kind="face-m2"></I3></div>
              <div>
                <div className="ta-name">Максим</div>
                <div className="ta-level">Rare → Medium</div>
              </div>
            </div>
          </div>
          <div className="testimonial reveal">
            <div className="testimonial-emotion">
              <I3 kind="steak-medium" size="md"></I3>
              <span style={{ color: "var(--text3)", margin: "0 6px" }}>→</span>
              <I3 kind="steak-mw" size="md"></I3>
            </div>
            <div className="testimonial-text">Геймификация убивает скуку. Челленджи, ачивки, рейтинг — и всё это пока болтаешь на английском с крутыми людьми.</div>
            <div className="testimonial-author">
              <div className="ta-avatar"><I3 kind="face-m3"></I3></div>
              <div>
                <div className="ta-name">Кристина</div>
                <div className="ta-level">Medium → Medium Well</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LEVEL 3: QUIZ */}
      <section className="quiz-section" id="lvl3" data-level="3" data-xp="15" data-lu="Первый бой пройден">
        <div className="quiz-wrap">
          <div className="reveal">
            <div className="level-label"><span className="ll-num">3</span> Level</div>
            <h2 className="section-title">Проверь себя.<br /><span className="gluten">Mini battle.</span> Без регистрации.</h2>
            <p className="section-desc" style={{ margin: "0 auto" }}>Пройди 6 заданий и узнай свою прожарку. Помоги Стейку дойти до финиша — он переживает.</p>
          </div>

          <div className="quiz-intro reveal" id="quizIntro">
            <div className="quiz-hero">
              <div style={{ width: 140, height: 160, margin: "0 auto 14px" }} id="quizIntroChar"></div>
              <div className="quiz-hero-title">Ready to battle?</div>
              <div className="quiz-hero-sub">6 tasks of different types: multiple choice, build a sentence, listen & pick, match pairs. 2 minutes — and you know your level.</div>
              <div className="quiz-hero-stats">
                <div className="qhs"><div className="qhs-num">6</div><div className="qhs-lbl">Tasks</div></div>
                <div className="qhs"><div className="qhs-num">3</div><div className="qhs-lbl">Lives</div></div>
                <div className="qhs"><div className="qhs-num">~2 min</div><div className="qhs-lbl">Time</div></div>
                <div className="qhs"><div className="qhs-num">+30</div><div className="qhs-lbl">Max XP</div></div>
              </div>
              <button className="quiz-start-btn" id="quizStartBtn">
                <I3 kind="fire" size="sm" style={{ verticalAlign: "-3px" }}></I3> Start battle
              </button>
            </div>
          </div>

          <div className="quiz-game" id="quizGame">
            <div className="quiz-hud">
              <button className="quiz-close" id="quizClose" title="Выйти">×</button>
              <div className="quiz-bar-outer"><div className="quiz-bar-fill" id="quizBarFill"></div></div>
              <div className="quiz-hearts" id="quizHearts"></div>
            </div>
            <div id="quizBody"></div>
            <div className="quiz-footer">
              <button className="quiz-skip" id="quizSkip">Пропустить</button>
              <button className="quiz-check" id="quizCheck">Проверить</button>
            </div>
            <div className="quiz-feedback" id="quizFeedback">
              <div className="qf-left">
                <div className="qf-icon" id="qfIcon">✓</div>
                <div className="qf-text">
                  <div className="qf-title" id="qfTitle">Отлично!</div>
                  <div className="qf-correct" id="qfCorrect"></div>
                </div>
              </div>
              <button className="qf-btn" id="qfBtn">Продолжить</button>
            </div>
          </div>

          <div className="quiz-result-screen" id="quizResult">
            <div className="qres-hero">
              <div className="qres-char" id="qresChar"></div>
              <div className="qres-label">Твой уровень</div>
              <div className="qres-level" id="qresLevel">Medium Rare</div>
              <div className="qres-tagline" id="qresTagline">Ты уверенно держишь базу, но грамматика и разговорная беглость хромают. Самое время — на сковородку.</div>
              <div className="qres-stats">
                <div className="qres-stat"><div className="qres-stat-n" id="qresScore">5/6</div><div className="qres-stat-l">Ответов</div></div>
                <div className="qres-stat"><div className="qres-stat-n" id="qresXp">+24 XP</div><div className="qres-stat-l">Получено</div></div>
                <div className="qres-stat"><div className="qres-stat-n" id="qresCefr">B1</div><div className="qres-stat-l">CEFR</div></div>
              </div>
            </div>

            <div className="qres-section-title">Your <span className="gluten">roasting path</span></div>
            <div className="qres-roadmap" id="qresRoadmap"></div>

            <div className="qres-cta-box">
              <div className="qres-cta-title">Start with a trial lesson</div>
              <div className="qres-cta-sub">30 minutes with a teacher — free. We&apos;ll verify your level, show you the platform and build a precise plan.</div>
              <div className="qres-cta-btns">
                <Link href="/register" className="qres-cta-primary">
                  <I3 kind="mic" size="sm"></I3> Book a trial lesson
                </Link>
                <button className="qres-cta-ghost" id="quizRestart">Retake the test</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LEVEL 4: PLATFORM */}
      <section className="platform-section" id="lvl4" data-level="4" data-xp="10" data-lu="Платформа изучена">
        <div className="platform-wrap">
          <div className="platform-header reveal">
            <div className="level-label"><span className="ll-num">4</span> Level</div>
            <h2 className="section-title">EdTech-платформа<br />с <span className="gluten">gamification</span></h2>
            <p className="section-desc" style={{ margin: "14px auto 0", textAlign: "center" }}>Персональные уроки, живая практика и система мотивации — всё в одном месте.</p>
          </div>
          <div className="platform-grid">
            <div className="platform-card reveal"><div className="pc-icon"><I3 kind="controller" size="lg"></I3></div><div className="pc-title">XP и уровни</div><div className="pc-desc">Зарабатывай очки опыта за каждое действие: урок, клуб, челлендж.</div><div className="pc-tag">Gamification</div></div>
            <div className="platform-card reveal"><div className="pc-icon"><I3 kind="fire" size="lg"></I3></div><div className="pc-title">Стрики и челленджи</div><div className="pc-desc">Не прерывай цепочку! Ежедневные задания держат тебя в тонусе.</div><div className="pc-tag">Motivation</div></div>
            <div className="platform-card reveal"><div className="pc-icon"><I3 kind="chart" size="lg"></I3></div><div className="pc-title">Персональный трек</div><div className="pc-desc">Индивидуальная программа на основе твоего уровня и целей.</div><div className="pc-tag">Personal</div></div>
            <div className="platform-card reveal"><div className="pc-icon"><I3 kind="trophy" size="lg"></I3></div><div className="pc-title">37 ачивок</div><div className="pc-desc">Реальные призы: мерч, скидки, бесплатные уроки за прогресс.</div><div className="pc-tag">Achievements</div></div>
            <div className="platform-card reveal"><div className="pc-icon"><I3 kind="mic" size="lg"></I3></div><div className="pc-title">Уроки 1-on-1</div><div className="pc-desc">Персональные занятия с native speakers. General и специализированный.</div><div className="pc-tag">Lessons</div></div>
            <div className="platform-card reveal"><div className="pc-icon"><I3 kind="robot" size="lg"></I3></div><div className="pc-title">AI-ассистент</div><div className="pc-desc">Помогает прямо во время урока. Объясняет, переводит, подсказывает.</div><div className="pc-tag">AI</div></div>
          </div>
        </div>
      </section>

      {/* LEVEL 5: GAMIFICATION */}
      <section id="lvl5" data-level="5" data-xp="12" data-lu="Геймификация раскрыта">
        <div className="gamification-section">
          <div style={{ textAlign: "center", marginBottom: 60 }} className="reveal">
            <div className="level-label"><span className="ll-num">5</span> Level</div>
            <h2 className="section-title">Учиться — <span className="gluten">addictive.</span></h2>
            <p className="section-desc" style={{ margin: "10px auto 0", textAlign: "center" }}>6 уровней прожарки. От сырого до готового. Каждый привязан к реальному уровню языка.</p>
          </div>
          <div className="gamification-grid">
            <div className="xp-card reveal"><div className="xp-icon"><I3 kind="xp-star" size="xl"></I3></div><div className="xp-title">XP за всё</div><div className="xp-desc">Урок = +55 XP. Speaking Club = +30 XP. Daily Challenge = +10 XP. Стрик = +5 XP/день. Каждое действие — прогресс.</div></div>
            <div className="xp-card reveal"><div className="xp-icon"><I3 kind="fire" size="xl"></I3></div><div className="xp-title">Стрики и призы</div><div className="xp-desc">7 дней = стикерпак. 30 дней = мерч. 100 дней = бесплатный месяц. 365 = Hall of Fame.</div></div>
            <div className="xp-card reveal"><div className="xp-icon"><I3 kind="shield" size="xl"></I3></div><div className="xp-title">Лидерборд</div><div className="xp-desc">Топ-3 каждый месяц получают подарки. Мерч, уроки, эксклюзивные ивенты.</div></div>
            <div className="xp-card reveal"><div className="xp-icon"><I3 kind="trophy" size="xl"></I3></div><div className="xp-title">37 ачивок</div><div className="xp-desc">От First Flame до Unstoppable. Common, Rare, Epic, Legendary. С реальными призами.</div></div>
          </div>
          <div className="levels-grid">
            <div className="level-card reveal"><div className="level-name">Raw</div><div className="level-desc-short">Понимаю слова, боюсь говорить</div></div>
            <div className="level-card reveal"><div className="level-name">Rare</div><div className="level-desc-short">Начинаю говорить, много ошибок</div></div>
            <div className="level-card reveal"><div className="level-name">Medium Rare</div><div className="level-desc-short">Общаюсь, но не всегда уверенно</div></div>
            <div className="level-card reveal"><div className="level-name">Medium</div><div className="level-desc-short">Свободно поддерживаю беседу</div></div>
            <div className="level-card reveal"><div className="level-name">Medium Well</div><div className="level-desc-short">Уверенно говорю, чувствую язык</div></div>
            <div className="level-card reveal"><div className="level-name">Well Done</div><div className="level-desc-short">Думаю на английском</div></div>
          </div>
        </div>
      </section>

      {/* LEVEL 6: HOW + FORMATS */}
      <section id="lvl6" data-level="6" data-xp="10" data-lu="Форматы открыты">
        <div className="hiw">
          <div className="hiw-header reveal">
            <div className="level-label"><span className="ll-num">6</span> Level</div>
            <h2 className="section-title">Четыре шага к <span className="gluten">living English</span></h2>
          </div>
          <div className="timeline">
            <div className="tl-step reveal"><div className="tl-icon"><I3 kind="target" size="xl"></I3></div><div className="tl-num">Step 01</div><div className="tl-title">Определи уровень</div><div className="tl-text">Пройди тест — узнай прожарку и получи персональный план.</div></div>
            <div className="tl-step reveal"><div className="tl-icon"><I3 kind="mic" size="xl"></I3></div><div className="tl-num">Step 02</div><div className="tl-title">Учись и практикуй</div><div className="tl-text">Уроки + speaking clubs. Теория → живая практика.</div></div>
            <div className="tl-step reveal"><div className="tl-icon"><I3 kind="controller" size="xl"></I3></div><div className="tl-num">Step 03</div><div className="tl-title">Зарабатывай XP</div><div className="tl-text">Челленджи, стрики, ачивки — учёба затягивает.</div></div>
            <div className="tl-step reveal"><div className="tl-icon"><I3 kind="fire" size="xl"></I3></div><div className="tl-num">Step 04</div><div className="tl-title">Level up</div><div className="tl-text">Расти от Raw до Well Done. В своём темпе.</div></div>
          </div>
        </div>
        <div className="formats" style={{ marginTop: 80 }}>
          <div className="reveal" style={{ textAlign: "center", marginBottom: 50 }}>
            <h2 className="section-title">Выбери свою <span className="gluten">atmosphere</span></h2>
          </div>
          <div className="formats-bento">
            <div className="fmt-card fmt-card--hero reveal"><div className="fmt-deco"><I3 kind="mic" size="xl" style={{ width: 120, height: 120 }}></I3></div><div className="fmt-content"><div className="fmt-tag">Speaking Club</div><div className="fmt-name">Open Speaking Club</div><div className="fmt-desc">Живое общение на английском в мини-группах. Каждый день — новая тема, новые люди, реальная практика.</div></div></div>
            <div className="fmt-card fmt-card--debate reveal"><div className="fmt-deco"><I3 kind="sword" size="xl" style={{ width: 88, height: 88 }}></I3></div><div className="fmt-content"><div className="fmt-tag fmt-tag--lime">Debate Club</div><div className="fmt-name">Debate Club</div><div className="fmt-desc">Аргументируй, защищай позицию, думай на английском.</div></div></div>
            <div className="fmt-card fmt-card--wine reveal"><div className="fmt-deco"><I3 kind="wine" size="xl" style={{ width: 88, height: 88 }}></I3></div><div className="fmt-content"><div className="fmt-tag fmt-tag--purple">Wine Club</div><div className="fmt-name">Wine Club</div><div className="fmt-desc">Болтовня в расслабленной атмосфере. Кино, путешествия, жизнь.</div></div></div>
            <div className="fmt-card fmt-card--lessons reveal"><div className="fmt-deco"><I3 kind="book" size="xl" style={{ width: 88, height: 88 }}></I3></div><div className="fmt-content"><div className="fmt-tag fmt-tag--lime">1-on-1</div><div className="fmt-name">Уроки с преподавателем</div><div className="fmt-desc">Персональные занятия + серия видеоуроков + тесты + домашка.</div></div></div>
            <div className="fmt-card fmt-card--niche reveal"><div className="fmt-deco"><I3 kind="briefcase" size="xl" style={{ width: 88, height: 88 }}></I3></div><div className="fmt-content"><div className="fmt-tag">Niche</div><div className="fmt-name">IT / Business English</div><div className="fmt-desc">Специализированная лексика для карьеры.</div></div></div>
            <div className="fmt-card fmt-card--events reveal"><div className="fmt-deco"><I3 kind="party" size="xl" style={{ width: 88, height: 88 }}></I3></div><div className="fmt-content"><div className="fmt-tag fmt-tag--amber">Events</div><div className="fmt-name">Эксклюзивные ивенты</div><div className="fmt-desc">Offline встречи для топ-участников лидерборда.</div></div></div>
          </div>
        </div>
      </section>

      {/* LEVEL 7: MEMBERSHIP */}
      <section id="lvl7" data-level="7" data-xp="10" data-lu="Вход в клуб">
        <div className="membership-wrap">
          <div className="reveal">
            <div className="level-label"><span className="ll-num">7</span> Level</div>
            <h2 className="section-title">Не разовый урок.<br />Твой <span className="gluten">club.</span></h2>
            <p className="section-desc">Подписка — доступ ко всей геймификации, клубам и призам. Уроки оплачиваются отдельно с баланса.</p>
            <p className="section-desc" style={{ marginTop: 14 }}>
              <strong style={{ color: "var(--red)" }}>1 490 ₽/мес</strong> · дешевле чашки кофе в день.
            </p>
          </div>
          <div className="membership-card reveal">
            <div className="section-tag" style={{ color: "var(--lime)" }}>RAW Pro · Season Pass</div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Всё для прогресса</h3>
            <ul className="membership-list">
              <li><span className="ml-check">✓</span> Персональная платформа</li>
              <li><span className="ml-check">✓</span> XP, стрики, 37 ачивок с призами</li>
              <li><span className="ml-check">✓</span> Лидерборд с подарками</li>
              <li><span className="ml-check">✓</span> AI-ассистент на уроках</li>
              <li><span className="ml-check">✓</span> Серия видеоуроков + тесты</li>
              <li><span className="ml-check">✓</span> Guest Pass для друга</li>
              <li><span className="ml-check">✓</span> Чат коммьюнити 24/7</li>
            </ul>
            <p style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 20 }}>Без подписки — только уроки 1-on-1. Всё остальное заблокировано.</p>
            <Link href="/register" className="btn-lime">Стать участником</Link>
          </div>
        </div>
      </section>

      {/* LEVEL 8: FINAL */}
      <section className="cta-section" id="cta" data-level="8" data-xp="8" data-lu="Финал!">
        <div className="reveal">
          <div className="level-label"><span className="ll-num">8</span> Level · Final</div>
        </div>
        <h2 className="cta-title reveal">Ты прошёл все уровни.<br /><span className="gluten">now beat the language.</span></h2>
        <p className="cta-sub reveal">Мы начислили тебе XP за прохождение лендинга. Осталось зарегистрироваться — и они твои.</p>
        <div className="reveal" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <Link href="/register" className="btn-primary" style={{ fontSize: "1.05rem", padding: "17px 44px" }}>
            <I3 kind="fire" size="sm" style={{ verticalAlign: "-4px", marginRight: 4 }}></I3> Забрать XP и начать
          </Link>
          <a href="https://t.me/raw_english" className="btn-ghost" target="_blank" rel="noopener noreferrer">Написать в Telegram</a>
        </div>
        <p style={{ marginTop: 28, fontSize: "0.82rem", color: "var(--text3)", position: "relative", zIndex: 1 }} className="reveal">
          Пробный урок — бесплатно ✦ Количество мест ограничено
        </p>
      </section>

      <footer>
        <div className="footer-logo">
          <span style={{ fontFamily: "'Gluten',cursive", color: "var(--red)" }}>Raw</span> english
        </div>
        <ul className="footer-links">
          <li><a href="https://t.me/raw_english" target="_blank" rel="noopener noreferrer">Telegram</a></li>
          <li><a href="https://instagram.com/raw_english" target="_blank" rel="noopener noreferrer">Instagram</a></li>
          <li><Link href="/register">Связаться</Link></li>
        </ul>
        <div className="footer-copy">By V. Kratkovskaya © 2026</div>
      </footer>
    </>
  )
}
