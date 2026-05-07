"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type TeacherProfileData = {
  profile: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    avatar_url: string | null
    phone: string | null
    timezone: string | null
    city: string | null
    role: string
    created_at: string
  }
  teacher: {
    id: string
    bio: string | null
    specializations: string[]
    experience_years: number | null
    hourly_rate: number
    trial_rate: number | null
    languages: string[]
    education: string | null
    certificates: string[]
    video_intro_url: string | null
    rating: number
    total_reviews: number
    total_lessons: number
    is_verified: boolean
    is_listed: boolean
  } | null
  stats: {
    completed_lessons: number
    total_hours: number
    rating: number
    total_reviews: number
    is_verified: boolean
    is_listed: boolean
  }
}

const SPECIALIZATIONS_PRESET = ["general", "business", "ielts", "fce", "cae", "kids", "speaking", "grammar"]
const LANGUAGES_PRESET = ["en", "ru", "es", "fr", "de", "zh", "uk"]

const CSS = `
.teach-profile{max-width:920px;margin:0 auto;color:var(--text)}
.teach-profile *{box-sizing:border-box}
.teach-profile h1{font-size:1.6rem;font-weight:800;letter-spacing:-.5px;margin-bottom:6px}
.teach-profile h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.teach-profile .sub{color:var(--muted);font-size:.85rem;margin-bottom:22px}

.teach-profile .card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:22px;margin-bottom:18px}
.teach-profile .card h3{font-size:1rem;font-weight:800;margin-bottom:4px}
.teach-profile .card .h-sub{font-size:.78rem;color:var(--muted);margin-bottom:16px}

.teach-profile .row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.teach-profile .row--single{grid-template-columns:1fr}
.teach-profile .field{display:flex;flex-direction:column;gap:4px}
.teach-profile .field label{font-size:.7rem;color:var(--muted);font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.teach-profile .field input,
.teach-profile .field textarea,
.teach-profile .field select{
  width:100%;padding:11px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);
  font-family:inherit;font-size:.88rem;outline:none;transition:border-color .15s
}
.teach-profile .field textarea{min-height:96px;resize:vertical;line-height:1.45}
.teach-profile .field input:focus,
.teach-profile .field textarea:focus,
.teach-profile .field select:focus{border-color:var(--red)}
.teach-profile .field-help{font-size:.64rem;color:var(--muted);margin-top:2px}

.teach-profile .chips{display:flex;flex-wrap:wrap;gap:6px}
.teach-profile .chip{padding:6px 12px;border-radius:100px;border:1px solid var(--border);background:var(--bg);color:var(--text);font:inherit;font-size:.7rem;font-weight:600;cursor:pointer;transition:all .15s}
.teach-profile .chip:hover{border-color:var(--red);color:var(--red)}
.teach-profile .chip.active{background:var(--red);border-color:var(--red);color:#fff}

.teach-profile .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:6px}
.teach-profile .btn{padding:11px 20px;border-radius:11px;font-family:inherit;font-size:.85rem;font-weight:700;border:none;cursor:pointer;transition:all .15s}
.teach-profile .btn--primary{background:var(--red);color:#fff;box-shadow:0 2px 0 rgba(180,30,45,.3)}
.teach-profile .btn--primary:hover:not(:disabled){transform:translateY(-1px)}
.teach-profile .btn--ghost{background:var(--bg);color:var(--text);border:1px solid var(--border)}
.teach-profile .btn:disabled{opacity:.5;cursor:not-allowed}

.teach-profile .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.teach-profile .st{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px}
.teach-profile .st-label{font-size:.6rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.teach-profile .st-val{font-size:1.4rem;font-weight:800;margin-top:4px;letter-spacing:-.5px}
.teach-profile .st-sub{font-size:.6rem;color:var(--muted);margin-top:3px}

.teach-profile .ava-wrap{display:flex;align-items:center;gap:14px}
.teach-profile .ava{width:74px;height:74px;border-radius:18px;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.4rem;overflow:hidden;flex-shrink:0}
.teach-profile .ava img{width:100%;height:100%;object-fit:cover}

.teach-profile .visibility{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--bg)}
.teach-profile .visibility input[type=checkbox]{width:16px;height:16px;accent-color:var(--red)}
.teach-profile .visibility-text{font-size:.82rem}
.teach-profile .visibility-text b{display:block;margin-bottom:2px}
.teach-profile .visibility-text span{font-size:.7rem;color:var(--muted)}

.teach-profile .loading,.teach-profile .err{padding:60px;text-align:center;color:var(--muted)}
.teach-profile .err{color:var(--red)}

@media(max-width:760px){
  .teach-profile .row{grid-template-columns:1fr}
  .teach-profile .stats{grid-template-columns:1fr 1fr}
}
`

function getInitials(name: string | null | undefined) {
  if (!name) return "??"
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").toUpperCase().slice(0, 2) || "??"
}

