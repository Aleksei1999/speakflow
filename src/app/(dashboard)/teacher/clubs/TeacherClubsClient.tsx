// @ts-nocheck
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { computeLessonAccess } from "@/lib/lesson-access"
import { formatTimeUntil } from "@/lib/format-time-until"

const CSS = `
.tch-clubs{max-width:1200px;margin:0 auto}
.tch-clubs .page-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.tch-clubs .page-hdr h1{font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.tch-clubs .page-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}

.tch-clubs .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s ease;cursor:pointer;border:none;text-decoration:none}
.tch-clubs .btn-sm{padding:6px 14px;font-size:12px}
.tch-clubs .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.tch-clubs .btn-secondary:hover{border-color:var(--text)}

.tch-clubs .clubs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.tch-clubs .club-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:10px;transition:border-color .15s;position:relative}
.tch-clubs .club-card:hover{border-color:var(--text)}
.tch-clubs .club-card.unseen{border-color:var(--red);background:rgba(230,57,70,.04)}
.tch-clubs .club-card.unseen::before{content:"NEW";position:absolute;top:14px;right:14px;background:var(--red);color:#fff;border-radius:999px;padding:2px 9px;font-size:10px;font-weight:800;letter-spacing:.4px}
.tch-clubs .club-card .title{font-size:16px;font-weight:800;color:var(--text);letter-spacing:-.2px;line-height:1.3;padding-right:48px}
.tch-clubs .club-card .desc{font-size:12px;color:var(--muted);line-height:1.45;min-height:34px}

.tch-clubs .hero-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px}
.tch-clubs .club-status{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.3px}
.tch-clubs .club-status.published{background:rgba(34,197,94,.1);color:#22c55e}
.tch-clubs .club-status.draft{background:var(--bg);color:var(--muted)}
.tch-clubs .club-status.cancelled{background:rgba(230,57,70,.1);color:var(--red)}
.tch-clubs .club-status.completed{background:var(--accent-dark);color:#fff}

.tch-clubs .capacity-bar{height:6px;background:var(--bg);border-radius:3px;overflow:hidden;margin-top:4px}
.tch-clubs .capacity-bar .fill{height:100%;background:var(--lime);transition:width .2s}
.tch-clubs .capacity-bar .fill.hot{background:var(--red)}

.tch-clubs .club-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--muted);font-weight:600;margin-top:auto;padding-top:10px;border-top:1px solid var(--border)}
.tch-clubs .club-meta b{color:var(--text);font-weight:700}

.tch-clubs .parts{margin-top:6px;display:flex;flex-direction:column;gap:6px}
.tch-clubs .parts-toggle{background:transparent;border:none;color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;text-align:left;padding:0;letter-spacing:.3px;text-transform:uppercase}
.tch-clubs .parts-toggle:hover{color:var(--text)}
.tch-clubs .parts-list{display:flex;flex-direction:column;gap:4px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 10px}
.tch-clubs .parts-row{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);min-width:0}
.tch-clubs .parts-row .pa-av{width:22px;height:22px;border-radius:50%;background:var(--accent-dark);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
.tch-clubs .parts-row .pa-av img{width:100%;height:100%;object-fit:cover}
.tch-clubs .parts-row .pa-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.tch-clubs .parts-row .pa-st{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.tch-clubs .parts-empty{font-size:11px;color:var(--muted);font-style:italic;padding:6px 0}

.tch-clubs .empty{padding:60px 16px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.tch-clubs .empty b{display:block;color:var(--text);font-size:16px;margin-bottom:4px}

.tch-clubs .join-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tch-clubs .join-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;border:none;cursor:pointer}
.tch-clubs .join-btn.live{background:var(--lime);color:#0A0A0A}
.tch-clubs .join-btn.waiting{background:var(--bg);color:var(--muted);border:1px solid var(--border);cursor:default}
.tch-clubs .join-btn.expired{background:var(--bg);color:var(--muted);border:1px solid var(--border);cursor:default}
`

type Participant = {
  id: string | null
  full_name: string | null
  avatar_url: string | null
  email: string | null
  status: string
  registered_at: string | null
}

type Club = {
  id: string
  title: string
  description: string | null
  scheduled_at: string | null
  duration_minutes: number
  level: string | null
  capacity: number
  registered_count: number
  status: "draft" | "published" | "cancelled" | "completed"
  cover_emoji: string | null
  is_unseen: boolean
  participants: Participant[]
}

function statusLabel(s: string): string {
  switch (s) {
    case "published":
      return "опубликован"
    case "draft":
      return "черновик"
    case "cancelled":
      return "отменён"
    case "completed":
      return "завершён"
    default:
      return s
  }
}

