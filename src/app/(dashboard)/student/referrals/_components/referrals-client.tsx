"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types — синхронизированы с GET /api/referrals/me
// ─────────────────────────────────────────────────────────────────────────────

export type InviteStatus = "sent" | "registered" | "activated" | "expired"

export type Invitee = {
  masked_email: string
  status: InviteStatus
  created_at: string
  activated_at: string | null
  xp_awarded: number
}

export type ReferralsData = {
  code: string
  share_url: string
  stats: { sent: number; registered: number; activated: number }
  cap_remaining: number
  invitees: Invitee[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — scoped через .stu-ref, theme-aware через dashboard-shell переменные
// ─────────────────────────────────────────────────────────────────────────────

const REF_CSS = `
.stu-ref{max-width:1000px;margin:0 auto}
.stu-ref *{box-sizing:border-box}

.stu-ref .ref-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;gap:16px;flex-wrap:wrap}
.stu-ref .ref-header h1{font-size:28px;font-weight:800;letter-spacing:-.8px;line-height:1.1}
.stu-ref .ref-header .sub{font-size:13px;color:var(--muted);margin-top:4px}

/* Hero-карточка */
.stu-ref .hero{background:linear-gradient(135deg,color-mix(in srgb,var(--red) 10%,transparent),color-mix(in srgb,var(--lime) 10%,transparent));border:1px solid var(--border);border-radius:20px;padding:28px 26px;margin-bottom:20px;position:relative;overflow:hidden}
.stu-ref .hero::before{content:"";position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--red) 18%,transparent),transparent 70%);pointer-events:none}
.stu-ref .hero-head{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.stu-ref .hero-emoji{width:54px;height:54px;border-radius:16px;background:var(--red);display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:#fff;flex-shrink:0;box-shadow:0 6px 20px color-mix(in srgb,var(--red) 35%,transparent)}
.stu-ref .hero-title{font-size:22px;font-weight:800;letter-spacing:-.5px;line-height:1.15}
.stu-ref .hero-sub{font-size:13px;color:var(--muted);margin-top:4px}

.stu-ref .hero-link{display:flex;gap:8px;margin-bottom:16px;position:relative;z-index:1}
.stu-ref .hero-link input{flex:1;min-width:0;padding:13px 16px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;font-family:inherit;outline:none;font-weight:500}
.stu-ref .hero-link input:focus{border-color:var(--red)}
.stu-ref .hero-btn{padding:13px 22px;border-radius:12px;background:var(--red);color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer;transition:transform .1s,box-shadow .1s;box-shadow:0 4px 0 color-mix(in srgb,var(--red) 60%,#000);font-family:inherit;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.stu-ref .hero-btn:hover{transform:translateY(-1px)}
.stu-ref .hero-btn:active{transform:translateY(2px);box-shadow:0 2px 0 color-mix(in srgb,var(--red) 60%,#000)}
.stu-ref .hero-btn--ghost{background:var(--surface);color:var(--text);border:1.5px solid var(--border);box-shadow:none}
.stu-ref .hero-btn--ghost:hover{border-color:var(--text)}

.stu-ref .hero-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;position:relative;z-index:1}
.stu-ref .hero-counter{font-size:14px;font-weight:700}
.stu-ref .hero-counter b{color:var(--red);font-size:18px}
.stu-ref .hero-bar{flex:1;min-width:120px;height:10px;background:var(--surface);border-radius:100px;overflow:hidden;border:1px solid var(--border)}
.stu-ref .hero-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,var(--red),var(--lime));transition:width .8s cubic-bezier(.16,1,.3,1)}
.stu-ref .hero-reward{font-size:12px;font-weight:700;padding:5px 12px;border-radius:100px;background:var(--lime);color:#0A0A0A;white-space:nowrap}

/* Как это работает */
.stu-ref .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}
.stu-ref .step{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;text-align:center;transition:all .15s}
.stu-ref .step:hover{border-color:var(--text);transform:translateY(-2px)}
.stu-ref .step-num{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--red);color:#fff;font-size:12px;font-weight:800;margin-bottom:10px}
.stu-ref .step-icon{font-size:1.8rem;margin-bottom:8px}
.stu-ref .step-title{font-size:14px;font-weight:800;letter-spacing:-.2px;margin-bottom:4px}
.stu-ref .step-text{font-size:12px;color:var(--muted);line-height:1.4}
.stu-ref .step-reward{display:inline-block;margin-top:8px;padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;background:color-mix(in srgb,var(--lime) 25%,transparent);color:var(--lime-dark)}
[data-theme="dark"] .stu-ref .step-reward{color:var(--lime)}

/* Список приглашённых */
.stu-ref .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden}
.stu-ref .card-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)}
.stu-ref .card-head h3{font-size:16px;font-weight:800;letter-spacing:-.3px}
.stu-ref .card-head .count{font-size:12px;color:var(--muted);font-weight:600}
.stu-ref .card-body{padding:0}

.stu-ref .tbl{width:100%;border-collapse:collapse}
.stu-ref .tbl th,.stu-ref .tbl td{padding:12px 20px;text-align:left;font-size:13px;border-bottom:1px solid var(--border)}
.stu-ref .tbl th{font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.3px;text-transform:uppercase;background:var(--surface-2)}
.stu-ref .tbl tbody tr:last-child td{border-bottom:none}
.stu-ref .tbl tbody tr:hover{background:var(--surface-2)}
.stu-ref .tbl td.email{font-weight:600}
.stu-ref .tbl td.dates{color:var(--muted);font-size:12px}
.stu-ref .tbl td.xp{color:var(--red);font-weight:800;font-family:'Gluten',cursive;font-size:15px}

.stu-ref .chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;white-space:nowrap}
.stu-ref .chip--sent{background:var(--surface-2);color:var(--muted);border:1px solid var(--border)}
.stu-ref .chip--registered{background:color-mix(in srgb,#f59e0b 15%,transparent);color:#b45309}
[data-theme="dark"] .stu-ref .chip--registered{color:#fbbf24}
.stu-ref .chip--activated{background:color-mix(in srgb,#22c55e 15%,transparent);color:#15803d}
[data-theme="dark"] .stu-ref .chip--activated{color:#4ade80}
.stu-ref .chip--expired{background:color-mix(in srgb,var(--red) 10%,transparent);color:var(--red)}

.stu-ref .empty{padding:50px 24px;text-align:center}
.stu-ref .empty-emoji{font-size:2.6rem;margin-bottom:10px}
.stu-ref .empty-title{font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px}
.stu-ref .empty-sub{font-size:13px;color:var(--muted);max-width:360px;margin:0 auto;line-height:1.5}

/* Mobile */
@media(max-width:700px){
  .stu-ref .ref-header h1{font-size:22px}
  .stu-ref .hero{padding:20px 18px}
  .stu-ref .hero-title{font-size:18px}
  .stu-ref .hero-link{flex-direction:column}
  .stu-ref .hero-link input{font-size:12px}
  .stu-ref .hero-meta{flex-direction:column;align-items:stretch}
  .stu-ref .hero-counter{text-align:center}
  .stu-ref .steps{grid-template-columns:1fr}
  .stu-ref .tbl th,.stu-ref .tbl td{padding:10px 14px;font-size:12px}
  .stu-ref .tbl .col-dates{display:none}
}
`

type Props = {
  initialData: ReferralsData
}

export function ReferralsClient({ initialData }: Props) {
  const [data, setData] = useState<ReferralsData>(initialData)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  // Если SSR-fetch вернул пустой код (API ещё не зарелизен), пробуем ещё раз
  // на mount — возможно backend уже задеплоил endpoint.
  useEffect(() => {
    if (data.code) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/referrals/me", { cache: "no-store" })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        setData({
          code: String(json?.code ?? ""),
          share_url: String(json?.share_url ?? ""),
          stats: {
            sent: Number(json?.stats?.sent ?? 0),
            registered: Number(json?.stats?.registered ?? 0),
            activated: Number(json?.stats?.activated ?? 0),
          },
          cap_remaining: Number(json?.cap_remaining ?? 10),
          invitees: Array.isArray(json?.invitees)
            ? json.invitees.map((i: any) => ({
                masked_email: String(i?.masked_email ?? ""),
                status: (i?.status ?? "sent") as InviteStatus,
                created_at: String(i?.created_at ?? ""),
                activated_at: i?.activated_at ? String(i.activated_at) : null,
                xp_awarded: Number(i?.xp_awarded ?? 0),
              }))
            : [],
        })
      } catch {
        // noop
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data.code])

  useEffect(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      setCanShare(typeof navigator.share === "function")
    }
  }, [])

  const shareUrl = useMemo(() => {
    if (data.share_url) return data.share_url
    if (data.code) return `https://raw-english.com/register?ref=${data.code}`
    return ""
  }, [data.code, data.share_url])

  const activated = data.stats.activated
  const capMax = activated + data.cap_remaining
  const progressPct = capMax > 0 ? Math.min(100, Math.round((activated / capMax) * 100)) : 0

  const copyLink = useCallback(async () => {
    if (!shareUrl) {
      toast.error("Ссылка пока недоступна. Обнови страницу через минуту.")
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Ссылка скопирована")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Не удалось скопировать. Выдели ссылку вручную.")
    }
  }, [shareUrl])

  const nativeShare = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.share({
        title: "Raw English",
        text: "Присоединяйся ко мне на Raw English — прокачай английский и получи +50 XP при регистрации 🎁",
        url: shareUrl,
      })
    } catch {
      // Пользователь отменил — тихо игнорируем
    }
  }, [shareUrl])

  return (
    <div className="stu-ref">
      <style dangerouslySetInnerHTML={{ __html: REF_CSS }} />

      <div className="ref-header">
        <div>
          <h1>Рефералы 👥</h1>
          <div className="sub">
            Приглашай друзей и получай XP за каждого активного ученика
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="hero">
        <div className="hero-head">
          <div className="hero-emoji">🎁</div>
          <div>
            <div className="hero-title">Пригласи друга — получи 100 XP</div>
            <div className="hero-sub">
              Другу +50 XP и бесплатный пробный урок, тебе +100 XP после его первого урока
            </div>
          </div>
        </div>

        <div className="hero-link">
          <input
            type="text"
            readOnly
            value={shareUrl || "Загружаем ссылку…"}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Твоя реферальная ссылка"
          />
          <button
            type="button"
            className="hero-btn"
            onClick={copyLink}
            disabled={!shareUrl}
          >
            {copied ? "✓ Скопировано" : "Копировать"}
          </button>
          {canShare && shareUrl ? (
            <button
              type="button"
              className="hero-btn hero-btn--ghost"
              onClick={nativeShare}
              aria-label="Поделиться"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Поделиться
            </button>
          ) : null}
        </div>

        <div className="hero-meta">
          <div className="hero-counter">
            <b>{activated}</b> / {capMax} активировано
          </div>
          <div className="hero-bar">
            <div className="hero-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="hero-reward">+100 XP за каждого</div>
        </div>
      </div>

      {/* Как это работает */}
      <div className="steps">
        <div className="step">
          <div className="step-num">1</div>
          <div className="step-icon">📨</div>
          <div className="step-title">Поделись ссылкой</div>
          <div className="step-text">Отправь другу свою персональную ссылку</div>
        </div>
        <div className="step">
          <div className="step-num">2</div>
          <div className="step-icon">🔥</div>
          <div className="step-title">Он регистрируется</div>
          <div className="step-text">
            Друг заходит по твоей ссылке и создаёт аккаунт
          </div>
          <div className="step-reward">+50 XP другу</div>
        </div>
        <div className="step">
          <div className="step-num">3</div>
          <div className="step-icon">🏆</div>
          <div className="step-title">Первый урок</div>
          <div className="step-text">
            Как только друг сходит на первый урок — XP твой
          </div>
          <div className="step-reward">+100 XP тебе</div>
        </div>
      </div>

      {/* Список приглашённых */}
      <div className="card">
        <div className="card-head">
          <h3>Приглашённые</h3>
          <div className="count">
            {data.stats.registered} {pluralize(data.stats.registered, "зарегистрирован", "зарегистрировано", "зарегистрировано")} · {activated} активирован{activated === 1 ? "" : activated < 5 ? "о" : "о"}
          </div>
        </div>
        <div className="card-body">
          {data.invitees.length === 0 ? (
            <div className="empty">
              <div className="empty-emoji">☝️</div>
              <div className="empty-title">Пока никто не зарегистрировался по твоей ссылке</div>
              <div className="empty-sub">
                Поделись ссылкой с другом — и получай +100 XP за каждого активного ученика
              </div>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Статус</th>
                  <th className="col-dates">Регистрация</th>
                  <th className="col-dates">Активация</th>
                  <th style={{ textAlign: "right" }}>XP</th>
                </tr>
              </thead>
              <tbody>
                {data.invitees.map((inv, idx) => (
                  <tr key={`${inv.masked_email}-${idx}`}>
                    <td className="email">{inv.masked_email}</td>
                    <td>
                      <StatusChip status={inv.status} />
                    </td>
                    <td className="dates col-dates">{formatDate(inv.created_at)}</td>
                    <td className="dates col-dates">{formatDate(inv.activated_at)}</td>
                    <td className="xp" style={{ textAlign: "right" }}>
                      {inv.xp_awarded > 0 ? `+${inv.xp_awarded}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: InviteStatus }) {
  const label: Record<InviteStatus, string> = {
    sent: "Отправлено",
    registered: "Зарегистрирован",
    activated: "Активирован",
    expired: "Истёк",
  }
  return <span className={`chip chip--${status}`}>{label[status] ?? status}</span>
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

function pluralize(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
