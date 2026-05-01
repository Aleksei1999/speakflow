"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const TIMES = [10, 13, 16, 19] as const
const DAY_LABELS = ["Сегодня", "Завтра", "Послезавтра"] as const

type Slot = { iso: string; day: string; time: string }

type Teacher = {
  teacherProfileId: string
  teacherUserId: string
  fullName: string
  avatarUrl: string | null
  rating: number
  totalLessons: number
  totalReviews: number
  experienceYears: number | null
  bio: string | null
  specializations: string[]
}

function generateSlots(days = 4, perDay = 4): Slot[] {
  const now = new Date()
  const out: Slot[] = []
  for (let d = 0; d < days && out.length < 8; d++) {
    for (let i = 0; i < perDay && i < TIMES.length; i++) {
      const h = TIMES[i]
      const dt = new Date(now)
      dt.setDate(dt.getDate() + d)
      dt.setHours(h, 0, 0, 0)
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

function formatRu(iso: string): { day: string; time: string } {
  const dt = new Date(iso)
  const day = dt.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow",
  })
  const time = dt.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  })
  return { day, time }
}

type Props = {
  pendingRequestId: string | null
  firstName: string
}

type Step = "slot" | "teacher" | "done"

export function TrialBookingCard({ firstName }: Props) {
  const router = useRouter()
  const slots = useMemo(() => generateSlots(), [])
  const [step, setStep] = useState<Step>("slot")
  const [selectedSlot, setSelectedSlot] = useState<string | null>(slots[0]?.iso ?? null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<{ slotIso: string; assigned: boolean } | null>(null)

  // Загружаем преподавателей при переходе на step=teacher или смене слота.
  useEffect(() => {
    if (step !== "teacher" || !selectedSlot) return
    let cancelled = false
    setTeachersLoading(true)
    setTeachers([])
    setSelectedTeacher(null)
    ;(async () => {
      try {
        const res = await fetch(
          `/api/trial-lesson/teachers?slot=${encodeURIComponent(selectedSlot)}`,
          { cache: "no-store" }
        )
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          toast.error(json?.error || "Не получилось загрузить преподавателей")
          setTeachers([])
          return
        }
        const list = (json?.teachers ?? []) as Teacher[]
        setTeachers(list)
        // Авто-выбор первого (топ по рейтингу), если есть.
        if (list[0]) setSelectedTeacher(list[0].teacherProfileId)
      } catch {
        if (!cancelled) toast.error("Ошибка сети")
      } finally {
        if (!cancelled) setTeachersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step, selectedSlot])

  async function submitBooking() {
    if (!selectedSlot) {
      toast.error("Выбери удобное время")
      return
    }
    setPending(true)
    try {
      const res = await fetch("/api/trial-lesson/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredSlot: selectedSlot,
          // Если преподавателей не было — оставим null (autoAssignTrial всё
          // равно создаст pending-заявку и оповестит куратора).
          teacherProfileId: selectedTeacher ?? undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || "Не получилось записаться. Попробуй другой слот.")
        setPending(false)
        return
      }
      const assigned = json?.status === "scheduled" && Boolean(json?.lessonId)
      setDone({ slotIso: selectedSlot, assigned })
      setStep("done")
      toast.success(
        assigned
          ? "Урок запланирован — преподаватель назначен!"
          : "Заявка принята! Куратор подтвердит время в Telegram."
      )
      router.refresh()
    } catch {
      toast.error("Ошибка сети. Попробуй ещё раз.")
    } finally {
      setPending(false)
    }
  }

  // ===== STATE: success =====
  if (step === "done" && done) {
    const { day, time } = formatRu(done.slotIso)
    return (
      <div className="trial-card trial-card--done">
        <style dangerouslySetInnerHTML={{ __html: TRIAL_CSS }} />
        <div className="trial-done-icon">✓</div>
        <h3>{done.assigned ? "Готово, до встречи!" : `Заявка принята, ${firstName}`}</h3>
        <p className="trial-done-sub">
          {done.assigned ? (
            <>
              Пробный урок запланирован на <b>{day}, {time}</b> МСК.
              Зайти в комнату можно за 5 минут до начала прямо отсюда.
            </>
          ) : (
            <>
              Хотел <b>{day}, {time}</b> МСК. Свободного преподавателя на это
              время сейчас нет — куратор напишет в Telegram, как только
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

  // ===== STATE: teacher =====
  if (step === "teacher" && selectedSlot) {
    const { day, time } = formatRu(selectedSlot)
    return (
      <div className="trial-card">
        <style dangerouslySetInnerHTML={{ __html: TRIAL_CSS }} />

        <div className="trial-step-row">
          <button
            type="button"
            className="trial-back"
            onClick={() => setStep("slot")}
            disabled={pending}
            aria-label="Назад"
          >
            ←
          </button>
          <div className="trial-step-tx">
            <div className="trial-step-label">Шаг 2 / 2 · преподаватель</div>
            <div className="trial-step-when">
              {day}, {time} МСК
            </div>
          </div>
        </div>

        {teachersLoading ? (
          <div className="trial-empty">Ищем свободных преподавателей…</div>
        ) : teachers.length === 0 ? (
          <div className="trial-empty">
            <b>На это время никто не свободен 😔</b>
            <p>
              Можно вернуться и выбрать другой слот, либо записаться без
              автоназначения — куратор подберёт преподавателя и подтвердит
              время в Telegram.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
              <button
                type="button"
                className="trial-btn-secondary"
                onClick={() => setStep("slot")}
                disabled={pending}
              >
                ← Другое время
              </button>
              <button
                type="button"
                className="trial-btn-primary"
                style={{ width: "auto", padding: "11px 18px" }}
                onClick={submitBooking}
                disabled={pending}
              >
                {pending ? "Отправляем…" : "Без выбора — куратору"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="trial-label">Кто проведёт урок</div>
            <div className="trial-teachers">
              {teachers.map((t) => {
                const initials = t.fullName
                  .split(" ")
                  .filter(Boolean)
                  .map((s) => s[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
                const active = selectedTeacher === t.teacherProfileId
                const stars =
                  t.rating > 0
                    ? `★ ${t.rating.toFixed(1)}${
                        t.totalReviews > 0 ? ` · ${t.totalReviews} отз.` : ""
                      }`
                    : "Новый преподаватель"
                return (
                  <button
                    key={t.teacherProfileId}
                    type="button"
                    className={`trial-teacher ${active ? "active" : ""}`}
                    onClick={() => setSelectedTeacher(t.teacherProfileId)}
                    disabled={pending}
                  >
                    <div className="trial-t-avatar">
                      {t.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.avatarUrl} alt={t.fullName} />
                      ) : (
                        initials || "?"
                      )}
                    </div>
                    <div className="trial-t-tx">
                      <div className="trial-t-name">{t.fullName}</div>
                      <div className="trial-t-meta">
                        {stars}
                        {typeof t.experienceYears === "number" && t.experienceYears > 0
                          ? ` · ${t.experienceYears} лет опыта`
                          : ""}
                      </div>
                      {t.bio ? (
                        <div className="trial-t-bio">{t.bio}</div>
                      ) : null}
                    </div>
                    <div className="trial-t-radio">
                      {active ? <span>●</span> : null}
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="trial-btn-primary"
              onClick={submitBooking}
              disabled={pending || !selectedTeacher}
            >
              {pending ? "Записываем…" : "Записаться"}
            </button>
          </>
        )}
      </div>
    )
  }

  // ===== STATE: slot =====
  return (
    <div className="trial-card">
      <style dangerouslySetInnerHTML={{ __html: TRIAL_CSS }} />
      <div className="trial-head">
        <div className="trial-emoji">🎯</div>
        <div className="trial-head-tx">
          <h3>Запишись на бесплатный пробный, {firstName}</h3>
          <p>
            45 минут с преподавателем. Подберём программу под твой уровень и
            цели — никаких обязательств.
          </p>
        </div>
      </div>

      <div className="trial-features">
        <span className="trial-feat">⏱ 45 минут</span>
        <span className="trial-feat">💸 Бесплатно</span>
        <span className="trial-feat">🎓 Под твой уровень</span>
      </div>

      <div className="trial-step-label">Шаг 1 / 2 · удобное время (МСК)</div>
      <div className="trial-slots">
        {slots.map((s) => (
          <button
            key={s.iso}
            type="button"
            className={`trial-slot ${selectedSlot === s.iso ? "active" : ""}`}
            onClick={() => setSelectedSlot(s.iso)}
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
        onClick={() => setStep("teacher")}
        disabled={pending || !selectedSlot}
      >
        Далее — выбрать преподавателя →
      </button>
      <p className="trial-foot">
        Нужно другое время? <a href="/student/teachers">Открыть полный каталог →</a>
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
.trial-step-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px}
.trial-step-row{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.trial-back{flex-shrink:0;width:36px;height:36px;border-radius:50%;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);font-size:18px;line-height:1;transition:all .15s}
.trial-back:hover:not(:disabled){border-color:var(--text)}
.trial-back:disabled{opacity:.5;cursor:not-allowed}
.trial-step-tx{flex:1}
.trial-step-tx .trial-step-label{margin-bottom:2px}
.trial-step-when{font-size:14px;font-weight:700;color:var(--text)}
.trial-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px}
.trial-slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.trial-slot{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:10px 8px;text-align:center;cursor:pointer;transition:all .15s;color:var(--text);font-family:inherit}
.trial-slot:hover:not(:disabled){border-color:var(--red)}
.trial-slot:disabled{opacity:.55;cursor:not-allowed}
.trial-slot.active{background:rgba(230,57,70,.10);border-color:var(--red)}
.trial-slot-day{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:3px}
.trial-slot.active .trial-slot-day{color:var(--red)}
.trial-slot-time{font-size:15px;font-weight:800;letter-spacing:-.3px}

.trial-teachers{display:flex;flex-direction:column;gap:8px;margin-bottom:14px;max-height:340px;overflow-y:auto;padding-right:4px}
.trial-teacher{display:flex;align-items:flex-start;gap:12px;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:12px;text-align:left;cursor:pointer;transition:all .15s;color:var(--text);font-family:inherit}
.trial-teacher:hover:not(:disabled){border-color:var(--red)}
.trial-teacher.active{background:rgba(230,57,70,.06);border-color:var(--red)}
.trial-teacher:disabled{opacity:.6;cursor:not-allowed}
.trial-t-avatar{flex-shrink:0;width:44px;height:44px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--text);overflow:hidden}
.trial-t-avatar img{width:100%;height:100%;object-fit:cover}
.trial-t-tx{flex:1;min-width:0}
.trial-t-name{font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px}
.trial-t-meta{font-size:11px;color:var(--muted);margin-bottom:4px}
.trial-t-bio{font-size:12px;color:var(--muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.trial-t-radio{flex-shrink:0;width:20px;height:20px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--red);font-size:18px;line-height:1}
.trial-teacher.active .trial-t-radio{border-color:var(--red)}

.trial-empty{text-align:center;padding:24px 16px;color:var(--muted);font-size:13px;line-height:1.5}
.trial-empty b{display:block;color:var(--text);font-size:15px;margin-bottom:6px}
.trial-empty p{margin:0;font-size:12px}

.trial-btn-primary{width:100%;background:var(--red);color:#fff;font-size:14px;font-weight:700;padding:13px 18px;border-radius:12px;border:none;cursor:pointer;box-shadow:0 3px 0 rgba(180,30,45,.3);transition:all .15s;font-family:inherit}
.trial-btn-primary:hover:not(:disabled){transform:translateY(-1px)}
.trial-btn-primary:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 rgba(180,30,45,.3)}
.trial-btn-primary:disabled{opacity:.6;cursor:not-allowed}
.trial-btn-secondary{display:inline-block;padding:11px 18px;border-radius:12px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;font-family:inherit}
.trial-btn-secondary:hover{border-color:var(--text)}
.trial-foot{font-size:11px;color:var(--muted);text-align:center;margin-top:10px}
.trial-foot a{color:var(--red);text-decoration:none;font-weight:600}
.trial-foot a:hover{text-decoration:underline}
@keyframes trial-pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:600px){
  .trial-slots{grid-template-columns:repeat(2,1fr)}
  .trial-head{flex-direction:column;gap:10px}
  .trial-head h3{font-size:16px}
  .trial-teachers{max-height:none}
}
`