export default function TeacherClubsClient({
  initial,
}: {
  initial: { clubs: Club[]; unread_count: number }
}) {
  const [clubs, setClubs] = useState<Club[]>(initial.clubs)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // Mark all as seen when teacher actually opens this page.
  useEffect(() => {
    if (initial.unread_count === 0) return
    void fetch("/api/teacher/clubs/seen-all", { method: "POST" })
      .then(() => {
        setClubs((cur) => cur.map((c) => ({ ...c, is_unseen: false })))
        window.dispatchEvent(new CustomEvent("teacher-clubs-seen-changed"))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = async () => {
    try {
      const res = await fetch("/api/teacher/clubs", { cache: "no-store" })
      if (!res.ok) return
      const json = await res.json()
      if (Array.isArray(json?.clubs)) setClubs(json.clubs)
    } catch {}
  }

  return (
    <div className="tch-clubs">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="page-hdr">
        <div>
          <h1>Speaking <span className="gl">Clubs</span></h1>
          <div className="sub">
            Клубы, где ты ведущий — всего {clubs.length}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/teacher" className="btn btn-sm btn-secondary">
            ← На главную
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => void refresh()}
          >
            ⟳ Обновить
          </button>
        </div>
      </div>

      {clubs.length === 0 ? (
        <div className="empty">
          <b>Назначений пока нет</b>
          Когда админ выберет тебя ведущим — клуб появится здесь.
        </div>
      ) : (
        <div className="clubs-grid">
          {clubs.map((c) => {
            const pct = Math.round(
              Math.min(
                100,
                (c.registered_count / Math.max(1, c.capacity)) * 100
              )
            )
            const hot = pct >= 80
            return (
              <div
                key={c.id}
                className={`club-card${c.is_unseen ? " unseen" : ""}`}
              >
                <div className="hero-top">
                  <span className={`club-status ${c.status}`}>
                    {statusLabel(c.status)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      fontWeight: 700,
                    }}
                  >
                    {c.level || "—"}
                  </span>
                </div>
                <div className="title">
                  {c.cover_emoji ? `${c.cover_emoji} ` : ""}
                  {c.title}
                </div>
                <div className="desc">{c.description || "—"}</div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Участники: {c.registered_count}/{c.capacity}
                  </div>
                  <div className="capacity-bar">
                    <div
                      className={`fill${hot ? " hot" : ""}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="club-meta">
                  <span>
                    📅{" "}
                    <b>
                      {c.scheduled_at
                        ? format(new Date(c.scheduled_at), "d MMM, HH:mm", {
                            locale: ru,
                          })
                        : "—"}
                    </b>
                  </span>
                  <span>
                    ⏱️ <b>{c.duration_minutes} мин</b>
                  </span>
                </div>
                {(() => {
                  const access = c.scheduled_at
                    ? computeLessonAccess({
                        scheduledAt: c.scheduled_at,
                        durationMinutes: c.duration_minutes,
                        status: c.status === "cancelled" ? "cancelled" : null,
                      })
                    : null
                  if (!access) return null
                  if (access.status === "live") {
                    return (
                      <div className="join-row">
                        <Link
                          href={`/club/${c.id}/room`}
                          className="join-btn live"
                        >
                          🎙 Зайти в клуб
                        </Link>
                      </div>
                    )
                  }
                  if (access.status === "waiting") {
                    const minutesLeft = Math.max(
                      0,
                      Math.ceil((access.openAtMs - access.nowMs) / 60_000)
                    )
                    return (
                      <div className="join-row">
                        <button type="button" className="join-btn waiting" disabled>
                          ⏳ Откроется через {formatTimeUntil(minutesLeft)}
                        </button>
                      </div>
                    )
                  }
                  if (access.status === "cancelled") {
                    return (
                      <div className="join-row">
                        <button type="button" className="join-btn expired" disabled>
                          Отменён
                        </button>
                      </div>
                    )
                  }
                  return (
                    <div className="join-row">
                      <button type="button" className="join-btn expired" disabled>
                        Завершён
                      </button>
                    </div>
                  )
                })()}
                <div className="parts">
                  {c.participants && c.participants.length > 0 ? (
                    <>
                      <button
                        type="button"
                        className="parts-toggle"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))
                        }
                      >
                        {expanded[c.id] ? "▾" : "▸"} Участники (
                        {c.participants.length})
                      </button>
                      {expanded[c.id] ? (
                        <div className="parts-list">
                          {c.participants.map((p, i) => {
                            const initials =
                              (p.full_name || "")
                                .split(" ")
                                .filter(Boolean)
                                .map((s) => s[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2) || "??"
                            return (
                              <div
                                key={(p.id ?? "") + i}
                                className="parts-row"
                                title={p.email || ""}
                              >
                                <div className="pa-av">
                                  {p.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={p.avatar_url}
                                      alt={p.full_name || ""}
                                    />
                                  ) : (
                                    initials
                                  )}
                                </div>
                                <div className="pa-name">
                                  {p.full_name || p.email || "—"}
                                </div>
                                <div className="pa-st">{p.status}</div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="parts-empty">Пока никто не записался</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
