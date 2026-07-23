"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------
   RAW ENGLISH — new landing (Figma "Главная RAW english")
   Faithful rebuild of the 10-section design. Styles: /landing/raw2/raw2.css
   Photos: /landing/raw2/*.jpg (exported from Figma)
   ------------------------------------------------------------------ */

const QUIZ_HREF = "/level-test";
const CONTACT_HREF = "#contact";

/* ---------- inline icons ---------- */
const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 12h15M13 6l7 6-7 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconQuestion = () => (
  <svg viewBox="0 0 56 56" fill="none" aria-hidden>
    <path d="M14 10h34a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H26L14 50V40h0a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
    <path d="M24 21a5 5 0 0 1 9 3c0 3-4 3.5-4 6.5M29 35.5h.02" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
  </svg>
);
const IconHeart = () => (
  <svg viewBox="0 0 56 56" fill="none" aria-hidden>
    <path d="M28 47S8 35 8 21.5C8 14.6 13.4 10 19.5 10c3.9 0 7 1.9 8.5 4.6C29.5 11.9 32.6 10 36.5 10 42.6 10 48 14.6 48 21.5 48 35 28 47 28 47Z" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
  </svg>
);
const IconTimer = () => (
  <svg viewBox="0 0 56 56" fill="none" aria-hidden>
    <circle cx="28" cy="31" r="17" stroke="currentColor" strokeWidth="3.4" />
    <path d="M28 31V22M22 8h12M28 14V8" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
  </svg>
);
const Chevron = () => (
  <svg width="30" height="20" viewBox="0 0 30 20" fill="none" className="chev" aria-hidden>
    <path d="M3 4.5 15 15.5 27 4.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const TgIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M11.94 2.02a10 10 0 1 0 .12 20 10 10 0 0 0-.12-20Zm4.62 6.9-1.55 7.3c-.11.52-.42.64-.86.4l-2.38-1.76-1.15 1.1c-.13.13-.24.24-.48.24l.17-2.42 4.4-3.98c.19-.17-.04-.27-.3-.1l-5.43 3.42-2.34-.73c-.51-.16-.52-.51.11-.76l9.14-3.53c.42-.15.8.1.66.75Z" />
  </svg>
);

/* ---------- data ---------- */
const FEATURES = [
  { icon: "ic-bubble.png", iconActive: "ic-bubble-red.png", title: "Разговорные клубы", body: <>Speaking club <b>с носителями</b> каждый день.</> },
  { icon: "ic-cv-black.png", iconActive: "ic-cv.png", title: "CV / резюме", body: <>Составляем резюме на английском <b>вместе с вами</b> для трудоустройства.</> },
  { icon: "ic-cap.png", iconActive: "ic-cap-red.png", title: "Индивидуальные уроки", body: <>Никаких больших групп. Всё внимание — <b>только вам.</b></> },
  { icon: "ic-psy.png", iconActive: "ic-psy-red.png", title: "Работа с психологом", body: <>Преодолевай языковой барьер, <b>избавляйся от страха</b> со специалистом</> },
  { icon: "ic-lecture.png", iconActive: "ic-lecture-red.png", title: "Лекции", body: <>Развивайся <b>в профессии и хобби</b> с нашими лекциями на английском языке</> },
];

const FREE_CARDS = [
  { img: "ff-video.jpg", cls: "raw2-pcard--tall", text: <>Получи первое занятие <b>полностью бесплатно</b></> },
  { img: "ff-tennis.jpg", cls: "", text: <><b>Выстроим план</b> обучения исходя из твоих интересов и хобби</> },
  { img: "ff-chat.jpg", cls: "", text: <>Подберем для тебя <b>идеального преподавателя</b></> },
  { img: "ff-hoodie.jpg", cls: "raw2-pcard--wide", text: <><b>Замотивируем тебя</b> продолжать путь в изучении английского</> },
];

