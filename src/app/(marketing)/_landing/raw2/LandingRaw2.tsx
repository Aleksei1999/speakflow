"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_MIN } from "@/lib/validations";
import RoastQuiz from "./RoastQuiz";
import { ArrowIcon } from "@/components/icons/ArrowIcon";

/* ------------------------------------------------------------------
   RAW ENGLISH — new landing (Figma "Главная RAW english")
   Faithful rebuild of the 10-section design. Styles: /landing/raw2/raw2.css
   Photos: /landing/raw2/*.jpg (exported from Figma)
   ------------------------------------------------------------------ */

const CONTACT_HREF = "#contact";

/* ---------- inline icons ---------- */
/**
 * Filled стрелка ← / → как в pill-arrow дашборда (Figma node 4140:86).
 * Использует единый ArrowIcon (37×37), CSS-размер через .btn-arrow / .disc.
 */
const ArrowRightFilled = () => (
  <ArrowIcon direction="right" size="100%" />
);
const Chevron = () => (
  <svg width="30" height="20" viewBox="0 0 30 20" fill="none" className="chev" aria-hidden>
    <path d="M3 4.5 15 15.5 27 4.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ---------- data ---------- */
const FEATURES = [
  { icon: "ic-bubble.svg", iconActive: "ic-bubble-red.svg", title: <>Разговорные<br />клубы</>, body: <>Speaking club<br /><b>с носителями</b><br />каждый день.</> },
  { icon: "ic-cv-black.png", iconActive: "ic-cv.png", title: <>CV / резюме</>, body: <>Составляем резюме<br />на английском<br /><b>вместе с вами</b><br />для трудоустройства.</> },
  { icon: "ic-cap.png", iconActive: "ic-cap-red.png", title: <>Индивидуальные<br />уроки</>, body: <>Никаких больших<br />групп. Всё внимание —<br /><b>только вам.</b></> },
  { icon: "ic-psy.svg", iconActive: "ic-psy-red.svg", title: <>Работа<br />с психологом</>, body: <>Преодолевай<br />языковой барьер,<br /><b>избавляйся<br />от страха</b><br />со специалистом.</> },
  { icon: "ic-lecture.png", iconActive: "ic-lecture-red.png", title: <>Лекции</>, body: <>Развивайся<br /><b>в профессии и хобби</b><br />с нашими лекциями<br />на английском языке.</> },
];

const FREE_CARDS = [
  { img: "ff-video.jpg", cls: "raw2-pcard--tall", text: <>Получи первое<br />занятие <b>полностью<br />бесплатно</b></> },
  { img: "ff-tennis.jpg", cls: "", text: <><b>Выстроим план</b><br />обучения исходя<br />из твоих интересов<br />и хобби</> },
  { img: "ff-chat.jpg", cls: "", text: <>Подберем для тебя<br /><b>идеального<br />преподавателя</b></> },
  { img: "ff-hoodie.jpg", cls: "raw2-pcard--wide", text: <><b>Замотивируем тебя</b><br />продолжать путь<br />в изучении английского</> },
];

const PRICES = [
  {
    title: "Занятия", hot: false, price: "от 2.000 ₽",
    items: [<>Занятия<br /><b>один на один</b><br />с преподавателем</>, <>Один или полтора<br />часа <b>на выбор</b></>, <>Адаптивное<br />изучение<br /><b>под ваши цели</b></>],
  },
  {
    title: "Группы", hot: false, price: "1.800 ₽",
    items: [<>Поддержка группы<br /><b>помогает</b><br />продолжать<br />заниматься</>, <>Успехи других<br /><b>мотивируют</b><br />двигаться дальше<br />и быстрее</>, <>Вместе учиться<br />интереснее<br /><b>и эффективнее</b></>],
  },
  {
    title: <>Разговорный клуб<br />с носителями<br />языка</>, hot: true, price: "1.500 ₽",
    items: [<><b>Ускорь обучение</b><br />непринужденным форматом</>, <><b>Открой доступ</b> к игровому<br />формату обучения, клубам<br />и призам</>, <><b>Разнообразь обучение</b><br />новым функционалом</>],
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
  const [quizOpen, setQuizOpen] = useState(false);

  // login / registration popup (Ученик / Учитель)
  const [loginOpen, setLoginOpen] = useState(false);
  // Модалка «Форма для связи» (Figma 2522:2375) — открывается с CTA «Выучить английский» и «Связаться».
  const [ctaOpen, setCtaOpen] = useState(false);
  const [ctaBusy, setCtaBusy] = useState(false);
  const [ctaErr, setCtaErr] = useState("");
  const [ctaValid, setCtaValid] = useState(false);
  const [ctaPhone, setCtaPhone] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginRole, setLoginRole] = useState<"student" | "teacher">("student");
  const [loginErr, setLoginErr] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [registerCheckEmail, setRegisterCheckEmail] = useState("");

  function openAuth() {
    setAuthMode("login");
    setLoginErr("");
    setLoginOpen(true);
  }

  async function onRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginErr("");
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") || "");
    if (password.length < PASSWORD_MIN) {
      setLoginErr(`Пароль должен быть не короче ${PASSWORD_MIN} символов`);
      return;
    }
    if (password !== String(data.get("password2") || "")) {
      setLoginErr("Пароли не совпадают");
      return;
    }
    if (!data.get("agree")) {
      setLoginErr("Нужно согласие на обработку данных");
      return;
    }
    setLoginBusy(true);
    const email = String(data.get("email") || "").trim();
    try {
      const supabase = createClient();
      const { data: res, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: String(data.get("first_name") || "").trim(),
            last_name: String(data.get("last_name") || "").trim(),
            role: loginRole,
            marketing_opt_in: !!data.get("marketing"),
          },
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/api/auth/callback` : undefined,
        },
      });
      if (error) {
        setLoginErr(error.message.includes("already") ? "Такой email уже зарегистрирован" : "Не удалось зарегистрироваться");
        setLoginBusy(false);
        return;
      }
      // Если у Supabase включено «Confirm email» — сессии ещё нет, юзеру ушла
      // ссылка подтверждения. Показываем «проверьте почту», не редиректим,
      // иначе middleware выкинет обратно на логин и это выглядит как баг.
      if (!res?.session) {
        setRegisterCheckEmail(email);
        setLoginBusy(false);
        return;
      }
      window.location.href = loginRole === "teacher" ? "/teacher" : "/student";
    } catch {
      setLoginErr("Не удалось зарегистрироваться. Попробуйте позже.");
      setLoginBusy(false);
    }
  }

  // Макет нарисован под 1441px. На экранах шире масштабируем весь лендинг пропорционально
  // (zoom = ширина / 1441, потолок 1.4), чтобы пропорции совпадали с Figma на больших мониторах.
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      const z = w > 1441 ? Math.min(w / 1441, 1.4) : 1;
      document.documentElement.style.setProperty("--raw2-zoom", z.toFixed(4));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  useEffect(() => {
    if (!loginOpen && !ctaOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setLoginOpen(false); setCtaOpen(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loginOpen, ctaOpen]);

  function openCta(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    setCtaErr("");
    setCtaOpen(true);
  }

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
  // ignore programmatic scroll for wrap-decisions until this timestamp;
  // otherwise the wrap fires mid-animation and cancels the smooth scroll.
  const wrapMuteUntilRef = useRef(0);

  function carCards() {
    const el = carRef.current;
    if (!el) return null;
    return Array.from(el.querySelectorAll<HTMLElement>(".raw2-fcard"));
  }
  function stepWidth(cards: HTMLElement[]) {
    if (cards.length < 2) return 0;
    return cards[1].offsetLeft - cards[0].offsetLeft;
  }
  function copyWidth(cards: HTMLElement[]) {
    return stepWidth(cards) * FEATURES.length;
  }
  function onCarScroll() {
    const el = carRef.current;
    const cards = carCards();
    if (!el || !cards) return;
    const copyW = copyWidth(cards);
    // Wrap ONLY for user-driven scroll — never during a smooth programmatic jump.
    if (copyW > 0 && performance.now() > wrapMuteUntilRef.current) {
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
    const step = stepWidth(cards) || el.clientWidth * 0.8;
    const copyW = copyWidth(cards);
    // Rebase into the middle copy BEFORE animating, so the smooth scroll target
    // never crosses the wrap boundary (which would cause a visible snap-back).
    if (copyW > 0) {
      let base = el.scrollLeft;
      const nextTarget = base + dir * step;
      if (nextTarget > copyW * 1.5) base -= copyW;
      else if (nextTarget < copyW * 0.5) base += copyW;
      if (base !== el.scrollLeft) el.scrollLeft = base; // instant, no CSS smooth
    }
    // Mute wrap for the duration of the smooth animation.
    wrapMuteUntilRef.current = performance.now() + 500;
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

  // Phone masks per country. Fallback = generic international.
  const PHONE_CONFIGS: Record<string, { code: string; mask: string; digits: number; placeholder: string }> = {
    RU: { code: '+7',   mask: '(###) ###-##-##',    digits: 10, placeholder: '+7 (999) 123-45-67' },
    KZ: { code: '+7',   mask: '(###) ###-##-##',    digits: 10, placeholder: '+7 (700) 123-45-67' },
    US: { code: '+1',   mask: '(###) ###-####',     digits: 10, placeholder: '+1 (555) 123-4567' },
    CA: { code: '+1',   mask: '(###) ###-####',     digits: 10, placeholder: '+1 (416) 123-4567' },
    UA: { code: '+380', mask: '(##) ###-##-##',     digits: 9,  placeholder: '+380 (44) 123-45-67' },
    BY: { code: '+375', mask: '(##) ###-##-##',     digits: 9,  placeholder: '+375 (29) 123-45-67' },
    GB: { code: '+44',  mask: '#### ######',        digits: 10, placeholder: '+44 7911 123456' },
    DE: { code: '+49',  mask: '### #######',        digits: 10, placeholder: '+49 151 23456789' },
    FR: { code: '+33',  mask: '# ## ## ## ##',      digits: 9,  placeholder: '+33 6 12 34 56 78' },
    IT: { code: '+39',  mask: '### ### ####',       digits: 10, placeholder: '+39 320 123 4567' },
    ES: { code: '+34',  mask: '### ### ###',        digits: 9,  placeholder: '+34 612 345 678' },
    DEFAULT: { code: '+', mask: '###############', digits: 15, placeholder: '+123456789012345' },
  };

  function detectCountry(): string {
    if (typeof navigator === 'undefined') return 'RU';
    const langs = [navigator.language, ...(navigator.languages || [])];
    for (const l of langs) {
      const region = (l.split('-')[1] || '').toUpperCase();
      if (region && PHONE_CONFIGS[region]) return region;
    }
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (/Moscow|Kaliningrad|Samara|Yekaterinburg|Novosibirsk|Vladivostok/i.test(tz)) return 'RU';
      if (/New_York|Los_Angeles|Chicago|Denver|Anchorage|Honolulu/i.test(tz)) return 'US';
      if (/Toronto|Vancouver|Montreal/i.test(tz)) return 'CA';
      if (/London/i.test(tz)) return 'GB';
      if (/Berlin|Frankfurt/i.test(tz)) return 'DE';
      if (/Paris/i.test(tz)) return 'FR';
      if (/Kiev|Kyiv/i.test(tz)) return 'UA';
      if (/Minsk/i.test(tz)) return 'BY';
      if (/Almaty|Aqtobe/i.test(tz)) return 'KZ';
    } catch {}
    return 'RU';
  }

  const [phoneCountry, setPhoneCountry] = useState<string>('RU');
  const [phoneValue, setPhoneValue] = useState<string>('');
  useEffect(() => { setPhoneCountry(detectCountry()); }, []);

  const phoneCfg = PHONE_CONFIGS[phoneCountry] || PHONE_CONFIGS.DEFAULT;

  function formatPhone(rawDigits: string): string {
    const digits = rawDigits.slice(0, phoneCfg.digits);
    let out = phoneCfg.code + ' ';
    let d = 0;
    for (const ch of phoneCfg.mask) {
      if (d >= digits.length) break;
      if (ch === '#') { out += digits[d++]; } else { out += ch; }
    }
    return out;
  }

  function normalizePhoneInput(value: string): string {
    // Оставляем только цифры, отбрасываем всё лишнее (включая код страны)
    let digits = value.replace(/\D/g, '');
    // Если начинается с кода страны — срезаем
    const codeDigits = phoneCfg.code.replace(/\D/g, '');
    if (codeDigits && digits.startsWith(codeDigits)) digits = digits.slice(codeDigits.length);
    return formatPhone(digits);
  }
  function onPhoneChange(e: ChangeEvent<HTMLInputElement>) { setPhoneValue(normalizePhoneInput(e.target.value)); }
  function onCtaPhoneChange(e: ChangeEvent<HTMLInputElement>) { setCtaPhone(normalizePhoneInput(e.target.value)); }
  function isPhoneComplete(value: string): boolean {
    const digits = value.replace(/\D/g, '').slice(phoneCfg.code.replace(/\D/g, '').length);
    return digits.length === phoneCfg.digits;
  }

  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  // Валидность лид-формы: submit disabled пока не заполнены обязательные поля.
  const [contactValid, setContactValid] = useState(false);
  // Валидности форм логина/регистрации.
  const [loginValid, setLoginValid] = useState(false);
  const [registerValid, setRegisterValid] = useState(false);

  // Если пользователь прошёл квиз в этой же сессии — прицепим результат,
  // чтобы бек создал level_tests-строку с этим email.
  // log[] нужен админке (AdminRawDashboard рендерит вопросы+варианты).
  type QuizLog = { text: string; options: string[]; chosen: number; correct: number; lvl?: 1 | 2 | 3 };
  type RoastQuizPayload = { level: string; tierScores: [number, number, number]; log?: QuizLog[] };
  function readRoastQuiz(): RoastQuizPayload | undefined {
    try {
      const raw = sessionStorage.getItem('raw2_roast_quiz');
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { level: string; tierScores: [number, number, number]; log?: QuizLog[]; ts: number };
      // 2ч TTL — старые результаты не приклеиваем к новым заявкам.
      if (parsed?.level && Array.isArray(parsed.tierScores) && Date.now() - (parsed.ts || 0) < 2 * 60 * 60 * 1000) {
        const q: RoastQuizPayload = { level: parsed.level, tierScores: parsed.tierScores };
        if (Array.isArray(parsed.log) && parsed.log.length > 0) q.log = parsed.log;
        return q;
      }
    } catch {}
    return undefined;
  }

  // Общая отправка лида для секции #contact и модалки «Форма для связи».
  // Возвращает текст ошибки или null при успехе.
  async function postLead(payload: { name: string; email: string; phone: string; marketing_opt_in: boolean; comment?: string; source: string }): Promise<string | null> {
    const roastQuiz = readRoastQuiz();
    try {
      const res = await fetch('/api/landing/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, country: phoneCountry, ...(roastQuiz ? { roast_quiz: roastQuiz } : {}) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return j?.error || 'Не удалось отправить. Попробуй ещё раз.';
      }
      // Одноразовый прикреп: не приклеим тот же тест к следующему сабмиту.
      try { sessionStorage.removeItem('raw2_roast_quiz'); } catch {}
      return null;
    } catch {
      return 'Проблема с сетью. Попробуй ещё раз.';
    }
  }

  // Клиентская валидация email/телефона с подсветкой полей; true если всё ок.
  function validateLeadForm(form: HTMLFormElement, email: string, phone: string): boolean {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    const phoneOk = isPhoneComplete(phone);
    const emailInput = form.querySelector('input[name="email"]') as HTMLInputElement | null;
    const phoneInput = form.querySelector('input[name="phone"]') as HTMLInputElement | null;
    emailInput?.classList.toggle('invalid', !emailOk);
    phoneInput?.classList.toggle('invalid', !phoneOk);
    if (!emailOk || !phoneOk) { (emailOk ? phoneInput : emailInput)?.focus(); return false; }
    return true;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitErr('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const marketing = fd.get('marketing') === 'on';
    if (!validateLeadForm(form, email, phoneValue)) return;

    setSubmitBusy(true);
    const err = await postLead({ name, email, phone: phoneValue, marketing_opt_in: marketing, source: 'landing_raw2' });
    setSubmitBusy(false);
    if (err) { setSubmitErr(err); return; }
    form.reset();
    setPhoneValue('');
    setSent(true);
  }

  async function onCtaSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCtaErr('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const comment = String(fd.get('comment') || '').trim();
    if (!validateLeadForm(form, email, ctaPhone)) return;

    setCtaBusy(true);
    const err = await postLead({ name, email, phone: ctaPhone, marketing_opt_in: false, ...(comment ? { comment } : {}), source: 'landing_raw2_modal' });
    setCtaBusy(false);
    if (err) { setCtaErr(err); return; }
    form.reset();
    setCtaPhone('');
    setCtaOpen(false);
    setSent(true);
  }

  return (
    <div className="raw2">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/landing/raw2/raw2.css?v=20260907-zoom" />

      {/* ============ NAV ============ */}
      <nav className="raw2-nav">
        <Link href="/" className="brand" aria-label="Raw English">
          <img src="/landing/raw2/logo-raw-word.svg" alt="Raw English" className="logo-img" />
        </Link>
        <ul className="nav-links">
          <li><a href="#system">Методика</a></li>
          <li><a href="#founder">Преподаватели</a></li>
          <li><a href="#price">Стоимость</a></li>
          <li><a href="#" onClick={(e) => { e.preventDefault(); setQuizOpen(true); }}>Пройти тест</a></li>
          <li><a href={CONTACT_HREF} onClick={openCta}>Выучить английский</a></li>
        </ul>
        <div className="nav-actions">
          <button type="button" className="pill pill-red" onClick={openAuth}>Личный кабинет</button>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="raw2-hero" style={{ backgroundImage: "url(/landing/raw2/hero.webp)" }}>
        <div className="wrap">
          <div className="glass">
            <h1>Преврати<br />сырой английский<br />в <span className="c-lime">сочный<br />разговорный</span></h1>
            <p className="lede">Без скуки, без зубрёжки,<br />в компании таких же голодных<br />до языка людей.</p>
            <button type="button" className="cta-red" onClick={() => setQuizOpen(true)}>
              <span className="free">бесплатно</span>
              Узнай свой<br />уровень прожарки
            </button>
            <div className="cta-row">
              <button type="button" className="btn btn-lime" onClick={() => setQuizOpen(true)}>пройти тест</button>
              <button type="button" className="btn btn-arrow" onClick={() => setQuizOpen(true)} aria-label="Пройти тест"><ArrowRightFilled /></button>
            </div>
          </div>
        </div>
        <div className="bubble">Ты пройдёшь путь от страха сказать слово до умения шутить на английском.</div>
      </header>

      {/* ============ SYSTEM ============ */}
      <section id="system" className="raw2-system">
        <div className="wrap">
          <div className="badge-wrap">
            <span className="badge-title badge-title--outline-lime" style={{ borderRadius: "41.5px", border: "4px solid #DFED8C", color: "#1E1E1E" }}>
              Система, в которую заходишь <span className="c-red">с пользой</span>:
            </span>
          </div>
        </div>
        <div className="raw2-carousel-outer">
          <button type="button" className="raw2-car-nav prev" onClick={() => scrollCards(-1)} aria-label="Назад">
            <span className="notch" aria-hidden />
            <span className="disc"><ArrowIcon direction="left" size="100%" /></span>
          </button>
          <div className="raw2-carousel-clip">
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
          </div>
          <button type="button" className="raw2-car-nav next" onClick={() => scrollCards(1)} aria-label="Вперёд">
            <span className="notch" aria-hidden />
            <span className="disc"><ArrowRightFilled /></span>
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
              <p className="desc">Пройди 12 вопросов и узнай свою прожарку.<br />Помоги Стейку стать <b>well done</b> -<br />он очень волнуется.</p>
            </div>
            <div className="right">
              <div className="metrics">
                <div className="metric"><span className="mi"><img src="/landing/raw2/ic-q-red.svg" alt="" /></span><div><b>12</b><span>вопросов</span></div></div>
                <div className="metric"><span className="mi"><img src="/landing/raw2/ic-heart-red.svg" alt="" /></span><div><b>3</b><span>жизни</span></div></div>
                <div className="metric"><span className="mi"><img src="/landing/raw2/ic-timer-red.svg" alt="" /></span><div><b>2</b><span>мин времени</span></div></div>
              </div>
              <p className="subnote">Узнай, на каком ты уровне прямо сейчас -<br />и получи персональный план прожарки.</p>
              <button type="button" className="btn btn-red" onClick={() => setQuizOpen(true)}>Начать игру!</button>
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
            <div className="bio-card bio-green">
              <ul>
                <li>Два высших<br />образования:<br />маркетинг,<br />в университете<br /><b className="lime">Хартфордшира,<br />Великобритания</b><br />и филологический<br />факультет<br />педагогического<br />направления<br />в <b className="lime">Южном<br />федеральном<br />университете.</b></li>
                <li>Начинала преподавать<br />по объявлению, затем работала<br /><b className="lime">в самой популярной школе</b> английского<br />в Ростове.</li>
              </ul>
            </div>
            <div className="bio-col">
              <div className="bio-card bio-green">
                <ul>
                  <li>Бабушка учила<br />её английскому<br /><b className="lime">с 5 лет.</b></li>
                </ul>
              </div>
              <div className="bio-card bio-dark">
                <ul>
                  <li>Решила создать<br />школу, где<br />английский<br />становится частью<br />жизни и <b className="red">учится с<br />удовольствием.</b></li>
                  <li>В планах — выход<br />на новый уровень:<br />обучать<br />сотрудников<br />компаний, <b className="red">помогать<br />бизнесу расти</b><br />через английский.</li>
                </ul>
              </div>
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
              <article className={`raw2-prc ${p.hot ? "raw2-prc--hot" : ""}`} key={p.price}>
                <h3>{p.title}</h3>
                <ul>{p.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                <span className="price-wrap">
                  {p.hot && <img src="/landing/raw2/fire.svg" className="fire" alt="" />}
                  <span className="price">{p.price}</span>
                  {p.hot && <img src="/landing/raw2/fire.svg" className="fire fire-r" alt="" />}
                </span>
              </article>
            ))}
          </div>
          <div className="cta-wrap">
            <a href={CONTACT_HREF} className="btn btn-red" onClick={openCta}>ВЫУЧИТЬ АНГЛИЙСКИЙ</a>
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
                  <span>{f.q}</span>
                </button>
                {openFaq === i && (
                  <div className="raw2-faq-a">
                    <span className="raw2-faq-a-text">{f.a}</span>
                    <svg viewBox="0 0 48 22" fill="none" className="chev-down" aria-hidden>
                      <path d="M4.00037 4.00049L24.0004 18.0005L44.0004 4.00049" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CONTACT ============ */}
      <section id="contact" className="raw2-contact">
        <img src="/landing/raw2/raw-watermark.svg" alt="" aria-hidden className="watermark" />
        <div className="wrap">
          <h2>Оставь свои данные,<br />чтобы могли связаться с тобой</h2>
          <form
            className="raw2-form"
            onSubmit={onSubmit}
            onChange={(e) => setContactValid(e.currentTarget.checkValidity())}
            onInput={(e) => setContactValid(e.currentTarget.checkValidity())}
          >
            <input type="text" name="name" placeholder="имя" required />
            <input type="email" name="email" placeholder="электронная почта" required />
            <input type="tel" name="phone" placeholder="номер телефона" value={phoneValue} onChange={onPhoneChange} inputMode="tel" autoComplete="tel" required />
            <label className="raw2-check"><input type="checkbox" name="agree" required /><span>Подтверждаю согласие с <Link href="/oferta" target="_blank" rel="noopener noreferrer">пользовательским соглашением</Link>.</span></label>
            <label className="raw2-check"><input type="checkbox" name="marketing" /><span>Согласен получать рекламные материалы</span></label>
            {submitErr && <p className="raw2-form-err">{submitErr}</p>}
            <div className="submit-row"><button type="submit" className={`btn btn-red${submitBusy ? " busy" : ""}`} disabled={submitBusy || !contactValid} aria-busy={submitBusy}>Отправить</button></div>
            <p className="raw2-form-consent">Нажимая “отправить” вы даёте своё согласие<br />на обработку персональных данных.</p>
          </form>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="raw2-footer">
        <div className="wrap">
          <div className="inner">
            <div className="fcol fcol-links">
              <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="tg"><img src="/landing/raw2/ic-telegram.svg" alt="" aria-hidden />Telegram</a>
              <a href={CONTACT_HREF} className="fmut" onClick={openCta}>Связаться</a>
              <Link href="/oferta" className="fmut">Договор-оферта</Link>
              <Link href="/privacy" className="fmut">Политика конфиденциальности</Link>
            </div>
            <div className="fcol-center">
              <a href={CONTACT_HREF} className="btn btn-red" onClick={openCta}>ВЫУЧИТЬ АНГЛИЙСКИЙ</a>
              <p className="copy">By V. Kratkovskaya © 2026</p>
            </div>
            <div className="legal">
              <span>ИП Кратковская</span>
              <span>Валерия Витальевна</span>
              <span>ОГРНИП: 325619600134369</span>
              <span>ИНН: 616485783606</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ============ LOGIN POPUP (Ученик / Учитель) ============ */}
      {loginOpen && (
        <div className="raw2-modal-overlay" onClick={() => setLoginOpen(false)}>
          <div className="raw2-login" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">

            {authMode === "login" ? (
              <>
                <div className="raw2-login-tabs">
                  <button type="button" className={loginRole === "student" ? "active" : ""} onClick={() => setLoginRole("student")}>Ученик</button>
                  <button type="button" className={loginRole === "teacher" ? "active" : ""} onClick={() => setLoginRole("teacher")}>Учитель</button>
                </div>
                <form
                  className="raw2-login-form"
                  onSubmit={onLogin}
                  onChange={(e) => setLoginValid(e.currentTarget.checkValidity())}
                  onInput={(e) => setLoginValid(e.currentTarget.checkValidity())}
                >
                  <input name="email" type="email" placeholder="электронная почта" required autoComplete="email" />
                  <input name="password" type="password" placeholder="пароль" required autoComplete="current-password" />
                  {loginErr && <p className="raw2-login-err">{loginErr}</p>}
                  <button type="submit" className={`btn btn-red${loginBusy ? " busy" : ""}`} disabled={loginBusy || !loginValid} aria-busy={loginBusy}>Войти</button>
                  <button type="button" className="raw2-login-reg" onClick={() => { setLoginErr(""); setAuthMode("register"); }}>Регистрация</button>
                </form>
              </>
            ) : registerCheckEmail ? (
              <>
                <div className="raw2-login-title">Проверьте почту</div>
                <p className="raw2-login-check-msg">
                  Мы отправили ссылку для подтверждения на<br />
                  <b>{registerCheckEmail}</b>.<br />
                  Перейдите по ссылке из письма, чтобы войти в личный кабинет.
                </p>
                <button
                  type="button"
                  className="btn btn-red"
                  onClick={() => { setRegisterCheckEmail(""); setAuthMode("login"); }}
                >
                  Ок
                </button>
              </>
            ) : (
              <>
                <div className="raw2-login-title">Регистрация для входа в ЛК</div>
                <form
                  className="raw2-login-form"
                  onSubmit={onRegister}
                  onChange={(e) => setRegisterValid(e.currentTarget.checkValidity())}
                  onInput={(e) => setRegisterValid(e.currentTarget.checkValidity())}
                >
                  <input name="first_name" type="text" placeholder="имя" required autoComplete="given-name" />
                  <input name="last_name" type="text" placeholder="фамилия" required autoComplete="family-name" />
                  <input name="email" type="email" placeholder="электронная почта" required autoComplete="email" />
                  <input name="password" type="password" placeholder="пароль" required autoComplete="new-password" />
                  <input name="password2" type="password" placeholder="повтор пароля" required autoComplete="new-password" />
                  <button type="submit" className={`btn btn-red${loginBusy ? " busy" : ""}`} disabled={loginBusy || !registerValid} aria-busy={loginBusy}>Зарегистрироваться</button>
                  {loginErr && <p className="raw2-login-err">{loginErr}</p>}
                  <label className="raw2-check"><input type="checkbox" name="agree" /><span>Согласен с обработкой персональных данных</span></label>
                  <label className="raw2-check"><input type="checkbox" name="marketing" /><span>Согласен получать рекламные материалы</span></label>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============ CTA POPUP (Figma 2522:2375 «Форма для связи») ============ */}
      {ctaOpen && (
        <div className="raw2-modal-overlay" onClick={() => setCtaOpen(false)}>
          <div className="raw2-cta" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="raw2-cta-title">Оставь свои данные, чтобы могли связаться с тобой</h3>
            <form
              className="raw2-cta-form"
              onSubmit={onCtaSubmit}
              onChange={(e) => setCtaValid(e.currentTarget.checkValidity())}
              onInput={(e) => setCtaValid(e.currentTarget.checkValidity())}
            >
              <input name="name" type="text" placeholder="имя" required autoComplete="name" />
              <input name="email" type="email" placeholder="электронная почта" required autoComplete="email" />
              <input name="phone" type="tel" placeholder="номер телефона" value={ctaPhone} onChange={onCtaPhoneChange} inputMode="tel" autoComplete="tel" required />
              <input name="comment" type="text" placeholder="комментарий" maxLength={1000} autoComplete="off" />
              {ctaErr && <p className="raw2-form-err">{ctaErr}</p>}
              <button type="submit" className={`btn btn-red${ctaBusy ? " busy" : ""}`} disabled={ctaBusy || !ctaValid} aria-busy={ctaBusy}>Отправить</button>
              <p className="raw2-cta-consent">Соглашаясь отправить, вы даёте согласие на обработку персональных данных.</p>
            </form>
          </div>
        </div>
      )}

      {/* ============ SENT POPUP (Figma «Контакты отправлены») ============ */}
      {sent && (
        <div className="raw2-modal-overlay" onClick={() => setSent(false)}>
          <div className="raw2-sent-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <p className="raw2-sent-msg">
              Спасибо!<br />
              Ваша заявка принята, <b>мы свяжемся</b><br />
              <b>с вами</b> в ближайшее время.
            </p>
            <button type="button" className="btn btn-red" onClick={() => setSent(false)}>Ок</button>
          </div>
        </div>
      )}

      {quizOpen && <RoastQuiz onClose={() => setQuizOpen(false)} onCta={() => { setQuizOpen(false); openCta(); }} />}
    </div>
  );
}
