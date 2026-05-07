"use client"

import {
  TOPUP_TIERS,
  FREE_FEATURES,
  PRO_FEATURES_YES,
  PRO_PRICE_RUB,
  formatRub,
  plural,
} from "@/lib/pricing"

function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*/)
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))
}

const PRICING_CSS = `
.pricing-section{padding:120px 40px;max-width:1280px;margin:0 auto;position:relative}
.pricing-section .pricing-head{text-align:center;max-width:720px;margin:0 auto 64px}
.pricing-section .pricing-head .section-tag{display:inline-block}
.pricing-section .pricing-head .section-desc{margin:14px auto 0}
.pricing-section .pricing-sub-h{font-size:1.2rem;font-weight:800;letter-spacing:-.3px;margin:0 0 8px}
.pricing-section .pricing-sub-d{font-size:.92rem;color:var(--text2);max-width:760px;margin:0 0 26px}

/* Top-up grid */
.pricing-section .pr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:80px}
.pricing-section .pr-card{background:var(--card);border:2px solid var(--border);border-radius:20px;padding:24px 18px;text-align:center;position:relative;overflow:hidden;transition:all .3s cubic-bezier(.16,1,.3,1)}
.pricing-section .pr-card:hover{transform:translateY(-6px);border-color:var(--red);box-shadow:0 18px 40px var(--shadow)}
.pricing-section .pr-card--popular{border-color:var(--red)}
.pricing-section .pr-card--popular::before{content:'ПОПУЛЯРНЫЙ';position:absolute;top:0;left:0;right:0;padding:5px;background:var(--red);color:#fff;font-size:.55rem;font-weight:800;letter-spacing:1.4px;text-align:center}
.pricing-section .pr-card--best{border-color:var(--lime)}
.pricing-section .pr-card--best::before{content:'ЛУЧШАЯ ЦЕНА';position:absolute;top:0;left:0;right:0;padding:5px;background:var(--lime);color:#0A0A0A;font-size:.55rem;font-weight:800;letter-spacing:1.4px;text-align:center}
.pricing-section .pr-card--popular .pr-body,
.pricing-section .pr-card--best .pr-body{padding-top:18px}
.pricing-section .pr-amount{font-size:2rem;font-weight:800;letter-spacing:-1.2px;margin-bottom:4px;color:var(--text)}
.pricing-section .pr-lessons{margin-top:12px;padding:6px 14px;border-radius:8px;background:var(--bg2);font-size:.7rem;font-weight:700;display:inline-block;color:var(--text)}
.pricing-section .pr-lessons b{color:var(--red)}
.pricing-section .pr-bonus{margin-top:10px;font-size:.66rem;font-weight:700;color:var(--lime);padding:5px 12px;border-radius:6px;background:var(--lime-bg);display:inline-block}
.pricing-section .pr-save{margin-top:6px;font-size:.6rem;color:var(--red);font-weight:700;letter-spacing:.3px}
.pricing-section .pr-perprice{margin-top:6px;font-size:.6rem;color:var(--text3)}

/* Subscription cards */
.pricing-section .sub-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px}
.pricing-section .sub-card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:28px;position:relative;overflow:hidden}
.pricing-section .sub-card--pro{border-color:var(--red);box-shadow:0 2px 0 var(--red-bg),0 12px 40px var(--shadow)}
.pricing-section .sub-card--pro::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),var(--lime))}
.pricing-section .sub-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.pricing-section .sub-name{font-size:1.05rem;font-weight:800;color:var(--text)}
.pricing-section .sub-name .gluten{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.pricing-section .sub-price-val{font-size:1.5rem;font-weight:800;letter-spacing:-.5px;color:var(--text);text-align:right}
.pricing-section .sub-price-val--free{color:var(--text3)}
.pricing-section .sub-price-per{font-size:.62rem;color:var(--text3);text-align:right;margin-top:2px}
.pricing-section .sub-features{display:flex;flex-direction:column;gap:9px;margin-bottom:20px}
.pricing-section .sf{display:flex;align-items:flex-start;gap:9px;font-size:.82rem;color:var(--text)}
.pricing-section .sf-icon{width:22px;height:22px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.65rem;margin-top:1px;font-weight:800}
.pricing-section .sf-icon--yes{background:var(--lime);color:#0A0A0A}
.pricing-section .sf-icon--no{background:var(--bg2);color:var(--text3)}
.pricing-section .sf-text{flex:1;line-height:1.45}
.pricing-section .sf-text--dim{color:var(--text3);text-decoration:line-through}
.pricing-section .sub-cta{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:14px;border-radius:14px;font-family:inherit;font-size:.92rem;font-weight:800;cursor:pointer;border:none;transition:all .25s;text-decoration:none;letter-spacing:.2px}
.pricing-section .sub-cta--red{background:var(--red);color:#fff;box-shadow:0 3px 0 rgba(180,30,45,.4)}
.pricing-section .sub-cta--red:hover{transform:translateY(-2px);box-shadow:0 5px 0 rgba(180,30,45,.4),0 12px 30px rgba(230,57,70,.18)}
.pricing-section .sub-cta--ghost{background:var(--bg2);color:var(--text2)}
.pricing-section .sub-cta--ghost:hover{background:var(--card);color:var(--text)}

.pricing-section .pricing-foot{margin-top:26px;padding:18px 22px;border-radius:14px;background:var(--red-bg);border:1px solid rgba(230,57,70,.18);display:flex;align-items:flex-start;gap:12px}
.pricing-section .pricing-foot-icon{font-size:1.2rem;flex-shrink:0;margin-top:2px}
.pricing-section .pricing-foot-text{font-size:.8rem;color:var(--text);line-height:1.55}
.pricing-section .pricing-foot-text b{color:var(--red)}

@media(max-width:1000px){.pricing-section .pr-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:780px){
  .pricing-section{padding:80px 22px}
  .pricing-section .sub-grid{grid-template-columns:1fr}
}
@media(max-width:540px){.pricing-section .pr-grid{grid-template-columns:1fr}}
`

