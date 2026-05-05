// @ts-nocheck
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

const CSS = `
.adm-students{max-width:1400px;margin:0 auto}

.adm-students .page-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.adm-students .page-hdr h1{font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.adm-students .page-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}

.adm-students .controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px}
.adm-students .search-box{flex:1;min-width:240px;position:relative}
.adm-students .search-box input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:11px 14px 11px 40px;font-size:13px;color:var(--text);font-family:inherit;transition:border-color .15s}
.adm-students .search-box input:focus{outline:none;border-color:var(--text)}
.adm-students .search-box svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--muted);fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}

.adm-students .sort-select{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--text);font-family:inherit;cursor:pointer;font-weight:600}
.adm-students .sort-select:focus{outline:none;border-color:var(--text)}

.adm-students .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s ease;cursor:pointer;border:none;text-decoration:none}
.adm-students .btn-sm{padding:6px 14px;font-size:12px}
.adm-students .btn-primary{background:var(--accent-dark);color:#fff}
.adm-students .btn-primary:hover{background:var(--red)}
.adm-students .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.adm-students .btn-secondary:hover{border-color:var(--text)}

.adm-students .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden}

.adm-students .users-table{width:100%;border-collapse:collapse}
.adm-students .users-table th{text-align:left;padding:14px 18px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;border-bottom:1px solid var(--border);background:var(--surface-2)}
.adm-students .users-table td{padding:14px 18px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle;color:var(--text)}
.adm-students .users-table tr:last-child td{border-bottom:none}
.adm-students .users-table tr:hover td{background:var(--surface-2)}
.adm-students .user-cell{display:flex;align-items:center;gap:10px}
.adm-students .user-mini-av{width:36px;height:36px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;color:var(--text);overflow:hidden}
.adm-students .user-mini-av.red{background:var(--red);color:#fff}
.adm-students .user-mini-av.lime{background:var(--lime);color:#0A0A0A}
.adm-students .user-mini-av.dark{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-students .user-mini-av.dark{background:var(--red)}
.adm-students .user-mini-av img{width:100%;height:100%;object-fit:cover}
.adm-students .user-main{min-width:0}
.adm-students .user-name{font-weight:700;font-size:13px;color:var(--text)}
.adm-students .user-sub{font-size:11px;color:var(--muted);margin-top:2px}

.adm-students .level-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:var(--bg);color:var(--text)}
.adm-students .level-pill.rare{background:rgba(230,57,70,.1);color:var(--red)}
.adm-students .level-pill.mrare{background:rgba(216,242,106,.25);color:#5A7A00}
[data-theme="dark"] .adm-students .level-pill.mrare{background:rgba(216,242,106,.15);color:var(--lime)}
.adm-students .level-pill.medium{background:rgba(245,185,66,.15);color:#B8860B}
.adm-students .level-pill.welldone{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-students .level-pill.welldone{background:var(--red)}

.adm-students .status-dot{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--muted)}
.adm-students .status-dot::before{content:'';width:6px;height:6px;border-radius:50%;background:#22c55e}
.adm-students .status-dot.inactive::before{background:#A0A09A}

.adm-students .xp-val{font-weight:700;font-variant-numeric:tabular-nums;color:var(--text)}
.adm-students .xp-val small{color:var(--muted);font-weight:500;margin-left:2px;font-size:11px}

.adm-students .streak{display:inline-flex;align-items:center;gap:4px;font-weight:700;color:var(--red)}
.adm-students .streak.zero{color:var(--muted);font-weight:500}

.adm-students .empty{padding:60px 16px;text-align:center;color:var(--muted);font-size:14px}
.adm-students .empty b{display:block;color:var(--text);font-size:16px;margin-bottom:4px}

.adm-students .footer{padding:14px 18px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);display:flex;justify-content:space-between;align-items:center}

@media(max-width:900px){
  .adm-students .users-table th:nth-child(3),.adm-students .users-table td:nth-child(3){display:none}
  .adm-students .users-table th:nth-child(5),.adm-students .users-table td:nth-child(5){display:none}
}
@media(max-width:700px){
  .adm-students .users-table th:nth-child(4),.adm-students .users-table td:nth-child(4){display:none}
}
`

type Student = {
  id: string
  full_name: string
  email: string | null
  avatar_url: string | null
  level: string | null
  goal: string | null
  total_xp: number
  current_streak: number
  lessons_count: number
  last_lesson_at: string | null
  created_at: string
  is_active: boolean
}

const AVATAR_STYLES = ["red", "", "lime", "dark", ""]

