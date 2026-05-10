// @ts-nocheck
"use client"

import { useEffect, useState } from "react"

const CSS = `
.stu-drw-backdrop{position:fixed;inset:0;background:rgba(10,10,10,.45);z-index:60;animation:stuDrwFadeIn .15s ease}
[data-theme="dark"] .stu-drw-backdrop{background:rgba(0,0,0,.65)}
@keyframes stuDrwFadeIn{from{opacity:0}to{opacity:1}}

.stu-drw{position:fixed;top:0;right:0;bottom:0;width:min(520px,100vw);background:var(--surface);border-left:1px solid var(--border);z-index:61;display:flex;flex-direction:column;animation:stuDrwSlide .2s ease;color:var(--text)}
@keyframes stuDrwSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}

.stu-drw-hdr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--border)}
.stu-drw-hdr h2{font-size:16px;font-weight:800;color:var(--text);letter-spacing:-.3px}
.stu-drw-close{background:transparent;border:1px solid var(--border);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);transition:border-color .15s}
.stu-drw-close:hover{border-color:var(--text)}
.stu-drw-close svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

.stu-drw-body{flex:1;overflow:auto;padding:22px}
.stu-drw-state{padding:60px 16px;text-align:center;color:var(--muted);font-size:14px}
.stu-drw-state b{display:block;color:var(--text);font-size:16px;margin-bottom:4px}

.stu-drw-hero{display:flex;align-items:center;gap:14px;margin-bottom:22px}
.stu-drw-av{width:64px;height:64px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;color:var(--text);overflow:hidden;flex-shrink:0;border:1px solid var(--border)}
.stu-drw-av img{width:100%;height:100%;object-fit:cover}
.stu-drw-name{font-size:18px;font-weight:800;color:var(--text);letter-spacing:-.3px}
.stu-drw-email{font-size:12px;color:var(--muted);margin-top:3px;word-break:break-all}

.stu-drw-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:22px}
.stu-drw-stat{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px 14px}
.stu-drw-stat .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);font-weight:600;margin-bottom:6px}
.stu-drw-stat .val{font-size:18px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;line-height:1}
.stu-drw-stat .val small{font-size:11px;font-weight:500;color:var(--muted);margin-left:3px}

.stu-drw-section{margin-bottom:22px}
.stu-drw-section h3{font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);font-weight:700;margin-bottom:10px}

.stu-drw-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:10px 0;border-bottom:1px dashed var(--border);font-size:13px}
.stu-drw-row:last-child{border-bottom:none}
.stu-drw-row .k{color:var(--muted);font-weight:500;flex-shrink:0}
.stu-drw-row .v{color:var(--text);font-weight:600;text-align:right;word-break:break-word}

.stu-drw-lesson{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:14px}
.stu-drw-lesson .when{font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px}
.stu-drw-lesson .meta{font-size:12px;color:var(--muted);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.stu-drw-lesson .pill{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font-size:11px;font-weight:600;color:var(--text)}
`

type StudentDetail = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
  phone: string | null
  english_goal: string | null
  english_level: string | null
  city: string | null
  occupation: string | null
  created_at: string | null
  balance_rub: number
  subscription_tier: string
  subscription_until: string | null
  total_xp: number
  current_level: number
  lessons_completed: number
  current_streak: number
  longest_streak: number
  last_seen_at: string | null
  last_lesson: {
    id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    teacher_name: string | null
    teacher_avatar: string | null
  } | null
}

function initialsOf(name: string | null): string {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

function lessonStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "Ожидает оплаты",
    booked: "Запланирован",
    scheduled: "Запланирован",
    confirmed: "Подтверждён",
    in_progress: "Идёт сейчас",
    completed: "Завершён",
    cancelled: "Отменён",
    no_show: "Не пришёл",
  }
  return map[status] || status
}

