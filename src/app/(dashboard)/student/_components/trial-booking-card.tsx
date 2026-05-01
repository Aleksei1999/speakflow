"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const TIMES = [10, 13, 16, 19] as const // часы МСК
const DAY_LABELS = ["Сегодня", "Завтра", "Послезавтра"] as const

type Slot = { iso: string; day: string; time: string }

function generateSlots(days = 4, perDay = 4): Slot[] {
  const now = new Date()
  const out: Slot[] = []
  for (let d = 0; d < days && out.length < 8; d++) {
    for (let i = 0; i < perDay && i < TIMES.length; i++) {
      const h = TIMES[i]
      const dt = new Date(now)
      dt.setDate(dt.getDate() + d)
      dt.setHours(h, 0, 0, 0)
      // Не предлагаем слот в ближайшие 6 часов — нужно время на подтверждение/назначение преподавателя.
      if (dt.getTime() - now.getTime() < 6 * 60 * 60 * 1000) continue
      const dayLabel =
        d < DAY_LABELS.length
          ? DAY_LABELS[d]
          : dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
      out.push({
        iso: dt.toISOString(),
        day: dayLabel,
        time: `${String(h).padStart(2, "0")}:00`,
      })
    }
  }
  return out.slice(0, 8)
}

type Props = {
  /**
   * Если есть открытая trial-заявка без слота — передаём её id,
   * чтобы не плодить дубли (autoAssignTrial идемпотентен, но всё равно).
   */
  pendingRequestId: string | null
  firstName: string
}

