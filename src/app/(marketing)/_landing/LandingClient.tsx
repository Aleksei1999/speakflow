// @ts-nocheck
"use client"

import { useEffect, useMemo, useState, createElement } from "react"
import Script from "next/script"
import Link from "next/link"
import dynamic from "next/dynamic"
import { RawLogo } from "@/components/ui/raw-logo"
import { useUser } from "@/hooks/use-user"
// CSS подключаем через <link> в JSX (см. ниже), чтобы Next не пакетировал
// landing-стили в shared client chunk и не preload'ил их на dashboard-страницах.

// Heavy quiz (~58 KB source, ~226 KB bundled) — lazy-load it so the homepage's
// initial JS payload stays small. ssr:false because the quiz is purely client-side
// (uses useState extensively) and rendering it on the server adds bytes to no benefit.
// Pricing-секция тоже клиентская и легковесная, но грузим её лениво,
// чтобы первый paint лендинга не разбухал ещё на ~6KB.
const PricingSection = dynamic(() => import("./PricingSection"), { ssr: false })

const MiniBattleQuiz = dynamic(() => import("./MiniBattleQuiz"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text3)",
        fontSize: "0.95rem",
      }}
    >
      Загружаем квиз…
    </div>
  ),
})

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

// Synchronous read of the public auth-flag cookie set by middleware.
// Returns the user's role (or empty string) on the client; "" on the server
// — keeping the static (ISR) HTML output identical for cached responses.
function readAuthedCookie(): string {
  if (typeof document === "undefined") return ""
  const m = document.cookie.match(/(?:^|; )rwen_authed=([^;]+)/)
  return m ? decodeURIComponent(m[1]!) : ""
}

function roleToHome(role: string | null | undefined): string {
  if (role === "admin") return "/admin"
  if (role === "teacher") return "/teacher"
  return "/student"
}