export default function PricingSection() {
  return (
    <section
      className="pricing-section"
      id="pricing"
      data-level="7"
      data-xp="10"
      data-lu="Цены прозрачно"
    >
      <style dangerouslySetInnerHTML={{ __html: PRICING_CSS }} />

      <div className="pricing-head">
        <div className="section-tag">Прозрачно</div>
        <h2 className="section-title">
          Никакой <span className="gluten">подписки на воздух.</span>
        </h2>
        <p className="section-desc">
          Платишь за уроки — с баланса. Геймификацию, клубы и призы получаешь по подписке Raw Pro. Всё прозрачно, без скрытых списаний.
        </p>
      </div>

      {/* Top-up tiers */}
      <h3 className="pricing-sub-h">Пополнение баланса для уроков</h3>
      <p className="pricing-sub-d">
        Один урок 1-on-1 — 50 минут с преподавателем. Чем больше пополняешь — тем дешевле каждый урок.
      </p>

      <div className="pr-grid">
        {TOPUP_TIERS.map((t) => {
          const cls =
            t.badge === "popular"
              ? "pr-card pr-card--popular"
              : t.badge === "best"
              ? "pr-card pr-card--best"
              : "pr-card"
          return (
            <div key={t.amount} className={cls}>
              <div className="pr-body">
                <div className="pr-amount">{formatRub(t.amount)} ₽</div>
                <div className="pr-lessons">
                  ≈ <b>{t.lessons}</b> {plural(t.lessons, ["урок", "урока", "уроков"])}
                </div>
                {t.bonus && <div className="pr-bonus">{t.bonus}</div>}
                {t.save && <div className="pr-save">{t.save}</div>}
                <div className="pr-perprice">{formatRub(t.perPrice)} ₽ / урок</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Subscription */}
      <h3 className="pricing-sub-h">Подписка на платформу</h3>
      <p className="pricing-sub-d">
        Подписка открывает Speaking Clubs, геймификацию, ачивки, лидерборд и AI-план. Уроки оплачиваются отдельно — с баланса.
      </p>

      <div className="sub-grid">
        <div className="sub-card">
          <div className="sub-head">
            <div className="sub-name">Без подписки</div>
            <div>
              <div className="sub-price-val sub-price-val--free">0 ₽</div>
              <div className="sub-price-per">бесплатно</div>
            </div>
          </div>
          <div className="sub-features">
            {FREE_FEATURES.map((f, i) => (
              <div key={i} className="sf">
                <div className={f.yes ? "sf-icon sf-icon--yes" : "sf-icon sf-icon--no"}>
                  {f.yes ? "✓" : "✗"}
                </div>
                <div className={f.yes ? "sf-text" : "sf-text sf-text--dim"}>{f.text}</div>
              </div>
            ))}
          </div>
          <a className="sub-cta sub-cta--ghost" href="/register">
            Зарегистрироваться бесплатно
          </a>
        </div>

        <div className="sub-card sub-card--pro">
          <div className="sub-head">
            <div className="sub-name">
              <span className="gluten">Raw</span> Pro
            </div>
            <div>
              <div className="sub-price-val">{formatRub(PRO_PRICE_RUB)} ₽</div>
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
          <a className="sub-cta sub-cta--red" href="/register">
            Подключить Pro — {formatRub(PRO_PRICE_RUB)} ₽/мес
          </a>
        </div>
      </div>

      <div className="pricing-foot">
        <div className="pricing-foot-icon">💡</div>
        <div className="pricing-foot-text">
          <b>Без подписки</b> ты можешь только записываться на уроки 1-on-1. Speaking Clubs, геймификация, ачивки, лидерборд, AI-план и коммьюнити доступны только с <b>Raw Pro</b>. Подписка не включает стоимость уроков.
        </div>
      </div>
    </section>
  )
}