function formatRub(kopecks: number): string {
  const rub = Math.round(kopecks / 100)
  return new Intl.NumberFormat("ru-RU").format(rub)
}

export default function TeacherProfilePage() {
  const [data, setData] = useState<TeacherProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Editable form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [bio, setBio] = useState("")
  const [hourlyRateRub, setHourlyRateRub] = useState("")
  const [trialRateRub, setTrialRateRub] = useState("")
  const [experienceYears, setExperienceYears] = useState("")
  const [education, setEducation] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [specs, setSpecs] = useState<string[]>([])
  const [langs, setLangs] = useState<string[]>([])
  const [isListed, setIsListed] = useState(true)
  const [certsRaw, setCertsRaw] = useState("") // одна сертификация на строку

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/teacher/profile/me", { cache: "no-store" })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? "Не удалось загрузить профиль")
        }
        const json = (await res.json()) as TeacherProfileData
        if (cancelled) return
        setData(json)
        setFirstName(json.profile.first_name ?? "")
        setLastName(json.profile.last_name ?? "")
        setPhone(json.profile.phone ?? "")
        setCity(json.profile.city ?? "")
        setBio(json.teacher?.bio ?? "")
        setHourlyRateRub(json.teacher ? String(Math.round((json.teacher.hourly_rate ?? 0) / 100)) : "")
        setTrialRateRub(json.teacher?.trial_rate ? String(Math.round(json.teacher.trial_rate / 100)) : "")
        setExperienceYears(json.teacher?.experience_years != null ? String(json.teacher.experience_years) : "")
        setEducation(json.teacher?.education ?? "")
        setVideoUrl(json.teacher?.video_intro_url ?? "")
        setSpecs(json.teacher?.specializations ?? [])
        setLangs(json.teacher?.languages?.length ? json.teacher.languages : ["en", "ru"])
        setIsListed(json.teacher?.is_listed ?? true)
        setCertsRaw((json.teacher?.certificates ?? []).join("\n"))
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Ошибка загрузки")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function toggleSpec(s: string) {
    setSpecs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : prev.length >= 8 ? prev : [...prev, s]))
  }
  function toggleLang(s: string) {
    setLangs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : prev.length >= 10 ? prev : [...prev, s]))
  }

  async function handleSave() {
    if (!data) return
    setSaving(true)
    try {
      const certsArr = certsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 10)

      const hourlyKop = (() => {
        const n = Number(hourlyRateRub.replace(/\s/g, ""))
        return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0
      })()
      const trialKop = (() => {
        if (!trialRateRub.trim()) return null
        const n = Number(trialRateRub.replace(/\s/g, ""))
        return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
      })()
      const yrs = (() => {
        const n = Number(experienceYears)
        return Number.isFinite(n) ? Math.max(0, Math.min(70, Math.round(n))) : 0
      })()

      const res = await fetch("/api/teacher/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          bio: bio.trim(),
          hourly_rate: hourlyKop,
          trial_rate: trialKop,
          experience_years: yrs,
          education: education.trim(),
          video_intro_url: videoUrl.trim() || null,
          specializations: specs,
          languages: langs,
          certificates: certsArr,
          is_listed: isListed,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error ?? "Не удалось сохранить")
      }
      toast.success("Профиль обновлён")
    } catch (e: any) {
      toast.error(e?.message ?? "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  const fullName = useMemo(() => {
    const fn = firstName || data?.profile.first_name || ""
    const ln = lastName || data?.profile.last_name || ""
    const combined = `${fn} ${ln}`.trim()
    return combined || data?.profile.full_name || data?.profile.email || ""
  }, [firstName, lastName, data])

  if (loading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="teach-profile">
          <h1>Мой <span className="gl">profile</span></h1>
          <div className="loading">Загружаем профиль…</div>
        </div>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="teach-profile">
          <h1>Мой <span className="gl">profile</span></h1>
          <div className="err">{error ?? "Профиль недоступен"}</div>
        </div>
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="teach-profile">
        <h1>Мой <span className="gl">profile</span></h1>
        <div className="sub">Заполни данные — они видны ученикам в каталоге преподавателей и на странице записи.</div>

        {/* Stats */}
        <div className="stats">
          <div className="st">
            <div className="st-label">Завершено уроков</div>
            <div className="st-val">{data.stats.completed_lessons}</div>
            <div className="st-sub">за всё время</div>
          </div>
          <div className="st">
            <div className="st-label">Часов в эфире</div>
            <div className="st-val">{data.stats.total_hours}</div>
            <div className="st-sub">из завершённых уроков</div>
          </div>
          <div className="st">
            <div className="st-label">Рейтинг</div>
            <div className="st-val">{data.stats.rating?.toFixed(1) || "—"}</div>
            <div className="st-sub">{data.stats.total_reviews} отзывов</div>
          </div>
          <div className="st">
            <div className="st-label">Статус</div>
            <div className="st-val" style={{ fontSize: "1rem" }}>
              {data.stats.is_verified ? "✓ Верифицирован" : "Без верификации"}
            </div>
            <div className="st-sub">{data.stats.is_listed ? "В каталоге" : "Скрыт"}</div>
          </div>
        </div>

        {/* Personal */}
        <div className="card">
          <h3>Личные данные</h3>
          <div className="h-sub">Имя и фамилия отображаются ученикам как ваши данные при записи.</div>

          <div className="ava-wrap" style={{ marginBottom: 18 }}>
            <div className="ava">
              {data.profile.avatar_url
                ? <img src={data.profile.avatar_url} alt={fullName} />
                : getInitials(fullName)}
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{fullName}</div>
              <div style={{ color: "var(--muted)", fontSize: ".75rem" }}>{data.profile.email}</div>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Имя</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="field">
              <label>Фамилия</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Телефон</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 …" />
            </div>
            <div className="field">
              <label>Город</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
        </div>

        {/* About */}
        <div className="card">
          <h3>О себе</h3>
          <div className="h-sub">Этот текст ученики увидят в каталоге и в модалке записи. Без воды — кто ты, как преподаёшь, для кого.</div>
          <div className="row row--single">
            <div className="field">
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={6} placeholder="Например: преподаю взрослым с уровня A1, готовлю к IELTS, провожу разговорные клубы по средам…" />
              <div className="field-help">{bio.length} / 2000</div>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Опыт, лет</label>
              <input
                type="number"
                min={0}
                max={70}
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Видео-визитка (URL)</label>
              <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/…" />
            </div>
          </div>
          <div className="row row--single">
            <div className="field">
              <label>Образование</label>
              <textarea value={education} onChange={(e) => setEducation(e.target.value)} rows={3} placeholder="МГЛУ, факультет английского языка (2018)…" />
            </div>
          </div>
        </div>

        {/* Specializations */}
        <div className="card">
          <h3>Специализации</h3>
          <div className="h-sub">Выбери до 8. По ним ученики фильтруют преподавателей в каталоге.</div>
          <div className="chips">
            {SPECIALIZATIONS_PRESET.map((s) => (
              <button key={s} type="button" className={`chip${specs.includes(s) ? " active" : ""}`} onClick={() => toggleSpec(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div className="card">
          <h3>Языки преподавания</h3>
          <div className="h-sub">Минимум один. Используются при подборе пробного урока.</div>
          <div className="chips">
            {LANGUAGES_PRESET.map((l) => (
              <button key={l} type="button" className={`chip${langs.includes(l) ? " active" : ""}`} onClick={() => toggleLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Certificates */}
        <div className="card">
          <h3>Сертификаты</h3>
          <div className="h-sub">По одному в строке. Например: CELTA (2020), IELTS Trainer Course (2022).</div>
          <div className="row row--single">
            <div className="field">
              <textarea value={certsRaw} onChange={(e) => setCertsRaw(e.target.value)} rows={4} placeholder="CELTA · 2020&#10;IELTS Trainer Course · 2022" />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card">
          <h3>Стоимость уроков</h3>
          <div className="h-sub">В рублях за час. На демо платежи отключены, но цены отображаются ученикам в каталоге.</div>
          <div className="row">
            <div className="field">
              <label>Час 1-on-1, ₽</label>
              <input
                type="text"
                inputMode="numeric"
                value={hourlyRateRub}
                onChange={(e) => setHourlyRateRub(e.target.value.replace(/\D/g, ""))}
                placeholder="1000"
              />
              <div className="field-help">сейчас в БД: {data.teacher ? `${formatRub(data.teacher.hourly_rate)} ₽/час` : "—"}</div>
            </div>
            <div className="field">
              <label>Пробный урок, ₽ (опционально)</label>
              <input
                type="text"
                inputMode="numeric"
                value={trialRateRub}
                onChange={(e) => setTrialRateRub(e.target.value.replace(/\D/g, ""))}
                placeholder="0 — бесплатно"
              />
              <div className="field-help">оставь пустым — пробный бесплатный</div>
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="card">
          <h3>Видимость в каталоге</h3>
          <div className="h-sub">Когда выключено — твоя карточка скрыта от учеников и пробный flow тебя не подбирает.</div>
          <label className="visibility">
            <input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} />
            <div className="visibility-text">
              <b>{isListed ? "В каталоге" : "Скрыт из каталога"}</b>
              <span>Можно временно отключить, если уходишь в отпуск или закрыл слоты</span>
            </div>
          </label>
        </div>

        <div className="actions">
          <button className="btn btn--primary" disabled={saving} onClick={handleSave}>
            {saving ? "Сохраняем…" : "Сохранить профиль"}
          </button>
        </div>
      </div>
    </>
  )
}