export default function LandingClient() {
  // 1) On first client render, seed auth state from the public cookie that
  //    middleware sets. This avoids waiting ~300–800ms for Supabase
  //    `auth.getUser()` to resolve in useUser().
  // 2) The page is still statically generated (ISR). The cached HTML contains
  //    BOTH nav variants — we toggle which one is visible via CSS using the
  //    `data-authed` attribute set on <html> by the bootstrap script in
  //    app/layout.tsx (also derived from the same cookie). That gives a
  //    flash-free first paint for both authed and anonymous users.
  // 3) useUser() then verifies and updates state if the cookie was stale
  //    (e.g. token expired but cookie still around).
  const [cookieRole, setCookieRole] = useState<string>("")
  useEffect(() => {
    setCookieRole(readAuthedCookie())
  }, [])

  const { user, role: hookRole, isLoading } = useUser()

  // Authed if either the cookie OR the resolved hook says so. We trust the
  // hook over the cookie once it has loaded (handles signed-out-elsewhere).
  const hookAuthed = !!user && !isLoading
  const isAuthenticated = isLoading ? !!cookieRole : hookAuthed
  const effectiveRole = hookAuthed ? hookRole : cookieRole || null

  const homeHref = useMemo(() => roleToHome(effectiveRole), [effectiveRole])
  const ctaHref = isAuthenticated ? homeHref : "/register"
  useEffect(() => {
    const html = document.documentElement
    const prevTheme = html.dataset.theme
    html.dataset.theme = "light"
    html.dataset.landing = "true"
    const w = window as unknown as {
      I3?: { hydrate: () => void }
      __landingInit?: () => void
      __landingDispose?: () => void
    }
    // Defensive: fire hydrate + init even if onReady didn't.
    w.I3?.hydrate()
    w.__landingInit?.()
    return () => {
      if (prevTheme) html.dataset.theme = prevTheme
      else delete html.dataset.theme
      delete html.dataset.landing
      w.__landingDispose?.()
    }
  }, [])

  return (
    <>
      {/* Landing-стили подключаются как обычные <link>, не через Next bundler.
          Это предотвращает их попадание в shared client chunk → нет лишних
          preload'ов на dashboard-страницах. */}
      <link rel="stylesheet" href="/landing/landing.css" />
      <link rel="stylesheet" href="/landing/icons3d.css" />
      {/* Гейминг скрыт через display:none, но landing.js всё равно добавляет
          к <nav> класс .pushed (top:38px — место под XP-бар). Переопределяем
          обратно на top:0, чтобы не было пустой полосы сверху. */}
      <style>{`nav#navbar.pushed{top:0!important}`}</style>
      <Script
        src="/landing/icons3d.js"
        strategy="afterInteractive"
        onReady={() => (window as unknown as { I3?: { hydrate: () => void } }).I3?.hydrate()}
      />
      <Script
        src="/landing/landing.js"
        strategy="afterInteractive"
        onReady={() => (window as unknown as { __landingInit?: () => void }).__landingInit?.()}
      />

      {/* TEMP: gamification отключена через inline style (display:none).
          Markup оставлен в DOM, чтобы landing.js не падал на null-узлах
          (он использует gameBar/luOverlay/confetti для scroll-триггеров). */}
      <div className="game-bar" id="gameBar" style={{ display: "none" }}>
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

      <div className="lu-overlay" id="luOverlay" style={{ display: "none" }}>
        <div className="lu-box">
          <div className="lu-emoji" id="luEmoji">⭐</div>
          <div className="lu-title">Level Up!</div>
          <div className="lu-name" id="luName">Level 2</div>
          <div className="lu-sub" id="luSub">Ты узнал, как это работает</div>
        </div>
      </div>

      <canvas id="confetti" style={{ display: "none" }}></canvas>

      {/* Nav */}
      <nav id="navbar">
        <div className="logo-wrap">
          <Link href="/" aria-label="Raw English" style={{ display: "inline-flex", alignItems: "center" }}>
            <RawLogo size={32} priority />
          </Link>
        </div>
        <div className="nav-right">
          <ul className="nav-links">
            <li><a href="#lvl4">Платформа</a></li>
            <li><a href="#lvl5">Геймификация</a></li>
            <li><a href="#lvl6">Форматы</a></li>
            <li><a href="#lvl7">Membership</a></li>
            <li><a href="#pricing">Цены</a></li>
          </ul>
          <div className="theme-toggle" id="themeToggle">
            <div className="theme-knob" id="themeKnob">☀️</div>
          </div>
          {/*
            Both nav variants are rendered into the static HTML. The
            `data-authed` attribute set on <html> by the inline bootstrap
            script in app/layout.tsx (derived from the public `rwen_authed`
            cookie) drives which one is visible via the CSS rules below —
            this avoids a flash on cached ISR responses for logged-in users.
            React's `isAuthenticated` is synced with the same cookie via
            useEffect, so once useUser() resolves it can override the role
            href if needed; visibility itself stays CSS-driven.
          */}
          <style>{`
            .rw-nav-anon, .rw-nav-authed { display: inline-flex; }
            html[data-authed="1"] .rw-nav-anon { display: none !important; }
            html:not([data-authed="1"]) .rw-nav-authed { display: none !important; }
          `}</style>
          <Link href={homeHref} className="nav-cta rw-nav-authed">
            <span>Личный кабинет</span>
          </Link>
          <div
            className="nav-cta-group rw-nav-anon"
            style={{ alignItems: "center", gap: "16px" }}
          >
            <Link
              href="/teach"
              className="nav-cta nav-cta--teacher"
              style={{
                background: "transparent",
                color: "var(--text)",
                border: "1.5px solid var(--text)",
                boxShadow: "none",
                marginRight: "4px",
              }}
            >
              <span>Для преподавателя</span>
            </Link>
            <Link href="/login" className="nav-cta nav-cta--student">
              <span>Войти</span>
            </Link>
          </div>
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
            <p className="section-desc" style={{ margin: "0 auto" }}>Пройди 12 вопросов и узнай свою прожарку. Помоги Стейку дойти до well-done — он переживает.</p>
          </div>
          <MiniBattleQuiz isAuthenticated={isAuthenticated} ctaHref={ctaHref} />
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
            <Link href={ctaHref} className="btn-lime">{isAuthenticated ? "Перейти в кабинет" : "Стать участником"}</Link>
          </div>
        </div>
      </section>

      {/* PRICING — общий источник тарифов с /student/balance */}
      <PricingSection />

      {/* LEVEL 8: FINAL */}
      <section className="cta-section" id="cta" data-level="8" data-xp="8" data-lu="Финал!">
        <div className="reveal">
          <div className="level-label"><span className="ll-num">8</span> Level · Final</div>
        </div>
        <h2 className="cta-title reveal">Ты прошёл все уровни.<br /><span className="gluten">now beat the language.</span></h2>
        <p className="cta-sub reveal">Мы начислили тебе XP за прохождение лендинга. Осталось зарегистрироваться — и они твои.</p>
        <div className="reveal" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <Link href={ctaHref} className="btn-primary" style={{ fontSize: "1.05rem", padding: "17px 44px" }}>
            <I3 kind="fire" size="sm" style={{ verticalAlign: "-4px", marginRight: 4 }}></I3> {isAuthenticated ? "Перейти в кабинет" : "Забрать XP и начать"}
          </Link>
          <a href="https://t.me/raw_english" className="btn-ghost" target="_blank" rel="noopener noreferrer">Написать в Telegram</a>
        </div>
        <p style={{ marginTop: 28, fontSize: "0.82rem", color: "var(--text3)", position: "relative", zIndex: 1 }} className="reveal">
          Пробный урок — бесплатно ✦ Количество мест ограничено
        </p>
      </section>

      <footer>
        <div className="footer-logo">
          <RawLogo size={36} />
        </div>
        <ul className="footer-links">
          <li><a href="https://t.me/raw_english" target="_blank" rel="noopener noreferrer">Telegram</a></li>
          <li><a href="https://instagram.com/raw_english" target="_blank" rel="noopener noreferrer">Instagram</a></li>
          <li><Link href="/register">Связаться</Link></li>
          <li><Link href="/privacy">Политика конфиденциальности</Link></li>
          <li><Link href="/oferta">Договор-оферта</Link></li>
        </ul>
        <div className="footer-legal" style={{ fontSize: "0.78rem", color: "var(--text3)", lineHeight: 1.7, marginTop: 18, textAlign: "center" }}>
          ИП Кратковская Валерия Витальевна<br />
          ОГРНИП: 325619600134369 · ИНН: 616485783606
        </div>
        <div className="footer-copy">By V. Kratkovskaya © 2026</div>
      </footer>
    </>
  )
}