function initialsOf(name: string): string {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function timeAgoRu(iso: string | null): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso).getTime()
    if (Number.isNaN(d)) return "—"
    const diff = Date.now() - d
    const m = Math.round(diff / 60000)
    if (m < 1) return "сейчас"
    if (m < 60) return `${m} мин назад`
    const h = Math.round(m / 60)
    if (h < 24) return `${h} ч назад`
    const dd = Math.round(h / 24)
    if (dd < 7) return `${dd} дн назад`
    const w = Math.round(dd / 7)
    if (w < 5) return `${w} нед назад`
    const mo = Math.round(dd / 30)
    return `${mo} мес назад`
  } catch {
    return "—"
  }
}

function levelPillClass(level: string | null): string {
  if (!level) return ""
  const l = level.toLowerCase()
  if (l.includes("a1") || l.includes("beginner")) return "rare"
  if (l.includes("a2")) return "mrare"
  if (l.includes("b1")) return "medium"
  if (l.includes("b2")) return "medium"
  if (l.includes("c1") || l.includes("c2")) return "welldone"
  return ""
}

function levelLabel(level: string | null): string {
  if (!level) return "—"
  return level
}

export default function AdminStudentsClient({ initial }: { initial: Student[] }) {
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"recent" | "name" | "xp" | "lessons">(
    "recent"
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = initial
    if (q) {
      list = list.filter(
        (s) =>
          (s.full_name || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q) ||
          (s.goal || "").toLowerCase().includes(q)
      )
    }
    const sorted = [...list]
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "ru"))
        break
      case "xp":
        sorted.sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0))
        break
      case "lessons":
        sorted.sort((a, b) => (b.lessons_count || 0) - (a.lessons_count || 0))
        break
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        )
    }
    return sorted
  }, [initial, search, sortBy])

  return (
    <div className="adm-students">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="page-hdr">
        <div>
          <h1>Все <span className="gl">ученики</span></h1>
          <div className="sub">
            Всего: {initial.length.toLocaleString("ru-RU")} · показано{" "}
            {filtered.length.toLocaleString("ru-RU")}
          </div>
        </div>
        <div>
          <Link href="/admin" className="btn btn-sm btn-secondary">
            ← На главную
          </Link>
        </div>
      </div>

      <div className="controls">
        <div className="search-box">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="Поиск по имени, email, цели..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="recent">Сначала новые</option>
          <option value="name">По имени</option>
          <option value="xp">По XP</option>
          <option value="lessons">По количеству уроков</option>
        </select>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <b>{initial.length === 0 ? "Данные подгружаются" : "Ничего не найдено"}</b>
            {initial.length === 0
              ? "API /api/admin/students может быть ещё не готов"
              : "Попробуйте изменить запрос"}
          </div>
        ) : (
          <>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th>Уровень</th>
                  <th>Цель</th>
                  <th>XP / Стрик</th>
                  <th>Уроков</th>
                  <th>Последний урок</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <div className="user-cell">
                        <div
                          className={`user-mini-av ${
                            AVATAR_STYLES[i % AVATAR_STYLES.length]
                          }`}
                        >
                          {s.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.avatar_url} alt="" />
                          ) : (
                            initialsOf(s.full_name)
                          )}
                        </div>
                        <div className="user-main">
                          <div className="user-name">{s.full_name || "—"}</div>
                          <div className="user-sub">{s.email || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`level-pill ${levelPillClass(s.level)}`}>
                        {levelLabel(s.level)}
                      </span>
                    </td>
                    <td>{s.goal || "—"}</td>
                    <td>
                      <div className="xp-val">
                        {(s.total_xp || 0).toLocaleString("ru-RU")}
                        <small>xp</small>
                      </div>
                      <div
                        className={`streak${s.current_streak > 0 ? "" : " zero"}`}
                      >
                        {s.current_streak > 0 ? `🔥 ${s.current_streak}` : "0"}
                      </div>
                    </td>
                    <td>
                      <b style={{ color: "var(--text)" }}>{s.lessons_count ?? 0}</b>
                    </td>
                    <td>{timeAgoRu(s.last_lesson_at)}</td>
                    <td>
                      <span
                        className={`status-dot${!s.is_active ? " inactive" : ""}`}
                      >
                        {s.is_active ? "Активен" : "Неактивен"}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/admin/students?id=${s.id}`}
                        className="btn btn-sm btn-primary"
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="footer">
              <span>
                Показано {filtered.length} из {initial.length}
              </span>
              <span>Данные обновляются в реальном времени</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