const PRICES = [
  {
    title: "Занятия", hot: false, price: "от 2.000 ₽",
    items: [<>Занятия <b>один на один</b> с преподавателем</>, <>Один или полтора часа <b>на выбор</b></>, <>Адаптивное изучение <b>под ваши цели</b></>],
  },
  {
    title: "Группы", hot: false, price: "1.800 ₽",
    items: [<>Поддержка группы <b>помогает</b> продолжать заниматься</>, <>Успехи других <b>мотивируют</b> двигаться дальше и быстрее</>, <>Вместе учиться интереснее <b>и эффективнее</b></>],
  },
  {
    title: "Разговорный клуб с носителями языка", hot: true, price: "1.500 ₽",
    items: [<><b>Ускорь обучение</b> непринужденным форматом</>, <><b>Открой доступ</b> к игровому формату обучения, клубам и призам</>, <><b>Разнообразь</b> обучение новым функционалом</>],
  },
];

const FAQ = [
  { q: "У меня страх говорить. Как вы с этим помогаете?", a: "Мы начинаем с бережных форматов: индивидуальные уроки и небольшие клубы, где ошибаться — норма. Преподаватель ведёт тебя от простого к сложному, поэтому страх уходит уже на первых занятиях." },
  { q: "Через сколько я буду знать английский?", a: "Всё индивидуально и зависит от старта и регулярности. Первые результаты в разговоре видны через 1–2 месяца системных занятий — а план обучения мы строим под твою цель." },
  { q: "Как узнать свою прожарку? Что эти уровни вообще значат?", a: "Пройди бесплатный тест из 12 вопросов — он определит твой уровень «прожарки» от Raw до Well Done. Это игровая шкала твоего английского с персональным планом, что подтянуть." },
  { q: "Кто ведёт уроки и клубы? Это носители языка?", a: "Мы индивидуально подбираем преподавателей для учеников. Это носители языка и те, кто много лет обучают английскому. Профессионалы, которые точно дадут результат, а уроки с ними будут интересными." },
];

