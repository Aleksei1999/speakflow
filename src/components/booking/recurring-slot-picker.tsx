"use client"

// ---------------------------------------------------------------
// RecurringSlotPicker
//
// Полноэкранная модалка с week × hour гридом для выбора повторяющегося
// слота у конкретного преподавателя.
//
// Контракт props:
//   teacherId   — UUID из teacher_profiles.id
//   onConfirm   — вызовется ТОЛЬКО после успешного 201 от API
//                 (pattern, starts_on, weeks, lessonsCreated)
//   onCancel    — close без сохранения
//
// Поведение:
//   • Грид: 7 дней (Mon..Sun) × 8 часов (10..17, шаг 1 час) — по
//     умолчанию. Это разумный compromise: не перегружено, влезает на
//     мобильник, и большинство уроков идут именно в этот промежуток.
//   • Клик по свободной ячейке → toggle добавления слота.
//   • Занятые ячейки (из GET busy=1) — кликнуть нельзя, оранжевые.
//   • 409 от POST → подсветить именно те слоты, что в conflicts[],
//     красным; убрать их из pattern; показать errorConflict.
//
// Дизайн-язык — те же CSS-переменные, что в lesson-room (--lime,
// --red, --black, --bg), inline `<style>` чтобы не плодить .css
// файлы для одного модала (тот же подход что у lesson-room-client).
// ---------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useModalA11y } from "@/hooks/use-modal-a11y"

export type RecurringPatternEntry = {
  dow: number // 0=Mon..6=Sun
  time: string // "HH:MM"
  duration_min: number
}

export type RecurringConfirmPayload = {
  pattern: RecurringPatternEntry[]
  starts_on: string // YYYY-MM-DD (Mon)
  weeks: number
  lessonsCreated: number
}

type Props = {
  teacherId: string
  open: boolean
  onConfirm: (payload: RecurringConfirmPayload) => void
  onCancel: () => void
  // Если задан — стартовая длительность урока. Иначе 50 (наш дефолт).
  defaultDurationMin?: 30 | 50 | 60
}

type BusySlot = {
  dow: number
  time: string
  duration_minutes: number
  scheduled_at: string
}

// Стартуем со следующей полной недели — Mon после today.
function nextMondayISO(): string {
  const now = new Date()
  // UTC-понедельник: 0=Sun..6=Sat → нужно (1-getDay()+7)%7 дней вперёд,
  // но 0 = «сегодня уже Mon» → берём +7 чтобы это была СЛЕДУЮЩАЯ неделя.
  const dow = now.getUTCDay()
  const daysAhead = ((1 - dow + 7) % 7) || 7
  const mon = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead)
  )
  return mon.toISOString().slice(0, 10)
}

const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]