export default function StudentDetailDrawer({
  studentId,
  onClose,
}: {
  studentId: string
  onClose: () => void
}) {
  const [data, setData] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/admin/students/${studentId}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(json?.error || "Не удалось загрузить ученика")
          setLoading(false)
          return
        }
        setData(json.student)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.message || "Сетевая ошибка")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        className="stu-drw-backdrop"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />
      <aside
        className="stu-drw"
        role="dialog"
        aria-modal="true"
        aria-label="Карточка ученика"
      >
        <div className="stu-drw-hdr">
          <h2>Карточка ученика</h2>
          <button
            type="button"
            className="stu-drw-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <svg viewBox="0 0 24 24">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="stu-drw-body">
          {loading && (
            <div className="stu-drw-state">
              <b>Загрузка…</b>
              Получаем данные ученика
            </div>
          )}

          {!loading && error && (
            <div className="stu-drw-state">
              <b>Ошибка</b>
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              <div className="stu-drw-hero">
                <div className="stu-drw-av">
                  {data.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.avatar_url} alt="" />
                  ) : (
                    initialsOf(data.full_name)
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="stu-drw-name">{data.full_name || "—"}</div>
                  <div className="stu-drw-email">{data.email || "—"}</div>
                </div>
              </div>

              <div className="stu-drw-grid">
                <div className="stu-drw-stat">
                  <div className="lbl">Уровень</div>
                  <div className="val">
                    {data.english_level || "—"}
                    <small>L{data.current_level}</small>
                  </div>
                </div>
                <div className="stu-drw-stat">
                  <div className="lbl">Total XP</div>
                  <div className="val">
                    {(data.total_xp || 0).toLocaleString("ru-RU")}
                    <small>xp</small>
                  </div>
                </div>
                <div className="stu-drw-stat">
                  <div className="lbl">Уроков пройдено</div>
                  <div className="val">{data.lessons_completed || 0}</div>
                </div>
                <div className="stu-drw-stat">
                  <div className="lbl">Баланс</div>
                  <div className="val">
                    {(data.balance_rub || 0).toLocaleString("ru-RU")}
                    <small>₽</small>
                  </div>
                </div>
              </div>

              <div className="stu-drw-section">
                <h3>Профиль</h3>
                <div className="stu-drw-row">
                  <span className="k">Дата регистрации</span>
                  <span className="v">{fmtDate(data.created_at)}</span>
                </div>
                <div className="stu-drw-row">
                  <span className="k">Цель</span>
                  <span className="v">{data.english_goal || "—"}</span>
                </div>
                <div className="stu-drw-row">
                  <span className="k">Город</span>
                  <span className="v">{data.city || "—"}</span>
                </div>
                <div className="stu-drw-row">
                  <span className="k">Профессия</span>
                  <span className="v">{data.occupation || "—"}</span>
                </div>
                <div className="stu-drw-row">
                  <span className="k">Телефон</span>
                  <span className="v">{data.phone || "—"}</span>
                </div>
                <div className="stu-drw-row">
                  <span className="k">Стрик</span>
                  <span className="v">
                    {data.current_streak > 0 ? `🔥 ${data.current_streak}` : "0"}
                    <small style={{ color: "var(--muted)", marginLeft: 6 }}>
                      макс. {data.longest_streak}
                    </small>
                  </span>
                </div>
                <div className="stu-drw-row">
                  <span className="k">Подписка</span>
                  <span className="v">
                    {data.subscription_tier}
                    {data.subscription_until
                      ? ` · до ${fmtDate(data.subscription_until)}`
                      : ""}
                  </span>
                </div>
                <div className="stu-drw-row">
                  <span className="k">Был онлайн</span>
                  <span className="v">{fmtDateTime(data.last_seen_at)}</span>
                </div>
              </div>

              <div className="stu-drw-section">
                <h3>Последний урок</h3>
                {data.last_lesson ? (
                  <div className="stu-drw-lesson">
                    <div className="when">
                      {fmtDateTime(data.last_lesson.scheduled_at)}
                    </div>
                    <div className="meta">
                      <span>
                        Преподаватель: <b>{data.last_lesson.teacher_name || "—"}</b>
                      </span>
                      <span className="pill">
                        {lessonStatusLabel(data.last_lesson.status)}
                      </span>
                    </div>
                    <div
                      className="meta"
                      style={{ marginTop: 6, color: "var(--muted)" }}
                    >
                      <span>Длительность: {data.last_lesson.duration_minutes} мин</span>
                    </div>
                  </div>
                ) : (
                  <div className="stu-drw-state" style={{ padding: "24px 0" }}>
                    Уроков ещё не было
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