export default function LandingRaw2() {
  const [openFaq, setOpenFaq] = useState<number | null>(3);
  const [sent, setSent] = useState(false);

  // login popup (Ученик / Учитель)
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginRole, setLoginRole] = useState<"student" | "teacher">("student");
  const [loginErr, setLoginErr] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLoginOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loginOpen]);

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginErr("");
    setLoginBusy(true);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginErr("Неверный email или пароль");
        setLoginBusy(false);
        return;
      }
      window.location.href = loginRole === "teacher" ? "/teacher" : "/student";
    } catch {
      setLoginErr("Не удалось войти. Попробуйте позже.");
      setLoginBusy(false);
    }
  }
  // infinite carousel: render FEATURES ×3, keep scroll inside the middle copy,
  // highlight the card nearest the viewport centre (bigger + red icon).
  const carRef = useRef<HTMLDivElement>(null);
  const carItems = [...FEATURES, ...FEATURES, ...FEATURES];
  const [activeIdx, setActiveIdx] = useState(FEATURES.length);

  function carCards() {
    const el = carRef.current;
    if (!el) return null;
    return Array.from(el.querySelectorAll<HTMLElement>(".raw2-fcard"));
  }
  function copyWidth(cards: HTMLElement[]) {
    if (cards.length < 2) return 0;
    return (cards[1].offsetLeft - cards[0].offsetLeft) * FEATURES.length;
  }
  function onCarScroll() {
    const el = carRef.current;
    const cards = carCards();
    if (!el || !cards) return;
    const copyW = copyWidth(cards);
    if (copyW > 0) {
      if (el.scrollLeft < copyW * 0.5) el.scrollLeft += copyW;
      else if (el.scrollLeft > copyW * 1.5) el.scrollLeft -= copyW;
    }
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0, bestD = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
      if (d < bestD) { bestD = d; best = i; }
    });
    setActiveIdx(best);
  }
  useEffect(() => {
    const el = carRef.current;
    const cards = carCards();
    if (el && cards) {
      const copyW = copyWidth(cards);
      if (copyW > 0) el.scrollLeft = copyW;
    }
    onCarScroll();
    window.addEventListener("resize", onCarScroll);
    return () => window.removeEventListener("resize", onCarScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollCards(dir: 1 | -1) {
    const el = carRef.current;
    const cards = carCards();
    if (!el || !cards) return;
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  // drag-to-scroll with the mouse (touch/trackpad already scroll natively)
  useEffect(() => {
    const el = carRef.current;
    if (!el) return;
    let down = false, startX = 0, startScroll = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      down = true; startX = e.clientX; startScroll = el.scrollLeft;
      el.classList.add("dragging");
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      el.scrollLeft = startScroll - (e.clientX - startX);
    };
    const onUp = () => { down = false; el.classList.remove("dragging"); };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  // this landing is its own visual system — force light + tag <html>
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.dataset.theme;
    html.dataset.theme = "light";
    return () => { if (prevTheme) html.dataset.theme = prevTheme; };
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // TODO: wire to lead/trial endpoint (см. autoAssignTrial / /api/auth).
    setSent(true);
  }

  return (
    <div className="raw2">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/landing/raw2/raw2.css" />

      {/* ============ NAV ============ */}
      <nav className="raw2-nav">
        <Link href="/" className="brand" aria-label="Raw English">
          <img src="/landing/raw2/logo-raw-word.svg" alt="Raw English" className="logo-img" />
        </Link>
        <ul className="nav-links">
          <li><a href="#system">Методика</a></li>
          <li><a href="#founder">Преподаватели</a></li>
          <li><a href="#price">Стоимость</a></li>
          <li><a href={QUIZ_HREF}>Пройти тест</a></li>
        </ul>
        <div className="nav-actions">
          <a href={CONTACT_HREF} className="pill pill-lime">Выучить английский</a>
          <button type="button" className="pill pill-red" onClick={() => setLoginOpen(true)}>Личный кабинет</button>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="raw2-hero" style={{ backgroundImage: "url(/landing/raw2/hero.jpg)" }}>
        <div className="wrap">
          <div className="glass">
            <h1>Преврати сырой английский в <span className="c-lime">сочный разговорный</span></h1>
            <p className="lede">Без скуки, без зубрёжки, в компании таких же голодных до языка людей.</p>
            <Link href={QUIZ_HREF} className="cta-red">
              <span className="free">бесплатно</span>
              Узнай свой уровень прожарки
            </Link>
            <div className="cta-row">
              <Link href={QUIZ_HREF} className="btn btn-lime">пройти тест</Link>
              <Link href={QUIZ_HREF} className="btn btn-arrow" aria-label="Пройти тест"><ArrowRight /></Link>
            </div>
          </div>
        </div>
        <div className="bubble">Ты пройдёшь путь от страха сказать слово до умения шутить на английском.</div>
      </header>

      {/* ============ SYSTEM ============ */}
      <section id="system" className="raw2-system">
        <div className="wrap">
          <div className="badge-wrap">
            <span className="badge-title badge-title--outline-lime" style={{ borderColor: "#DDEA88", color: "#1E1E1E" }}>
              Система, в которую заходишь <span className="c-red">с пользой</span>:
            </span>
          </div>
        </div>
        <div className="raw2-carousel-wrap">
          <button type="button" className="raw2-car-nav prev" onClick={() => scrollCards(-1)} aria-label="Назад">
            <ArrowRight />
          </button>
          <div className="raw2-carousel" ref={carRef} onScroll={onCarScroll}>
            {carItems.map((f, i) => (
              <article className={`raw2-fcard ${i === activeIdx ? "active" : ""}`} key={i}>
                <span className="ficon">
                  <img src={`/landing/raw2/${f.icon}`} alt="" className="ic-def" />
                  <img src={`/landing/raw2/${f.iconActive}`} alt="" className="ic-act" />
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
          <button type="button" className="raw2-car-nav next" onClick={() => scrollCards(1)} aria-label="Вперёд">
            <ArrowRight />
          </button>
        </div>
      </section>

      {/* ============ QUIZ CTA ============ */}
      <section className="raw2-quiz">
        <div className="wrap">
          <div className="card">
            <div className="left">
              <h2>Проверь свою <span className="c-red">прожарку</span></h2>
              <p className="lvlup"><span className="up">Level up</span> или <span className="raw">stay raw</span>?</p>
              <p className="desc">Пройди 12 вопросов и узнай свою прожарку. Помоги Стейку стать <b>well done</b> — он очень волнуется.</p>
            </div>
            <div className="right">
              <div className="metrics">
                <div className="metric"><span className="mi"><IconQuestion /></span><div><b>12</b><span>вопросов</span></div></div>
                <div className="metric"><span className="mi"><IconHeart /></span><div><b>3</b><span>жизни</span></div></div>
                <div className="metric"><span className="mi"><IconTimer /></span><div><b>2</b><span>мин времени</span></div></div>
              </div>
              <p className="subnote">Узнай, на каком ты уровне прямо сейчас — и получи персональный план прожарки.</p>
              <Link href={QUIZ_HREF} className="btn btn-red">Начать игру!</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOUNDER ============ */}
      <section id="founder" className="raw2-founder" style={{ backgroundImage: "url(/landing/raw2/founder.jpg)" }}>
        <div className="wrap">
          <span className="badge-title badge-title--outline-lime">
            Преподаватель английского <br className="d-br" />и <span className="c-lime">основатель своей школы</span>
          </span>
          <div className="bio">
            <div className="bio-card">
              <ul>
                <li>Два высших образования: маркетинг, в университете <b className="lime">Хартфордшира, Великобритания</b> и филологический факультет педагогического направления в <b className="lime">Южном федеральном университете.</b></li>
                <li>Начинала преподавать по объявлению, затем работала <b className="lime">в самой популярной школе</b> английского в Ростове.</li>
              </ul>
            </div>
            <div className="bio-card">
              <ul>
                <li>Бабушка учила её английскому <b className="red">с 5 лет.</b></li>
                <li>Решила создать школу, где английский становится частью жизни и <b className="red">учится с удовольствием.</b> В планах — выход на новый уровень: обучать сотрудников компаний, <b className="red">помогать бизнесу расти</b> через английский.</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="tags">
          <span className="tag-name">Валерия, 29 лет</span>
          <span className="tag-mission"><span className="mi">миссия</span>учить языку в лёгкости</span>
        </div>
      </section>

      {/* ============ FREE FIRST LESSON ============ */}
      <section className="raw2-free">
        <div className="wrap">
          <div className="badge-wrap">
            <span className="badge-title badge-title--outline">Первое <span className="c-red">бесплатное</span> занятие</span>
          </div>
          <div className="bento">
            {FREE_CARDS.map((c, i) => (
              <div className={`raw2-pcard ${c.cls}`} key={i} style={{ backgroundImage: `url(/landing/raw2/${c.img})` }}>
                <div className="overlay">{c.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="price" className="raw2-price" style={{ backgroundImage: "url(/landing/raw2/pricing-bg.jpg)" }}>
        <div className="wrap">
          <div className="badge-wrap">
            <span className="badge-title badge-title--outline">Цены</span>
          </div>
          <div className="cards">
            {PRICES.map((p) => (
              <article className={`raw2-prc ${p.hot ? "raw2-prc--hot" : ""}`} key={p.title}>
                <h3>{p.title}</h3>
                <ul>{p.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                <span className="price">{p.hot && <span className="fire">🔥</span>}{p.price}{p.hot && <span className="fire">🔥</span>}</span>
              </article>
            ))}
          </div>
          <div className="cta-wrap">
            <a href={CONTACT_HREF} className="btn btn-red">Выучить английский</a>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="raw2-faq">
        <img src="/landing/raw2/mascot-r.svg" alt="" aria-hidden className="mascot" />
        <div className="wrap">
          <div className="badge-wrap">
            <span className="badge-title badge-title--outline-lime">Популярные вопросы</span>
          </div>
          <div className="raw2-faq-list">
            {FAQ.map((f, i) => (
              <div className={`raw2-faq-item ${openFaq === i ? "open" : ""}`} key={i}>
                <button className="raw2-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  {f.q}<Chevron />
                </button>
                {openFaq === i && <div className="raw2-faq-a">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CONTACT ============ */}
      <section id="contact" className="raw2-contact">
        <img src="/landing/raw2/raw-watermark.svg" alt="" aria-hidden className="watermark" />
        <div className="wrap">
          {!sent && <h2>Оставь свои данные, чтобы могли связаться с тобой</h2>}
          {sent ? (
            <div className="raw2-sent">
              <p className="raw2-sent-msg">
                Спасибо!<br />
                Ваша заявка принята, <b>мы свяжемся с вами</b> в ближайшее время.
              </p>
              <button type="button" className="btn btn-red" onClick={() => setSent(false)}>Ок</button>
            </div>
          ) : (
            <form className="raw2-form" onSubmit={onSubmit}>
              <input type="text" name="name" placeholder="имя" required />
              <input type="email" name="email" placeholder="электронная почта" required />
              <input type="tel" name="phone" placeholder="номер телефона" required />
              <div className="submit-row"><button type="submit" className="btn btn-red">Отправить</button></div>
              <p className="consent">Соглашаясь отправить, вы даёте согласие на обработку персональных данных.</p>
            </form>
          )}
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="raw2-footer">
        <div className="wrap">
          <div className="inner">
            <div className="fcol fcol-links">
              <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="tg"><TgIcon />Telegram</a>
              <a href={CONTACT_HREF}>Связаться</a>
              <Link href="/oferta">Договор-оферта</Link>
              <Link href="/privacy">Политика конфиденциальности</Link>
            </div>
            <div className="fcol-center">
              <a href={CONTACT_HREF} className="btn btn-red">Выучить английский</a>
              <p className="copy">By V. Kratkovskaya © 2026</p>
            </div>
            <div className="legal">
              <b>ИП Кратковская Валерия Витальевна</b>
              ОГРНИП: 325619600134369<br />
              ИНН: 616485783606
            </div>
          </div>
        </div>
      </footer>

      {/* ============ LOGIN POPUP (Ученик / Учитель) ============ */}
      {loginOpen && (
        <div className="raw2-modal-overlay" onClick={() => setLoginOpen(false)}>
          <div className="raw2-login" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button type="button" className="raw2-login-close" onClick={() => setLoginOpen(false)} aria-label="Закрыть">×</button>
            <div className="raw2-login-tabs">
              <button type="button" className={loginRole === "student" ? "active" : ""} onClick={() => setLoginRole("student")}>Ученик</button>
              <button type="button" className={loginRole === "teacher" ? "active" : ""} onClick={() => setLoginRole("teacher")}>Учитель</button>
            </div>
            <form className="raw2-login-form" onSubmit={onLogin}>
              <input name="email" type="email" placeholder="электронная почта" required autoComplete="email" />
              <input name="password" type="password" placeholder="пароль" required autoComplete="current-password" />
              {loginErr && <p className="raw2-login-err">{loginErr}</p>}
              <button type="submit" className="btn btn-red" disabled={loginBusy}>{loginBusy ? "Входим…" : "Войти"}</button>
              <Link href="/register" className="raw2-login-reg">Регистрация</Link>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