const CSS = `
.rsp{position:fixed;inset:0;z-index:400;background:rgba(10,10,10,.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Inter',sans-serif}
.rsp .rspc{background:#fff;border-radius:20px;width:min(960px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.rsp .rsph{display:flex;align-items:flex-start;justify-content:space-between;padding:22px 24px 14px;border-bottom:1px solid #EEEEEA;gap:16px;flex-shrink:0}
.rsp .rsph h2{font-size:20px;font-weight:800;letter-spacing:-.3px;color:#0A0A0A;margin:0 0 4px}
.rsp .rsph p{font-size:13px;color:#8A8A86;margin:0;line-height:1.45}
.rsp .rsph button.x{background:rgba(0,0,0,.05);border:0;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;color:#0A0A0A;flex-shrink:0}
.rsp .rsph button.x:hover{background:rgba(0,0,0,.1)}
.rsp .rspb{padding:18px 24px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:18px}
.rsp .rspf{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;border-top:1px solid #EEEEEA;flex-shrink:0;flex-wrap:wrap}
.rsp .rspf .ferr{flex:1 1 100%;color:#7F1D1D;font-size:13px;font-weight:600;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:8px 12px}
.rsp .opts{display:flex;gap:16px;flex-wrap:wrap}
.rsp .opt{display:flex;flex-direction:column;gap:6px}
.rsp .opt .label{font-size:11px;color:#8A8A86;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.rsp .opt .row{display:flex;gap:6px}
.rsp .opt .pill{padding:7px 14px;border-radius:999px;background:#F5F5F3;border:1px solid #EEEEEA;font-size:13px;font-weight:600;cursor:pointer;color:#0A0A0A}
.rsp .opt .pill:hover{background:#E8E8E4}
.rsp .opt .pill.on{background:#0A0A0A;color:#fff;border-color:#0A0A0A}
.rsp .starts-on{font-size:12px;color:#8A8A86;font-weight:600}

.rsp .grid{display:grid;grid-template-columns:60px repeat(7,1fr);gap:4px;background:#F5F5F3;border-radius:14px;padding:10px;min-width:520px}
.rsp .gh{font-size:11px;font-weight:700;color:#8A8A86;text-transform:uppercase;letter-spacing:.5px;text-align:center;padding:6px 0}
.rsp .gh.corner{visibility:hidden}
.rsp .gt{font-size:11px;font-weight:700;color:#8A8A86;text-align:right;padding-right:8px;align-self:center;line-height:1}
.rsp .gc{aspect-ratio:1.4;background:#fff;border:1px solid #EEEEEA;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#0A0A0A;transition:transform .08s ease,border-color .12s ease,background .12s ease;user-select:none}
.rsp .gc:hover{border-color:#0A0A0A}
.rsp .gc.on{background:#DDEA88;border-color:#0A0A0A;color:#0A0A0A;font-weight:800}
.rsp .gc.busy{background:#FFEDD5;border-color:#FED7AA;color:#9A3412;cursor:not-allowed}
.rsp .gc.busy:hover{border-color:#FED7AA}
.rsp .gc.conf{background:#FECACA;border-color:#B63F37;color:#7F1D1D;animation:rsp-shake .35s ease both}
@keyframes rsp-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}

.rsp .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#8A8A86;font-weight:600}
.rsp .legend span{display:inline-flex;align-items:center;gap:6px}
.rsp .legend i{display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid currentColor}
.rsp .legend .lf{color:#0A0A0A;background:#fff;border-color:#EEEEEA;border-style:solid}
.rsp .legend .lc{background:#DDEA88;border-color:#0A0A0A;color:#0A0A0A}
.rsp .legend .lb{background:#FFEDD5;border-color:#FED7AA;color:#9A3412}
.rsp .legend .lx{background:#FECACA;border-color:#B63F37;color:#7F1D1D}

.rsp .btn-primary{background:#0A0A0A;color:#fff;border:0;border-radius:999px;padding:11px 22px;font-size:13px;font-weight:700;cursor:pointer;transition:background .12s ease}
.rsp .btn-primary:hover{background:#B63F37}
.rsp .btn-primary:disabled{opacity:.5;cursor:not-allowed}
.rsp .btn-secondary{background:#F5F5F3;color:#0A0A0A;border:0;border-radius:999px;padding:11px 22px;font-size:13px;font-weight:700;cursor:pointer}
.rsp .btn-secondary:hover{background:#E8E8E4}
.rsp .scroll-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}

@media (max-width:640px){
  .rsp{padding:0}
  .rsp .rspc{border-radius:0;max-height:100vh;height:100vh}
  .rsp .grid{min-width:480px}
  .rsp .rspf{flex-direction:column;align-items:stretch}
  .rsp .rspf .btn-primary,.rsp .rspf .btn-secondary{width:100%}
}
`

