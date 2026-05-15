// Skeleton, повторяющий структуру page.tsx (hero + 4 stats + 3 секции).
// Без зависимостей — pure server component, моментальная отдача.

const CSS = `
.tch-sp-sk{max-width:1200px;margin:0 auto}
.tch-sp-sk .back{height:14px;width:160px;background:var(--surface);border-radius:6px;margin-bottom:14px;animation:tchSkPulse 1.2s ease-in-out infinite}

.tch-sp-sk .hero{display:flex;gap:18px;padding:22px;background:var(--surface);border:1px solid var(--border);border-radius:18px;margin-bottom:18px;flex-wrap:wrap}
.tch-sp-sk .hero-av{width:72px;height:72px;border-radius:50%;background:var(--bg);animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .hero-info{flex:1;min-width:240px}
.tch-sp-sk .hero-name{height:28px;width:60%;max-width:340px;background:var(--bg);border-radius:8px;margin-bottom:10px;animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .hero-email{height:14px;width:40%;max-width:220px;background:var(--bg);border-radius:6px;margin-bottom:16px;animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .hero-pills{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.tch-sp-sk .hero-pill{height:24px;width:80px;background:var(--bg);border-radius:999px;animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .hero-xp{height:10px;width:280px;max-width:60%;background:var(--bg);border-radius:100px;animation:tchSkPulse 1.2s ease-in-out infinite}

.tch-sp-sk .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.tch-sp-sk .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;min-height:108px}
.tch-sp-sk .stat-card .l{height:11px;width:60%;background:var(--bg);border-radius:4px;margin-bottom:14px;animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .stat-card .v{height:28px;width:40%;background:var(--bg);border-radius:8px;margin-bottom:12px;animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .stat-card .c{height:11px;width:70%;background:var(--bg);border-radius:4px;animation:tchSkPulse 1.2s ease-in-out infinite}

.tch-sp-sk .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;margin-bottom:16px}
.tch-sp-sk .card-header{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:10px}
.tch-sp-sk .card-header .t{height:16px;width:140px;background:var(--bg);border-radius:6px;animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .card-header .m{height:11px;width:80px;background:var(--bg);border-radius:6px;animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .row{height:48px;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 22px;gap:12px}
.tch-sp-sk .row:last-child{border-bottom:none}
.tch-sp-sk .row .b1{height:14px;flex:1;max-width:180px;background:var(--bg);border-radius:6px;animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .row .b2{height:14px;width:90px;background:var(--bg);border-radius:6px;animation:tchSkPulse 1.2s ease-in-out infinite}
.tch-sp-sk .row .b3{height:24px;width:90px;background:var(--bg);border-radius:999px;animation:tchSkPulse 1.2s ease-in-out infinite}

@keyframes tchSkPulse{0%,100%{opacity:.55}50%{opacity:.85}}

@media (max-width:1100px){.tch-sp-sk .stats-grid{grid-template-columns:repeat(2,1fr)}}
`

export default function Loading() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tch-sp-sk" aria-busy="true" aria-label="Загрузка профиля ученика">
        <div className="back" />

        {/* HERO */}
        <div className="hero">
          <div className="hero-av" />
          <div className="hero-info">
            <div className="hero-name" />
            <div className="hero-email" />
            <div className="hero-pills">
              <div className="hero-pill" />
              <div className="hero-pill" />
              <div className="hero-pill" />
              <div className="hero-pill" />
            </div>
            <div className="hero-xp" />
          </div>
        </div>

        {/* STATS */}
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="l" />
              <div className="v" />
              <div className="c" />
            </div>
          ))}
        </div>

        {/* 3 section placeholders */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card">
            <div className="card-header">
              <div className="t" />
              <div className="m" />
            </div>
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="row">
                <div className="b1" />
                <div className="b2" />
                <div className="b3" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
