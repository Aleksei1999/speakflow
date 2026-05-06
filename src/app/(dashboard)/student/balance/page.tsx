"use client"

import { useEffect, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Types — billing slice of GET /api/profile/me
// ─────────────────────────────────────────────────────────────────────────────

type BalanceData = {
  profile: {
    balance_rub: number
    subscription_tier: "free" | "pro"
    subscription_until: string | null
  }
  history: Array<{
    id: string
    date: string
    title: string
    amount: number
    kind: "debit" | "credit" | "xp"
    currency: string
    status: "ok" | "pending"
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — scoped to .balance-page, theme-aware via dashboard-shell vars.
// Only billing-specific classes (bal-/topup-/sub-/history/h-/section-).
// ─────────────────────────────────────────────────────────────────────────────

const BALANCE_CSS = `
.balance-page{max-width:1000px;margin:0 auto;--gold:#B8960A;--green:#16a34a}
[data-theme="dark"] .balance-page{--gold:#FFD700;--green:#22c55e}
.balance-page *{box-sizing:border-box}

.balance-page h1{font-size:1.7rem;font-weight:800;letter-spacing:-.5px;margin-bottom:6px}
.balance-page h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.balance-page .page-sub{font-size:.85rem;color:var(--muted);margin-bottom:22px}

/* Balance hero */
.bal-card{background:#0A0A0A;border-radius:20px;padding:28px;margin-bottom:24px;position:relative;overflow:hidden;color:#fff}
.bal-card::before{content:'';position:absolute;top:-60%;right:-30%;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(230,57,70,.08),transparent 70%);pointer-events:none}
.bal-card::after{content:'';position:absolute;bottom:-40%;left:-20%;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,rgba(216,242,106,.05),transparent 70%);pointer-events:none}
.bal-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;position:relative;z-index:1}
.bal-label{font-size:.65rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px}
.bal-amount{font-size:2.5rem;font-weight:800;letter-spacing:-1.5px;line-height:1;position:relative;z-index:1}
.bal-amount span{font-size:1.2rem;font-weight:600;color:rgba(255,255,255,.5)}
.bal-sub{font-size:.72rem;color:rgba(255,255,255,.45);margin-top:6px;position:relative;z-index:1}
.bal-actions{display:flex;gap:8px;margin-top:18px;position:relative;z-index:1}
.bal-btn{padding:10px 24px;border-radius:12px;font-size:.85rem;font-weight:700;border:none;transition:all .2s;display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-family:inherit}
.bal-btn--primary{background:var(--red);color:#fff;box-shadow:0 3px 0 rgba(180,30,45,.4)}
.bal-btn--primary:hover{transform:translateY(-2px);box-shadow:0 5px 0 rgba(180,30,45,.4),0 10px 20px rgba(230,57,70,.15)}
.bal-btn--ghost{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08)}
.bal-btn--ghost:hover{background:rgba(255,255,255,.1);color:#fff}

/* Sections */
.section-title{font-size:1.1rem;font-weight:800;letter-spacing:-.3px;margin-bottom:4px}
.section-sub{font-size:.78rem;color:var(--muted);margin-bottom:16px}

/* Top-up tiers */
.topup-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px}
.topup{background:var(--surface);border:2px solid var(--border);border-radius:18px;padding:20px 16px;text-align:center;position:relative;overflow:hidden;transition:all .25s cubic-bezier(.16,1,.3,1);cursor:pointer}
.topup:hover{transform:translateY(-4px);border-color:var(--red);box-shadow:0 10px 30px var(--shadow)}
.topup--popular{border-color:var(--red)}
.topup--popular::before{content:'ПОПУЛЯРНЫЙ';position:absolute;top:0;left:0;right:0;padding:4px;background:var(--red);color:#fff;font-size:.52rem;font-weight:700;letter-spacing:1px;text-align:center}
.topup--popular .topup-body{padding-top:12px}
.topup--best{border-color:var(--lime)}
.topup--best::before{content:'ЛУЧШАЯ ЦЕНА';position:absolute;top:0;left:0;right:0;padding:4px;background:var(--lime);color:#0A0A0A;font-size:.52rem;font-weight:700;letter-spacing:1px;text-align:center}
.topup--best .topup-body{padding-top:12px}
.topup-amount{font-size:1.8rem;font-weight:800;letter-spacing:-1px;margin-bottom:2px}
.topup-lessons{margin-top:10px;padding:6px 12px;border-radius:8px;background:var(--bg);font-size:.68rem;font-weight:700;display:inline-block}
.topup-lessons b{color:var(--red)}
.topup-bonus{margin-top:8px;font-size:.65rem;font-weight:700;color:var(--lime-dark);padding:4px 10px;border-radius:6px;background:color-mix(in srgb,var(--lime) 15%,transparent);display:inline-block}
[data-theme="dark"] .topup-bonus{color:var(--lime)}
.topup-save{margin-top:6px;font-size:.6rem;color:var(--red);font-weight:700}
.topup-perprice{margin-top:6px;font-size:.58rem;color:var(--muted)}
.balance-page .topup-btn{margin-top:12px;width:100%;padding:10px;border-radius:10px;border:none;font-size:.78rem;font-weight:700;transition:all .15s;cursor:pointer;font-family:inherit}
.balance-page .topup-btn--default{background:var(--bg);color:var(--text)}
.balance-page .topup-btn--default:hover{background:var(--accent-dark);color:#fff}
.balance-page .topup-btn--red{background:var(--red);color:#fff;box-shadow:0 2px 0 rgba(180,30,45,.3)}
.balance-page .topup-btn--red:hover{filter:brightness(.9)}
.balance-page .topup-btn--lime{background:var(--lime);color:#0A0A0A;box-shadow:0 2px 0 rgba(140,180,40,.3)}
.balance-page .topup-btn--lime:hover{filter:brightness(.95)}

/* Subscription */
.sub-section{margin-bottom:32px}
.sub-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.sub-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px;position:relative;overflow:hidden}
.sub-card--pro{border-color:var(--red);box-shadow:0 2px 0 color-mix(in srgb,var(--red) 15%,transparent),0 10px 30px var(--shadow)}
.sub-card--pro::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),var(--lime))}
.sub-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.sub-name{font-size:1rem;font-weight:800}
.sub-name .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.sub-price{text-align:right}
.sub-price-val{font-size:1.3rem;font-weight:800;letter-spacing:-.5px}
.sub-price-per{font-size:.62rem;color:var(--muted)}
.sub-price--free{color:var(--muted)}
.sub-features{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
.sf{display:flex;align-items:flex-start;gap:8px;font-size:.78rem}
.sf-icon{width:20px;height:20px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.6rem;margin-top:1px}
.sf-icon--yes{background:var(--lime);color:#0A0A0A;font-weight:800}
.sf-icon--no{background:var(--bg);color:var(--muted)}
.sf-text{flex:1;line-height:1.4}
.sf-text--dim{color:var(--muted);text-decoration:line-through}
.balance-page .sub-btn{width:100%;padding:12px;border-radius:12px;border:none;font-size:.88rem;font-weight:700;transition:all .2s;cursor:pointer;font-family:inherit}
.balance-page .sub-btn--upgrade{background:var(--red);color:#fff;box-shadow:0 3px 0 rgba(180,30,45,.35)}
.balance-page .sub-btn--upgrade:hover{transform:translateY(-2px);box-shadow:0 5px 0 rgba(180,30,45,.35),0 10px 20px rgba(230,57,70,.1)}
.balance-page .sub-btn--current{background:var(--bg);color:var(--muted);cursor:default}
.balance-page .sub-btn--current:disabled{cursor:not-allowed}
.sub-warning{margin-top:16px;padding:14px 18px;border-radius:14px;background:color-mix(in srgb,var(--red) 4%,transparent);border:1px solid color-mix(in srgb,var(--red) 8%,transparent);display:flex;align-items:flex-start;gap:10px}
.sub-warning-icon{font-size:1.1rem;flex-shrink:0;margin-top:2px}
.sub-warning-text{font-size:.75rem;color:var(--text);line-height:1.5}
.sub-warning-text b{color:var(--red)}

/* History */
.history{background:var(--surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;margin-bottom:28px}
.history-head{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.history-head h3{font-size:.95rem;font-weight:800}
.h-row{display:grid;grid-template-columns:100px 1fr 120px 110px;align-items:center;gap:10px;padding:12px 20px;border-bottom:1px solid var(--border);font-size:.78rem}
.h-row:last-child{border-bottom:none}
.h-row:hover{background:var(--surface-2)}
.h-head{font-size:.62rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.h-date{color:var(--muted);font-size:.72rem}
.h-desc{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h-amount{text-align:right;font-weight:700}
.h-amount--plus{color:var(--green)}
.h-amount--minus{color:var(--red)}
.h-status{text-align:right}
.h-badge{padding:3px 8px;border-radius:6px;font-size:.6rem;font-weight:700}
.h-badge--ok{background:color-mix(in srgb,var(--green) 10%,transparent);color:var(--green)}
.h-badge--pending{background:color-mix(in srgb,var(--gold) 10%,transparent);color:var(--gold)}
.h-empty{padding:32px 20px;text-align:center;color:var(--muted);font-size:.85rem}

.bal-loading,.bal-error{padding:60px 20px;text-align:center;color:var(--muted);font-size:.95rem}
.bal-error{color:var(--red)}

@media(max-width:900px){
  .topup-grid{grid-template-columns:1fr 1fr}
  .sub-grid{grid-template-columns:1fr}
}
@media(max-width:600px){
  .bal-amount{font-size:2rem}
  .h-row{grid-template-columns:80px 1fr 90px}
  .h-status{display:none}
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Top-up tiers (config — RUB amounts align with Yookassa-friendly tiers)
// ─────────────────────────────────────────────────────────────────────────────

type TopupTier = {
  amount: number
  lessons: number
  bonus: string | null
  save: string | null
  perPrice: number
  badge: "default" | "popular" | "best"
  btnLabel: string
  btnVariant: "default" | "red" | "lime"
}

const TOPUP_TIERS: TopupTier[] = [
  { amount: 5400, lessons: 3, bonus: null, save: null, perPrice: 1800, badge: "default", btnLabel: "Пополнить", btnVariant: "default" },
  { amount: 9000, lessons: 6, bonus: "+1 урок бесплатно", save: "Экономия 1 800 ₽", perPrice: 1286, badge: "popular", btnLabel: "Пополнить", btnVariant: "red" },
  { amount: 18000, lessons: 13, bonus: "+3 урока бесплатно", save: "Экономия 5 400 ₽", perPrice: 1125, badge: "best", btnLabel: "Лучшая цена", btnVariant: "lime" },
  { amount: 36000, lessons: 28, bonus: "+8 уроков бесплатно", save: "Экономия 14 400 ₽", perPrice: 1000, badge: "default", btnLabel: "Пополнить", btnVariant: "default" },
]

const PRO_FEATURES_YES = [
  "Уроки 1-on-1 с преподавателями (с баланса)",
  "Тест уровня прожарки",
  "Расширенный профиль",
  "**Speaking Clubs** — безлимитно",
  "**Debate & Wine Clubs**",
  "**Геймификация:** XP, стрики, 6 уровней прожарки",
  "**37 ачивок** с реальными призами (мерч, скидки)",
  "**Лидерборд** — соревнуйся, побеждай, получай подарки",
  "**AI-персонализация** и план обучения",
  "**Персональные видео-уроки** после каждого занятия",
  "**Guest Pass** — приведи друга бесплатно",
  "**Чат коммьюнити** 24/7",
]

const FREE_FEATURES: Array<{ text: string; yes: boolean }> = [
  { text: "Уроки 1-on-1 с преподавателями (с баланса)", yes: true },
  { text: "Тест уровня прожарки", yes: true },
  { text: "Базовый профиль", yes: true },
  { text: "Speaking Clubs", yes: false },
  { text: "Debate & Wine Clubs", yes: false },
  { text: "Геймификация: XP, стрики, уровни", yes: false },
  { text: "Ачивки и призы", yes: false },
  { text: "Лидерборд", yes: false },
  { text: "AI-персонализация и план обучения", yes: false },
  { text: "Персональные видео-уроки", yes: false },
  { text: "Guest Pass для друга", yes: false },
  { text: "Чат коммьюнити 24/7", yes: false },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatRub(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n)
}

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
const MONTHS_FULL = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]

function formatDate(iso: string | null, mode: "short" | "full" = "short"): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const day = d.getDate()
  const month = mode === "full" ? MONTHS_FULL[d.getMonth()] : MONTHS_SHORT[d.getMonth()]
  const year = d.getFullYear()
  const now = new Date()
  return mode === "full" && year !== now.getFullYear() ? `${day} ${month} ${year}` : `${day} ${month}`
}

function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1]
  return forms[2]
}

function renderBold(text: string): React.ReactNode[] {
  // Replaces **word** chunks with <b>word</b>
  const parts = text.split(/\*\*/)
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentBalancePage() {
  const [data, setData] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/profile/me", { cache: "no-store" })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? "Не удалось загрузить баланс")
        }
        const json = (await res.json()) as BalanceData
        if (!cancelled) setData(json)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Ошибка загрузки")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleTopup = (amount: number) => {
    // TODO: wire Yookassa create-payment flow with purpose='topup'
    window.alert(`Пополнение на ${formatRub(amount)} ₽ скоро будет доступно. Мы уже прикручиваем Yookassa.`)
  }

  const handleUpgrade = () => {
    window.alert("Подписка Raw Pro скоро будет доступна. Мы уже прикручиваем Yookassa.")
  }

  if (loading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: BALANCE_CSS }} />
        <div className="balance-page">
          <h1>
            Мой <span className="gl">balance</span>
          </h1>
          <div className="bal-loading">Загружаем баланс…</div>
        </div>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: BALANCE_CSS }} />
        <div className="balance-page">
          <h1>
            Мой <span className="gl">balance</span>
          </h1>
          <div className="bal-error">{error ?? "Баланс недоступен"}</div>
        </div>
      </>
    )
  }

  const { profile, history } = data
  const isPro = profile.subscription_tier === "pro"

  const balanceSubParts: string[] = []
  const lessonsFromBalance = Math.floor((profile.balance_rub ?? 0) / 1800)
  if (lessonsFromBalance > 0) {
    balanceSubParts.push(`≈ ${lessonsFromBalance} ${plural(lessonsFromBalance, ["урок", "урока", "уроков"])} по 1 800 ₽`)
  } else {
    balanceSubParts.push("Пополните, чтобы оплачивать уроки")
  }
  if (isPro && profile.subscription_until) {
    balanceSubParts.push(`Подписка активна до ${formatDate(profile.subscription_until, "full")}`)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BALANCE_CSS }} />
      <div className="balance-page">
        <h1>
          Мой <span className="gl">balance</span>
        </h1>
        <div className="page-sub">
          Пополняй баланс, оплачивай уроки и клубы, отслеживай историю платежей.
        </div>

        {/* BALANCE */}
        <div className="bal-card">
          <div className="bal-top">
            <div className="bal-label">Баланс</div>
          </div>
          <div className="bal-amount">
            {formatRub(profile.balance_rub ?? 0)} <span>₽</span>
          </div>
          <div className="bal-sub">{balanceSubParts.join(" · ")}</div>
          <div className="bal-actions">
            <button
              className="bal-btn bal-btn--primary"
              type="button"
              onClick={() => document.getElementById("topup")?.scrollIntoView({ behavior: "smooth" })}
            >
              Пополнить баланс
            </button>
            <button
              className="bal-btn bal-btn--ghost"
              type="button"
              onClick={() => document.getElementById("history")?.scrollIntoView({ behavior: "smooth" })}
            >
              История платежей
            </button>
          </div>
        </div>

        {/* TOPUP */}
        <div id="topup">
          <div className="section-title">Пополнить баланс</div>
          <div className="section-sub">
            Баланс используется для оплаты уроков и клубов. Чем больше пополняешь — тем выгоднее.
          </div>
        </div>

        <div className="topup-grid">
          {TOPUP_TIERS.map((t) => {
            const cls =
              t.badge === "popular" ? "topup topup--popular" : t.badge === "best" ? "topup topup--best" : "topup"
            const btnCls =
              t.btnVariant === "red" ? "topup-btn topup-btn--red" : t.btnVariant === "lime" ? "topup-btn topup-btn--lime" : "topup-btn topup-btn--default"
            return (
              <div key={t.amount} className={cls} onClick={() => handleTopup(t.amount)}>
                <div className="topup-body">
                  <div className="topup-amount">{formatRub(t.amount)} ₽</div>
                  <div className="topup-lessons">
                    ≈ <b>{t.lessons}</b> {plural(t.lessons, ["урок", "урока", "уроков"])}
                  </div>
                  {t.bonus && <div className="topup-bonus">{t.bonus}</div>}
                  {t.save && <div className="topup-save">{t.save}</div>}
                  <div className="topup-perprice">{formatRub(t.perPrice)} ₽ / урок</div>
                  <button
                    className={btnCls}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTopup(t.amount)
                    }}
                  >
                    {t.btnLabel}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* SUBSCRIPTION */}
        <div className="sub-section">
          <div className="section-title">Подписка на платформу</div>
          <div className="section-sub">
            Подписка открывает геймификацию, клубы, ачивки и призы. Уроки оплачиваются отдельно с баланса.
          </div>

          <div className="sub-grid">
            <div className="sub-card">
              <div className="sub-head">
                <div className="sub-name">Без подписки</div>
                <div className="sub-price">
                  <div className="sub-price-val sub-price--free">0 ₽</div>
                  <div className="sub-price-per">бесплатно</div>
                </div>
              </div>
              <div className="sub-features">
                {FREE_FEATURES.map((f, i) => (
                  <div key={i} className="sf">
                    <div className={f.yes ? "sf-icon sf-icon--yes" : "sf-icon sf-icon--no"}>{f.yes ? "✓" : "✗"}</div>
                    <div className={f.yes ? "sf-text" : "sf-text sf-text--dim"}>{f.text}</div>
                  </div>
                ))}
              </div>
              {!isPro ? (
                <button className="sub-btn sub-btn--current" type="button" disabled>
                  Текущий план
                </button>
              ) : (
                <button
                  className="sub-btn sub-btn--current"
                  type="button"
                  onClick={() => window.alert("Для отмены подписки напишите в поддержку.")}
                >
                  Перейти на бесплатный
                </button>
              )}
            </div>

            <div className="sub-card sub-card--pro">
              <div className="sub-head">
                <div className="sub-name">
                  <span className="gl">Raw</span> Pro
                </div>
                <div className="sub-price">
                  <div className="sub-price-val">1 490 ₽</div>
                  <div className="sub-price-per">/ месяц</div>
                </div>
              </div>
              <div className="sub-features">
                {PRO_FEATURES_YES.map((t, i) => (
                  <div key={i} className="sf">
                    <div className="sf-icon sf-icon--yes">✓</div>
                    <div className="sf-text">{renderBold(t)}</div>
                  </div>
                ))}
              </div>
              {isPro ? (
                <button className="sub-btn sub-btn--current" type="button" disabled>
                  Активна до {profile.subscription_until ? formatDate(profile.subscription_until, "full") : "—"}
                </button>
              ) : (
                <button className="sub-btn sub-btn--upgrade" type="button" onClick={handleUpgrade}>
                  Подключить Pro — 1 490 ₽/мес
                </button>
              )}
            </div>
          </div>

          {!isPro && (
            <div className="sub-warning">
              <div className="sub-warning-icon">⚠️</div>
              <div className="sub-warning-text">
                <b>Без подписки</b> ты можешь только записываться на уроки с преподавателями. Speaking Clubs, геймификация, ачивки, призы, лидерборд, AI-план и коммьюнити — всё это <b>доступно только с подпиской Raw Pro</b>. Подписка не включает стоимость уроков — они оплачиваются отдельно с баланса.
              </div>
            </div>
          )}
        </div>

        {/* HISTORY */}
        <div className="history" id="history">
          <div className="history-head">
            <h3>История платежей</h3>
          </div>
          <div className="h-row h-head">
            <div>Дата</div>
            <div>Описание</div>
            <div style={{ textAlign: "right" }}>Сумма</div>
            <div style={{ textAlign: "right" }}>Статус</div>
          </div>
          {history.length === 0 ? (
            <div className="h-empty">История пока пуста</div>
          ) : (
            history.map((h) => {
              const isPlus = h.kind === "credit" || h.kind === "xp"
              const amountCls = isPlus ? "h-amount h-amount--plus" : "h-amount h-amount--minus"
              const sign = isPlus ? "+" : "−"
              const badgeCls = h.status === "ok" ? "h-badge h-badge--ok" : "h-badge h-badge--pending"
              const badgeText =
                h.status === "pending" ? "В ожидании" : h.kind === "credit" ? "Зачислено" : h.kind === "xp" ? "Начислено" : "Оплачено"
              const displayAmount =
                h.currency === "XP" ? `${sign}${formatRub(Math.abs(h.amount))} XP` : `${sign}${formatRub(Math.abs(h.amount))} ₽`
              return (
                <div className="h-row" key={h.id}>
                  <div className="h-date">{formatDate(h.date, "short")}</div>
                  <div className="h-desc">{h.title}</div>
                  <div className={amountCls}>{displayAmount}</div>
                  <div className="h-status">
                    <span className={badgeCls}>{badgeText}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