export function RecurringSlotPicker({
  teacherId,
  open,
  onConfirm,
  onCancel,
  defaultDurationMin = 50,
}: Props) {
  const t = useTranslations("components.recurringSlotPicker")
  const modalRef = useModalA11y(open, onCancel)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [duration, setDuration] = useState<30 | 50 | 60>(defaultDurationMin)
  const [weeks, setWeeks] = useState<4 | 8 | 12>(4)
  const [busy, setBusy] = useState<BusySlot[]>([])
  const [busyLoading, setBusyLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflicts, setConflicts] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const startsOn = useMemo(nextMondayISO, [])

  // Стабильная ссылка на cancel: ESC из useModalA11y дёрнет её один
  // раз; не хотим, чтобы её замена пересоздавала focus trap.
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  // Загружаем busy ровно на следующую неделю — стартовая неделя
  // подписки. Если стартуем дальше — busy в этой неделе всё равно
  // не блокирует, но это редкий case, обработаем 409 fallback'ом.
  useEffect(() => {
    if (!open || !teacherId) return
    let cancelled = false
    setBusyLoading(true)
    fetch(`/api/teachers/${teacherId}/slots?busy=1&week=${startsOn}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const list = (j?.busy ?? []) as BusySlot[]
        setBusy(list)
      })
      .catch(() => {
        if (cancelled) return
        // Не критично: edit-режим без занятости — RPC всё равно валидирует.
        setBusy([])
      })
      .finally(() => {
        if (!cancelled) setBusyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, teacherId, startsOn])

  const busyKeys = useMemo(() => {
    const s = new Set<string>()
    for (const b of busy) s.add(`${b.dow}-${b.time}`)
    return s
  }, [busy])

  const cellKey = (dow: number, hour: number) => `${dow}-${String(hour).padStart(2, "0")}:00`

  const toggleCell = useCallback(
    (dow: number, hour: number) => {
      const k = cellKey(dow, hour)
      if (busyKeys.has(k)) return
      setConflicts((c) => {
        if (!c.has(k)) return c
        const n = new Set(c)
        n.delete(k)
        return n
      })
      setSelected((s) => {
        const n = new Set(s)
        if (n.has(k)) n.delete(k)
        else n.add(k)
        return n
      })
      setError(null)
    },
    [busyKeys]
  )

  const submit = useCallback(async () => {
    if (selected.size === 0) {
      // Локальный sentinel: ниже <RecurringErrorMessage code="__EMPTY__"/>
      // подтянет читаемую строку из namespace dashboard.student.recurring,
      // где у нас живут все user-facing error-копии этой фичи.
      setError("__EMPTY__")
      return
    }
    setSaving(true)
    setError(null)
    const pattern: RecurringPatternEntry[] = []
    for (const k of selected) {
      const [dowStr, time] = k.split("-")
      pattern.push({
        dow: Number(dowStr),
        time,
        duration_min: duration,
      })
    }
    try {
      const r = await fetch("/api/student/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          pattern,
          starts_on: startsOn,
          weeks,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.status === 409) {
        // conflicts: [{at, dow, time}]
        const conflictList = (j?.conflicts ?? []) as Array<{ dow: number; time: string }>
        const set = new Set<string>()
        for (const c of conflictList) set.add(`${c.dow}-${c.time}`)
        setConflicts(set)
        setError("__CONFLICT__")
        return
      }
      if (!r.ok) {
        setError(j?.error || "__GENERIC__")
        return
      }
      onConfirm({
        pattern,
        starts_on: startsOn,
        weeks,
        lessonsCreated: Number(j?.lessons_created ?? 0),
      })
    } catch (e: any) {
      setError(e?.message || "__GENERIC__")
    } finally {
      setSaving(false)
    }
  }, [selected, duration, weeks, teacherId, startsOn, onConfirm])

  if (!open) return null

  const weekdayKeys = ["weekdayMon", "weekdayTue", "weekdayWed", "weekdayThu", "weekdayFri", "weekdaySat", "weekdaySun"] as const
  // Расширенный count для ctaSave и weeks plural.
  const slotsCount = selected.size

  // Локально маппим сентинелы в человекочитаемые ключи дашборда. Эти
  // ключи живут в dashboard.student.recurring; чтобы не тянуть второй
  // useTranslations и не сцеплять компонент с конкретным namespace
  // вызывающей стороны, держим тут fallback-строки на оба языка через
  // dataset (i18n-агностично). На практике вызов снаружи всегда из
  // student-flow и заголовок-сабтайтл из своего namespace ставит
  // именно нужные локали.
  const errorLabel = (() => {
    if (!error) return null
    if (error === "__EMPTY__") return "·"
    if (error === "__CONFLICT__") return "·"
    if (error === "__GENERIC__") return "·"
    return error
  })()

  return (
    <div className="rsp" role="dialog" aria-modal="true" aria-label={t("ariaLabel")}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rspc" ref={modalRef}>
        <div className="rsph">
          <div>
            <h2>{t("headerTitle")}</h2>
            <p>{t("headerSub")}</p>
          </div>
          <button type="button" className="x" onClick={onCancel} aria-label={t("closeAria")}>
            ✕
          </button>
        </div>

        <div className="rspb">
          <div className="opts">
            <div className="opt">
              <div className="label">{t("durationLabel")}</div>
              <div className="row">
                {[30, 50, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`pill${duration === d ? " on" : ""}`}
                    onClick={() => setDuration(d as 30 | 50 | 60)}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
            <div className="opt">
              <div className="label">{t("weeksLabel")}</div>
              <div className="row">
                {[4, 8, 12].map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={`pill${weeks === w ? " on" : ""}`}
                    onClick={() => setWeeks(w as 4 | 8 | 12)}
                  >
                    {w === 4 ? t("weeks4") : w === 8 ? t("weeks8") : t("weeks12")}
                  </button>
                ))}
              </div>
            </div>
            <div className="opt">
              <div className="label">&nbsp;</div>
              <div className="starts-on">{t("startsOn", { date: startsOn })}</div>
            </div>
          </div>

          <div className="scroll-wrap">
            <div className="grid" role="grid" aria-busy={busyLoading}>
              <div className="gh corner" />
              {weekdayKeys.map((wk) => (
                <div key={wk} className="gh">{t(wk)}</div>
              ))}
              {HOURS.map((hour) => (
                <RowFragment
                  key={hour}
                  hour={hour}
                  selected={selected}
                  busyKeys={busyKeys}
                  conflicts={conflicts}
                  onToggle={toggleCell}
                />
              ))}
            </div>
          </div>

          <div className="legend" aria-hidden="true">
            <span><i className="lf" />{t("legendFree")}</span>
            <span><i className="lc" />{t("legendChosen")}</span>
            <span><i className="lb" />{t("legendBusy")}</span>
            <span><i className="lx" />{t("legendConflict")}</span>
            {busyLoading ? <span>{t("loadingBusy")}</span> : null}
          </div>
        </div>

        <div className="rspf">
          {errorLabel ? (
            <div className="ferr">
              {error === "__EMPTY__"
                ? "—"
                : error === "__CONFLICT__"
                  ? "⚠"
                  : error === "__GENERIC__"
                    ? "—"
                    : errorLabel}{" "}
              <RecurringErrorMessage code={error!} />
            </div>
          ) : null}
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            {t("ctaCancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={saving || selected.size === 0}
          >
            {saving ? t("ctaSaving") : t("ctaSave", { count: slotsCount, weeks })}
          </button>
        </div>
      </div>
    </div>
  )
}

// Отдельная подкомпонента, чтобы выдёргивать строки ошибок из
// родительского namespace `dashboard.student.recurring`. Это даёт
// согласованные user-facing тексты без хардкода EN/RU в этом файле.
function RecurringErrorMessage({ code }: { code: string }) {
  const t = useTranslations("dashboard.student.recurring")
  if (code === "__EMPTY__") return <>{t("errorEmpty")}</>
  if (code === "__CONFLICT__") return <>{t("errorConflict")}</>
  if (code === "__GENERIC__") return <>{t("errorGeneric")}</>
  return <>{code}</>
}

function RowFragment({
  hour,
  selected,
  busyKeys,
  conflicts,
  onToggle,
}: {
  hour: number
  selected: Set<string>
  busyKeys: Set<string>
  conflicts: Set<string>
  onToggle: (dow: number, hour: number) => void
}) {
  const hourLabel = `${String(hour).padStart(2, "0")}:00`
  return (
    <>
      <div className="gt">{hourLabel}</div>
      {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
        const k = `${dow}-${hourLabel}`
        const on = selected.has(k)
        const isBusy = busyKeys.has(k)
        const isConflict = conflicts.has(k)
        const cls = `gc${on ? " on" : ""}${isBusy ? " busy" : ""}${isConflict ? " conf" : ""}`
        return (
          <button
            key={k}
            type="button"
            className={cls}
            onClick={() => onToggle(dow, hour)}
            aria-pressed={on}
            aria-disabled={isBusy}
            disabled={isBusy}
            title={isBusy ? "—" : hourLabel}
          >
            {on ? "✓" : isBusy ? "·" : ""}
          </button>
        )
      })}
    </>
  )
}
