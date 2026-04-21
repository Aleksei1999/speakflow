"use client"

import { useEffect, useMemo, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirror of /api/leaderboard)
// ─────────────────────────────────────────────────────────────────────────────

type Period = "weekly" | "monthly" | "all_time"

type Row = {
  rank: number
  user_id: string
  xp: number
  full_name: string | null
  avatar_url: string | null
  english_level: string | null
  current_streak: number
  longest_streak: number
  clubs_attended: number
  is_me: boolean
}

type ApiResp = {
  period: Period
  rows: Row[]
  me: Row | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (ported from leaderboard-page.html, scoped to .leaderboard-page).
// Uses dashboard-shell CSS vars for light/dark neutrality.
// Rank colors (gold/silver/bronze) are slightly deepened for light mode
// contrast and re-declared inside [data-theme="dark"] to restore the original
// bright prototype look.
// ─────────────────────────────────────────────────────────────────────────────

const LEADERBOARD_CSS = `
.leaderboard-page{
  max-width:1000px;margin:0 auto;
  --gold:#C8A200;--silver:#7A7A76;--bronze:#A96A2B;--green:#16a34a;
}
[data-theme="dark"] .leaderboard-page{
  --gold:#FFD700;--silver:#C0C0C0;--bronze:#CD7F32;--green:#22c55e;
}
.leaderboard-page *{box-sizing:border-box}

/* Header */
.lb-hdr{text-align:center;margin-bottom:32px;position:relative}
.lb-hdr::before{content:'';position:absolute;top:-120px;left:50%;transform:translateX(-50%);width:700px;height:500px;background:radial-gradient(ellipse,rgba(200,162,0,.06),transparent 65%);pointer-events:none}
[data-theme="dark"] .lb-hdr::before{background:radial-gradient(ellipse,rgba(255,215,0,.04),transparent 65%)}
.lb-hdr h1{font-size:2rem;font-weight:800;letter-spacing:-.8px;position:relative}
.lb-hdr h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.lb-hdr-sub{font-size:.85rem;color:var(--muted);margin-top:4px;position:relative}

/* Month selector */
.lb-month-sel{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:28px}
.lb-month-btn{width:36px;height:36px;border-radius:10px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.85rem;transition:all .15s;cursor:pointer;font-family:inherit}
.lb-month-btn:hover:not(:disabled){border-color:var(--text);color:var(--text)}
.lb-month-btn:disabled{opacity:.4;cursor:not-allowed}
.lb-month-name{font-size:1rem;font-weight:700;min-width:180px;text-align:center}
.lb-month-live{padding:4px 10px;border-radius:6px;background:var(--red);color:#fff;font-size:.6rem;font-weight:700;letter-spacing:.5px;animation:lbLivePulse 2s infinite}
@keyframes lbLivePulse{0%,100%{opacity:1}50%{opacity:.6}}

/* Prizes banner */
.lb-prizes{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:20px 24px;margin-bottom:28px;display:flex;align-items:center;gap:16px;position:relative;overflow:hidden}
.lb-prizes::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(200,162,0,.04),transparent 50%,rgba(230,57,70,.02));pointer-events:none}
[data-theme="dark"] .lb-prizes::before{background:linear-gradient(135deg,rgba(255,215,0,.03),transparent 50%,rgba(230,57,70,.02))}
.lb-prizes-icon{font-size:2rem;flex-shrink:0;position:relative;z-index:1}
.lb-prizes-text{flex:1;position:relative;z-index:1}
.lb-prizes-title{font-size:.92rem;font-weight:800;margin-bottom:2px}
.lb-prizes-desc{font-size:.72rem;color:var(--muted);line-height:1.4}
.lb-prizes-list{display:flex;gap:10px;flex-shrink:0;position:relative;z-index:1}
.lb-prize-tag{padding:6px 12px;border-radius:10px;font-size:.65rem;font-weight:700;text-align:center;border:1px solid}
.lb-prize-tag--gold{background:color-mix(in srgb,var(--gold) 12%,transparent);color:var(--gold);border-color:color-mix(in srgb,var(--gold) 25%,transparent)}
.lb-prize-tag--silver{background:color-mix(in srgb,var(--silver) 10%,transparent);color:var(--silver);border-color:color-mix(in srgb,var(--silver) 20%,transparent)}
.lb-prize-tag--bronze{background:color-mix(in srgb,var(--bronze) 10%,transparent);color:var(--bronze);border-color:color-mix(in srgb,var(--bronze) 20%,transparent)}

/* ===== PODIUM ===== */
.lb-podium-wrap{display:flex;align-items:flex-end;justify-content:center;gap:12px;margin-bottom:36px;padding:0 20px}
.lb-podium{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px 20px;text-align:center;flex:1;max-width:220px;position:relative;transition:all .3s}
.lb-podium:hover{transform:translateY(-6px);box-shadow:0 16px 40px var(--shadow)}

.lb-podium--1{min-height:300px;border-color:color-mix(in srgb,var(--gold) 30%,var(--border));background:linear-gradient(180deg,color-mix(in srgb,var(--gold) 5%,transparent),var(--surface));order:2}
.lb-podium--1::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--gold);border-radius:20px 20px 0 0}
.lb-podium--2{min-height:260px;order:1;border-color:color-mix(in srgb,var(--silver) 25%,var(--border))}
.lb-podium--2::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--silver);border-radius:20px 20px 0 0}
.lb-podium--3{min-height:230px;order:3;border-color:color-mix(in srgb,var(--bronze) 25%,var(--border))}
.lb-podium--3::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--bronze);border-radius:20px 20px 0 0}

.lb-podium-rank{font-size:2.5rem;margin-bottom:8px}
.lb-podium-avatar{width:56px;height:56px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:800;overflow:hidden}
.lb-podium-avatar img{width:100%;height:100%;object-fit:cover}
.lb-podium--1 .lb-podium-avatar{background:color-mix(in srgb,var(--gold) 14%,transparent);color:var(--gold);border:2px solid color-mix(in srgb,var(--gold) 35%,transparent);box-shadow:0 0 20px color-mix(in srgb,var(--gold) 18%,transparent)}
.lb-podium--2 .lb-podium-avatar{background:color-mix(in srgb,var(--silver) 10%,transparent);color:var(--silver);border:2px solid color-mix(in srgb,var(--silver) 25%,transparent)}
.lb-podium--3 .lb-podium-avatar{background:color-mix(in srgb,var(--bronze) 10%,transparent);color:var(--bronze);border:2px solid color-mix(in srgb,var(--bronze) 25%,transparent)}

.lb-podium-name{font-size:.88rem;font-weight:800;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-podium-level{font-size:.6rem;color:var(--muted);margin-bottom:10px}
.lb-podium-xp{font-family:'Gluten',cursive;font-size:1.4rem;line-height:1}
.lb-podium--1 .lb-podium-xp{color:var(--gold)}
.lb-podium--2 .lb-podium-xp{color:var(--silver)}
.lb-podium--3 .lb-podium-xp{color:var(--bronze)}
.lb-podium-xp-label{font-size:.55rem;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.lb-podium-prize{margin-top:10px;padding:5px 12px;border-radius:8px;font-size:.6rem;font-weight:700;display:inline-block}
.lb-podium--1 .lb-podium-prize{background:color-mix(in srgb,var(--gold) 12%,transparent);color:var(--gold)}
.lb-podium--2 .lb-podium-prize{background:color-mix(in srgb,var(--silver) 10%,transparent);color:var(--silver)}
.lb-podium--3 .lb-podium-prize{background:color-mix(in srgb,var(--bronze) 10%,transparent);color:var(--bronze)}

.lb-podium--1 .lb-podium-rank{animation:lbCrownFloat 3s ease-in-out infinite}
@keyframes lbCrownFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

/* ===== RANKINGS TABLE ===== */
.lb-table-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:hidden;margin-bottom:28px}
.lb-table-head{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.lb-table-head h3{font-size:1rem;font-weight:800}
.lb-table-tabs{display:flex;gap:4px}
.lb-tt{padding:5px 12px;border-radius:8px;font-size:.68rem;font-weight:600;color:var(--muted);border:1px solid var(--border);background:transparent;transition:all .15s;cursor:pointer;font-family:inherit}
.lb-tt:hover{color:var(--text);border-color:var(--text)}
.lb-tt.active{background:var(--red);color:#fff;border-color:var(--red)}

.lb-rank-row{display:grid;grid-template-columns:50px 44px 1fr 100px 100px 80px;align-items:center;gap:10px;padding:12px 20px;border-bottom:1px solid var(--border);transition:background .15s}
.lb-rank-row:last-child{border-bottom:none}
.lb-rank-row:hover{background:var(--surface-2)}
.lb-rank-row--me{background:color-mix(in srgb,var(--red) 5%,transparent);border:1px solid color-mix(in srgb,var(--red) 15%,transparent);border-radius:10px;margin:4px 12px}
.lb-rank-row--me:hover{background:color-mix(in srgb,var(--red) 8%,transparent)}

.lb-rank-header{display:grid;grid-template-columns:50px 44px 1fr 100px 100px 80px;align-items:center;gap:10px;padding:10px 20px;border-bottom:1px solid var(--border);font-size:.58rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}

.lb-rank-num{font-size:.9rem;font-weight:800;text-align:center}
.lb-rank-num--1{color:var(--gold)}
.lb-rank-num--2{color:var(--silver)}
.lb-rank-num--3{color:var(--bronze)}
.lb-rank-num--me{color:var(--red)}

.lb-rank-ava{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;overflow:hidden}
.lb-rank-ava img{width:100%;height:100%;object-fit:cover}
.lb-rank-ava--1{background:color-mix(in srgb,var(--gold) 12%,transparent);color:var(--gold)}
.lb-rank-ava--2{background:color-mix(in srgb,var(--silver) 10%,transparent);color:var(--silver)}
.lb-rank-ava--3{background:color-mix(in srgb,var(--bronze) 10%,transparent);color:var(--bronze)}
.lb-rank-ava--def{background:var(--surface-2);color:var(--muted)}
.lb-rank-ava--me{background:color-mix(in srgb,var(--red) 12%,transparent);color:var(--red)}

.lb-rank-info{min-width:0}
.lb-rank-name{font-size:.82rem;font-weight:700;display:flex;align-items:center;gap:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-rank-name .lb-badge-me{padding:2px 6px;border-radius:4px;background:var(--red);color:#fff;font-size:.5rem;font-weight:700;flex-shrink:0}
.lb-rank-level{font-size:.6rem;color:var(--muted)}

.lb-rank-xp{font-family:'Gluten',cursive;font-size:.95rem;color:var(--red);text-align:right}
.lb-rank-clubs{font-size:.78rem;font-weight:600;text-align:right;color:var(--muted)}
.lb-rank-streak{font-size:.72rem;font-weight:600;text-align:right;color:var(--muted)}
.lb-rank-streak b{color:var(--lime-dark)}
[data-theme="dark"] .lb-rank-streak b{color:var(--lime)}

.lb-empty{padding:60px 20px;text-align:center;color:var(--muted);font-size:.9rem}

/* ===== HALL OF FAME ===== */
.lb-hof{margin-bottom:20px}
.lb-hof-title{font-size:1.1rem;font-weight:800;letter-spacing:-.3px;margin-bottom:4px;text-align:center}
.lb-hof-sub{font-size:.78rem;color:var(--muted);margin-bottom:16px;text-align:center}
.lb-hof-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.lb-hof-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;text-align:center;position:relative;overflow:hidden;transition:all .2s}
.lb-hof-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px var(--shadow)}
.lb-hof-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--gold)}
.lb-hof-month{font-size:.55rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.lb-hof-ava{width:40px;height:40px;border-radius:50%;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;background:color-mix(in srgb,var(--gold) 10%,transparent);color:var(--gold);border:2px solid color-mix(in srgb,var(--gold) 25%,transparent)}
.lb-hof-name{font-size:.78rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-hof-xp{font-family:'Gluten',cursive;font-size:.85rem;color:var(--gold);margin-top:2px}
.lb-hof-prize{font-size:.55rem;color:var(--muted);margin-top:4px}

@media(max-width:900px){
  .lb-podium-wrap{flex-wrap:wrap}
  .lb-podium{max-width:100%;min-height:auto}
  .lb-podium--1,.lb-podium--2,.lb-podium--3{order:unset}
  .lb-hof-grid{grid-template-columns:1fr 1fr}
  .lb-rank-row,.lb-rank-header{grid-template-columns:40px 36px 1fr 80px 60px}
}
@media(max-width:600px){
  .lb-prizes{flex-direction:column;text-align:center}
  .lb-prizes-list{justify-content:center;flex-wrap:wrap}
  .lb-rank-row,.lb-rank-header{grid-template-columns:32px 32px 1fr 70px}
  .lb-rank-clubs,.lb-rank-streak{display:none}
  .lb-hof-grid{grid-template-columns:1fr 1fr}
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "monthly", label: "За месяц" },
  { key: "weekly", label: "За неделю" },
  { key: "all_time", label: "За всё время" },
]

const PRIZES: { key: 1 | 2 | 3; tag: string; podium: string }[] = [
  { key: 1, tag: "🥇 Мерч + урок", podium: "🎧 Мерч + урок 1-on-1" },
  { key: 2, tag: "🥈 Guest Pass ×3", podium: "🎟 Guest Pass ×3" },
  { key: 3, tag: "🥉 Стикерпак", podium: "🎨 Стикерпак" },
]

function initial(name: string | null | undefined): string {
  const s = (name ?? "").trim()
  if (!s) return "?"
  return s.charAt(0).toUpperCase()
}

function formatXP(n: number): string {
  if (!Number.isFinite(n)) return "0"
  return new Intl.NumberFormat("ru-RU").format(n)
}

function currentMonthName(): string {
  return new Date()
    .toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    .replace(/(^|\s)./u, (c) => c.toUpperCase())
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentLeaderboardPage() {
  const [period, setPeriod] = useState<Period>("monthly")
  const [rows, setRows] = useState<Row[]>([])
  const [me, setMe] = useState<Row | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/leaderboard?period=${period}&limit=50`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: ApiResp) => {
        if (cancelled) return
        setRows(json.rows ?? [])
        setMe(json.me ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setRows([])
        setMe(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period])

  const top3 = useMemo(() => rows.slice(0, 3), [rows])
  const rest = useMemo(() => {
    // Show full top 50 in the table; me-row is rendered inline if already present.
    // If viewer is outside top 50, append synthetic separator + their own row.
    const inTop = me && rows.some((r) => r.user_id === me.user_id)
    if (me && !inTop) {
      return [...rows, { __separator: true as const }, me] as Array<
        Row | { __separator: true }
      >
    }
    return rows
  }, [rows, me])

  const monthTitle =
    period === "monthly"
      ? currentMonthName()
      : period === "weekly"
        ? "Эта неделя"
        : "За всё время"

  const podiumSlots: (Row | null)[] = [
    top3.find((r) => r.rank === 2) ?? null,
    top3.find((r) => r.rank === 1) ?? null,
    top3.find((r) => r.rank === 3) ?? null,
  ]

  return (
    <div className="leaderboard-page">
      <style dangerouslySetInnerHTML={{ __html: LEADERBOARD_CSS }} />

      <div className="lb-hdr">
        <h1>
          Leader<span className="gl">board</span>
        </h1>
        <div className="lb-hdr-sub">
          Соревнуйся с коммьюнити · Топ-3 каждый месяц получают призы
        </div>
      </div>

      <div className="lb-month-sel">
        <button className="lb-month-btn" disabled aria-label="Предыдущий период">
          ←
        </button>
        <div className="lb-month-name">{monthTitle}</div>
        {period !== "all_time" && <div className="lb-month-live">LIVE</div>}
        <button className="lb-month-btn" disabled aria-label="Следующий период">
          →
        </button>
      </div>

      <div className="lb-prizes">
        <div className="lb-prizes-icon">🏆</div>
        <div className="lb-prizes-text">
          <div className="lb-prizes-title">Призы месяца</div>
          <div className="lb-prizes-desc">
            Топ-3 ученика по XP получают реальные подарки. Рейтинг обновляется в
            реальном времени.
          </div>
        </div>
        <div className="lb-prizes-list">
          {PRIZES.map((p) => (
            <div
              key={p.key}
              className={`lb-prize-tag lb-prize-tag--${p.key === 1 ? "gold" : p.key === 2 ? "silver" : "bronze"}`}
            >
              {p.tag}
            </div>
          ))}
        </div>
      </div>

      {/* Podium */}
      <div className="lb-podium-wrap">
        {podiumSlots.map((row, idx) => {
          const place = idx === 0 ? 2 : idx === 1 ? 1 : 3
          const rankEmoji = place === 1 ? "👑" : place === 2 ? "🥈" : "🥉"
          if (!row) {
            return (
              <div
                key={`ph-${place}`}
                className={`lb-podium lb-podium--${place}`}
                aria-hidden
              >
                <div className="lb-podium-rank">{rankEmoji}</div>
                <div className="lb-podium-avatar">—</div>
                <div className="lb-podium-name">Пока пусто</div>
                <div className="lb-podium-level">Будь первым</div>
                <div className="lb-podium-xp">0</div>
                <div className="lb-podium-xp-label">XP</div>
                <div className="lb-podium-prize">
                  {PRIZES.find((p) => p.key === place)?.podium}
                </div>
              </div>
            )
          }
          return (
            <div key={row.user_id} className={`lb-podium lb-podium--${place}`}>
              <div className="lb-podium-rank">{rankEmoji}</div>
              <div className="lb-podium-avatar">
                {row.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.avatar_url} alt="" />
                ) : (
                  initial(row.full_name)
                )}
              </div>
              <div className="lb-podium-name">
                {row.full_name ?? "Без имени"}
                {row.is_me ? " (ты)" : ""}
              </div>
              <div className="lb-podium-level">{row.english_level ?? "—"}</div>
              <div className="lb-podium-xp">{formatXP(row.xp)}</div>
              <div className="lb-podium-xp-label">XP</div>
              <div className="lb-podium-prize">
                {PRIZES.find((p) => p.key === place)?.podium}
              </div>
            </div>
          )
        })}
      </div>

      {/* Rankings table */}
      <div className="lb-table-card">
        <div className="lb-table-head">
          <h3>Рейтинг участников</h3>
          <div className="lb-table-tabs">
            {PERIOD_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`lb-tt${period === t.key ? " active" : ""}`}
                onClick={() => setPeriod(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="lb-rank-header">
          <div>#</div>
          <div />
          <div>Участник</div>
          <div style={{ textAlign: "right" }}>XP</div>
          <div style={{ textAlign: "right" }}>Клубов</div>
          <div style={{ textAlign: "right" }}>Стрик</div>
        </div>

        {loading && <div className="lb-empty">Загрузка…</div>}
        {!loading && rows.length === 0 && (
          <div className="lb-empty">Пока никого нет — стань первым!</div>
        )}
        {!loading &&
          rest.map((r, i) => {
            if ("__separator" in r) {
              return (
                <div
                  key="sep"
                  className="lb-empty"
                  style={{ padding: "10px 20px", fontSize: ".65rem" }}
                >
                  · · ·
                </div>
              )
            }
            const row = r as Row
            const isTop = row.rank <= 3
            const rowCls = row.is_me ? "lb-rank-row lb-rank-row--me" : "lb-rank-row"
            const numCls = row.is_me
              ? "lb-rank-num lb-rank-num--me"
              : isTop
                ? `lb-rank-num lb-rank-num--${row.rank}`
                : "lb-rank-num"
            const avaCls = row.is_me
              ? "lb-rank-ava lb-rank-ava--me"
              : isTop
                ? `lb-rank-ava lb-rank-ava--${row.rank}`
                : "lb-rank-ava lb-rank-ava--def"
            return (
              <div key={`${row.user_id}-${i}`} className={rowCls}>
                <div className={numCls}>{row.rank}</div>
                <div className={avaCls}>
                  {row.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.avatar_url} alt="" />
                  ) : (
                    initial(row.full_name)
                  )}
                </div>
                <div className="lb-rank-info">
                  <div className="lb-rank-name">
                    {row.full_name ?? "Без имени"}
                    {row.is_me && <span className="lb-badge-me">ТЫ</span>}
                  </div>
                  <div className="lb-rank-level">{row.english_level ?? "—"}</div>
                </div>
                <div className="lb-rank-xp">{formatXP(row.xp)}</div>
                <div className="lb-rank-clubs">{row.clubs_attended ?? 0}</div>
                <div className="lb-rank-streak">
                  <b>{row.current_streak ?? 0}</b>
                  {(row.current_streak ?? 0) > 0 ? " 🔥" : ""}
                </div>
              </div>
            )
          })}
      </div>

      {/* Hall of Fame — plumbed to future history endpoint; hidden until backed by data */}
      {/* Intentionally omitted from MVP: spec migration for monthly archive pending. */}
    </div>
  )
}