export function TrialBookingCard({ firstName }: Props) {
  const router = useRouter()
  const slots = useMemo(() => generateSlots(), [])
  const [selected, setSelected] = useState<string | null>(slots[0]?.iso ?? null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<{ slotIso: string; assigned: boolean } | null>(null)

  async function submit() {
    if (!selected) {
      toast.error("Выбери удобное время")
      return
    }
    setPending(true)
    try {
      const res = await fetch("/api/trial-lesson/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredSlot: selected }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || "Не получилось записаться. Попробуй другой слот.")
        setPending(false)
        return
      }
      const assigned = json?.status === "scheduled" && Boolean(json?.lessonId)
      setDone({ slotIso: selected, assigned })
      toast.success(
        assigned
          ? "Урок запланирован — преподаватель назначен!"
          : "Заявка принята! Куратор подтвердит время в Telegram."
      )
      // Перезагружаем серверные данные, чтобы lessons-секция и stats обновились.
      router.refresh()
    } catch {
      toast.error("Ошибка сети. Попробуй ещё раз.")
    } finally {
      setPending(false)
    }
  }

  if (done) {
    const dt = new Date(done.slotIso)
    const dayStr = dt.toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Moscow",
    })
    const timeStr = dt.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    })
    return (
      <div className="trial-card trial-card--done">
        <style dangerouslySetInnerHTML={{ __html: TRIAL_CSS }} />
        <div className="trial-done-icon">✓</div>
        <h3>
          {done.assigned ? "Готово, до встречи!" : `Заявка принята, ${firstName}`}
        </h3>
        <p className="trial-done-sub">
          {done.assigned ? (
            <>
              Пробный урок запланирован на <b>{dayStr}, {timeStr}</b> МСК.
              Зайти в комнату можно за 5 минут до начала прямо отсюда.
            </>
          ) : (
            <>
              Хотел <b>{dayStr}, {timeStr}</b> МСК. Свободного преподавателя
              на это время сейчас нет — куратор напишет в Telegram, как только
              подтвердит слот (обычно в течение часа).
            </>
          )}
        </p>
        {done.assigned ? (
          <a href="/student/schedule" className="trial-btn-secondary">
            Открыть расписание
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <div className="trial-card">
      <style dangerouslySetInnerHTML={{ __html: TRIAL_CSS }} />
      <div className="trial-head">
        <div className="trial-emoji">🎯</div>
        <div className="trial-head-tx">
          <h3>Запишись на бесплатный пробный, {firstName}</h3>
          <p>
            45 минут с преподавателем. Подберём программу под твой уровень
            и цели — никаких обязательств.
          </p>
        </div>
      </div>

      <div className="trial-features">
        <span className="trial-feat">⏱ 45 минут</span>
        <span className="trial-feat">💸 Бесплатно</span>
        <span className="trial-feat">🎓 Под твой уровень</span>
      </div>

      <div className="trial-label">Удобное время (МСК)</div>
      <div className="trial-slots">
        {slots.map((s) => (
          <button
            key={s.iso}
            type="button"
            className={`trial-slot ${selected === s.iso ? "active" : ""}`}
            onClick={() => setSelected(s.iso)}
            disabled={pending}
          >
            <div className="trial-slot-day">{s.day}</div>
            <div className="trial-slot-time">{s.time}</div>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="trial-btn-primary"
        onClick={submit}
        disabled={pending || !selected}
      >
        {pending ? "Записываем…" : "Записаться на пробный"}
      </button>
      <p className="trial-foot">
        Нужно другое время? <a href="/student/teachers">Выбрать преподавателя самому →</a>
      </p>
    </div>
  )
}

const TRIAL_CSS = `
.trial-card{background:linear-gradient(135deg,rgba(230,57,70,.06),rgba(74,222,128,.04));border:1px solid var(--border);border-radius:18px;padding:22px 24px;margin-bottom:16px;animation:trial-pop .35s ease-out}
[data-theme="dark"] .trial-card{background:linear-gradient(135deg,rgba(230,57,70,.10),rgba(74,222,128,.05))}
.trial-card--done{text-align:center;padding:32px 24px}
.trial-done-icon{width:56px;height:56px;border-radius:50%;background:rgba(74,222,128,.15);color:#22C55E;font-size:30px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
.trial-card--done h3{font-size:20px;font-weight:800;letter-spacing:-.4px;margin-bottom:8px}
.trial-done-sub{font-size:13px;color:var(--muted);max-width:520px;margin:0 auto 18px;line-height:1.5}
.trial-done-sub b{color:var(--text);font-weight:700}
.trial-head{display:flex;gap:14px;margin-bottom:14px}
.trial-emoji{flex-shrink:0;width:48px;height:48px;border-radius:14px;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 4px 0 rgba(180,30,45,.25)}
.trial-head-tx{flex:1}
.trial-head-tx h3{font-size:18px;font-weight:800;letter-spacing:-.4px;margin:0 0 4px;color:var(--text)}
.trial-head-tx p{font-size:13px;color:var(--muted);margin:0;line-height:1.4}
.trial-features{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.trial-feat{font-size:11px;font-weight:600;padding:5px 10px;border-radius:100px;background:var(--surface);border:1px solid var(--border);color:var(--text)}
.trial-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px}
.trial-slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.trial-slot{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:10px 8px;text-align:center;cursor:pointer;transition:all .15s;color:var(--text);font-family:inherit}
.trial-slot:hover:not(:disabled){border-color:var(--red)}
.trial-slot:disabled{opacity:.55;cursor:not-allowed}
.trial-slot.active{background:rgba(230,57,70,.10);border-color:var(--red)}
.trial-slot-day{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:3px}
.trial-slot.active .trial-slot-day{color:var(--red)}
.trial-slot-time{font-size:15px;font-weight:800;letter-spacing:-.3px}
.trial-btn-primary{width:100%;background:var(--red);color:#fff;font-size:14px;font-weight:700;padding:13px 18px;border-radius:12px;border:none;cursor:pointer;box-shadow:0 3px 0 rgba(180,30,45,.3);transition:all .15s;font-family:inherit}
.trial-btn-primary:hover:not(:disabled){transform:translateY(-1px)}
.trial-btn-primary:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 rgba(180,30,45,.3)}
.trial-btn-primary:disabled{opacity:.6;cursor:not-allowed}
.trial-btn-secondary{display:inline-block;padding:11px 18px;border-radius:12px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:13px;font-weight:600;text-decoration:none;transition:border-color .15s}
.trial-btn-secondary:hover{border-color:var(--text)}
.trial-foot{font-size:11px;color:var(--muted);text-align:center;margin-top:10px}
.trial-foot a{color:var(--red);text-decoration:none;font-weight:600}
.trial-foot a:hover{text-decoration:underline}
@keyframes trial-pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:600px){.trial-slots{grid-template-columns:repeat(2,1fr)}.trial-head{flex-direction:column;gap:10px}.trial-head h3{font-size:16px}}
`
