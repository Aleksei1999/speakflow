// @ts-nocheck
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

// ---------------------------------------------------------------------------
// Settings page — ported from settings-page.html prototype, fully DB-driven
// via /api/settings/me (GET/PATCH) + Supabase Storage for avatar upload.
// ---------------------------------------------------------------------------

const SETTINGS_CSS = `
.settings-page{max-width:800px;margin:0 auto;padding:8px 0}
.settings-page *{box-sizing:border-box}

.settings-page .hdr{margin-bottom:24px}
.settings-page .hdr h1{font-size:1.6rem;font-weight:800;letter-spacing:-.6px}
.settings-page .hdr h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}

.settings-page .settings-layout{display:grid;grid-template-columns:200px 1fr;gap:24px}

/* Side nav */
.settings-page .s-nav{position:sticky;top:24px;align-self:start;display:flex;flex-direction:column;gap:2px}
.settings-page .s-nav button{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;font-size:.82rem;font-weight:500;color:var(--muted);background:none;border:none;cursor:pointer;transition:all .15s;width:100%;text-align:left}
.settings-page .s-nav button:hover{background:var(--surface);color:var(--text)}
.settings-page .s-nav button.active{background:var(--text);color:var(--surface);font-weight:700}
[data-theme="dark"] .settings-page .s-nav button.active{background:var(--red);color:#fff}
.settings-page .s-nav svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}

/* Content */
.settings-page .s-content{display:flex;flex-direction:column;gap:20px;min-width:0}

.settings-page .s-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;overflow:hidden}
.settings-page .s-card-head{padding:16px 20px;border-bottom:1px solid var(--border)}
.settings-page .s-card-head h3{font-size:.95rem;font-weight:800;letter-spacing:-.2px}
.settings-page .s-card-head p{font-size:.7rem;color:var(--muted);margin-top:2px}
.settings-page .s-card-body{padding:4px 20px 16px}

.settings-page .s-field{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);gap:16px}
.settings-page .s-field:last-child{border-bottom:none}
.settings-page .s-field-left{flex:1;min-width:0}
.settings-page .s-field-label{font-size:.82rem;font-weight:600}
.settings-page .s-field-desc{font-size:.68rem;color:var(--muted);margin-top:1px;line-height:1.3}

.settings-page .s-input{padding:9px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg);font-size:.82rem;font-weight:500;color:var(--text);outline:none;transition:border-color .15s;width:220px}
.settings-page .s-input:focus{border-color:var(--red)}
.settings-page .s-input:disabled{opacity:.6;cursor:not-allowed}

.settings-page .s-select{padding:9px 32px 9px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg);font-size:.82rem;font-weight:500;color:var(--text);appearance:none;outline:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}

.settings-page .toggle{width:42px;height:24px;border-radius:100px;background:var(--border);cursor:pointer;position:relative;flex-shrink:0;transition:background .2s;border:none}
.settings-page .toggle.on{background:var(--lime)}
.settings-page .toggle::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1);transition:transform .2s}
.settings-page .toggle.on::after{transform:translateX(18px)}

.settings-page .s-btn{padding:8px 18px;border-radius:10px;font-size:.78rem;font-weight:600;transition:all .15s;flex-shrink:0;border:none;cursor:pointer}
.settings-page .s-btn:disabled{opacity:.55;cursor:not-allowed}
.settings-page .s-btn--outline{border:1px solid var(--border);background:var(--surface);color:var(--text)}
.settings-page .s-btn--outline:hover:not(:disabled){border-color:var(--text)}
.settings-page .s-btn--red{background:var(--red);color:#fff}
.settings-page .s-btn--red:hover:not(:disabled){filter:brightness(.9)}
.settings-page .s-btn--danger{border:1px solid color-mix(in srgb,var(--red) 20%,transparent);background:color-mix(in srgb,var(--red) 4%,transparent);color:var(--red)}
.settings-page .s-btn--danger:hover:not(:disabled){background:color-mix(in srgb,var(--red) 8%,transparent)}
.settings-page .s-btn--save{background:var(--text);color:var(--surface)}
.settings-page .s-btn--save:hover:not(:disabled){background:var(--red);color:#fff}

/* Connected */
.settings-page .conn{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)}
.settings-page .conn:last-child{border-bottom:none}
.settings-page .conn-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.settings-page .conn-icon svg{width:20px;height:20px}
.settings-page .conn-icon--google{background:rgba(66,133,244,.08)}
.settings-page .conn-icon--telegram{background:rgba(42,171,238,.08)}
.settings-page .conn-info{flex:1}
.settings-page .conn-name{font-size:.82rem;font-weight:600}
.settings-page .conn-status{font-size:.65rem;color:var(--muted)}
.settings-page .conn-status--ok{color:#22c55e}

/* Avatar */
.settings-page .ava-upload{display:flex;align-items:center;gap:16px;padding:12px 0}
.settings-page .ava-preview{width:64px;height:64px;border-radius:50%;background:var(--red);display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;color:#fff;flex-shrink:0;border:3px solid var(--lime);overflow:hidden;position:relative}
.settings-page .ava-preview img{width:100%;height:100%;object-fit:cover}
.settings-page .ava-preview--busy::after{content:'';position:absolute;inset:0;background:rgba(0,0,0,.35);border-radius:50%}
.settings-page .ava-actions{display:flex;flex-direction:column;gap:4px}
.settings-page .ava-hint{font-size:.62rem;color:var(--muted)}

/* Theme cards */
.settings-page .theme-options{display:flex;gap:10px;margin-top:4px}
.settings-page .theme-card{width:80px;padding:12px 8px;border-radius:12px;border:2px solid var(--border);text-align:center;cursor:pointer;transition:all .15s;background:var(--surface)}
.settings-page .theme-card:hover{border-color:var(--text)}
.settings-page .theme-card.active{border-color:var(--red)}
.settings-page .theme-preview{width:100%;height:36px;border-radius:6px;margin-bottom:6px}
.settings-page .theme-preview--light{background:linear-gradient(135deg,#FAFAF8,#EEEEEA)}
.settings-page .theme-preview--dark{background:linear-gradient(135deg,#1A1A18,#0F0F0E)}
.settings-page .theme-preview--auto{background:linear-gradient(135deg,#FAFAF8 50%,#1A1A18 50%)}
.settings-page .theme-name{font-size:.62rem;font-weight:600}

.settings-page .lang-option{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;border:1px solid var(--border);cursor:pointer;transition:all .15s;font-size:.78rem;font-weight:600;background:var(--surface);color:var(--text)}
.settings-page .lang-option:hover{border-color:var(--text)}
.settings-page .lang-option.active{border-color:var(--red);background:color-mix(in srgb,var(--red) 3%,transparent)}

/* Danger zone */
.settings-page .danger-zone{border-color:color-mix(in srgb,var(--red) 15%,var(--border))}
.settings-page .danger-zone .s-card-head{background:color-mix(in srgb,var(--red) 3%,transparent)}
.settings-page .danger-zone h3{color:var(--red)}

/* Save bar */
.settings-page .save-bar{position:sticky;bottom:0;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 -4px 20px var(--shadow);margin-top:8px;z-index:5}
.settings-page .save-bar-text{font-size:.78rem;color:var(--muted)}
.settings-page .save-bar-actions{display:flex;gap:8px}

.settings-page .loading-wrap{display:flex;align-items:center;justify-content:center;padding:64px 0;color:var(--muted);font-size:.85rem}

@media(max-width:768px){
  .settings-page .settings-layout{grid-template-columns:1fr}
  .settings-page .s-nav{position:relative;top:0;flex-direction:row;overflow-x:auto;gap:4px;padding-bottom:4px;-webkit-overflow-scrolling:touch}
  .settings-page .s-nav button{white-space:nowrap;padding:8px 14px;font-size:.75rem}
  .settings-page .s-input{width:100%}
  .settings-page .s-field{flex-direction:column;align-items:flex-start;gap:8px}
  .settings-page .theme-options{flex-wrap:wrap}
}
`

const NAV = [
  { id: "account", label: "Аккаунт", icon: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  { id: "notifications", label: "Уведомления", icon: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></> },
  { id: "appearance", label: "Оформление", icon: <><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></> },
  { id: "privacy", label: "Безопасность", icon: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
  { id: "connected", label: "Подключения", icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></> },
  { id: "subscription", label: "Подписка", icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/> },
  { id: "danger", label: "Удаление", icon: <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></> },
]

const TIMEZONES = [
  "Europe/Kaliningrad",
  "Europe/Moscow",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Omsk",
  "Asia/Krasnoyarsk",
  "Asia/Irkutsk",
  "Asia/Yakutsk",
  "Asia/Vladivostok",
]

const TZ_LABELS: Record<string, string> = {
  "Europe/Kaliningrad": "UTC+2 · Калининград",
  "Europe/Moscow": "UTC+3 · Москва",
  "Europe/Samara": "UTC+4 · Самара",
  "Asia/Yekaterinburg": "UTC+5 · Екатеринбург",
  "Asia/Omsk": "UTC+6 · Омск",
  "Asia/Krasnoyarsk": "UTC+7 · Красноярск",
  "Asia/Irkutsk": "UTC+8 · Иркутск",
  "Asia/Yakutsk": "UTC+9 · Якутск",
  "Asia/Vladivostok": "UTC+10 · Владивосток",
}

type Settings = {
  account: {
    id: string
    email: string | null
    first_name: string | null
    last_name: string | null
    full_name: string | null
    avatar_url: string | null
    phone: string | null
    timezone: string
    city: string | null
    language: "ru" | "en"
  }
  notifications: {
    lesson_reminders: boolean
    daily_challenge: boolean
    streak_warning: boolean
    new_clubs: boolean
    achievements: boolean
    leaderboard: boolean
    email_digest: boolean
    marketing: boolean
    channel: "telegram" | "email" | "push" | "sms"
  }
  ui: {
    theme: "light" | "dark" | "auto"
    show_xp_bar: boolean
    sounds: boolean
    confetti: boolean
  }
  visibility: {
    leaderboard_public: boolean
    visible_to_teachers: boolean
  }
  subscription: { tier: "free" | "pro"; until: string | null }
  connected: { google: boolean; telegram: boolean }
}

function applyTheme(theme: "light" | "dark" | "auto") {
  if (typeof window === "undefined") return
  localStorage.setItem("theme", theme)
  const resolved =
    theme === "auto"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme
  document.documentElement.setAttribute("data-theme", resolved)
}

function dateRu(iso: string | null) {
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

export default function StudentSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("account")
  const [data, setData] = useState<Settings | null>(null)
  const [original, setOriginal] = useState<Settings | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const res = await fetch("/api/settings/me")
    if (!res.ok) {
      toast.error("Не удалось загрузить настройки")
      setLoading(false)
      return
    }
    const json = (await res.json()) as Settings
    setData(json)
    setOriginal(JSON.parse(JSON.stringify(json)))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const dirty = useMemo(() => {
    if (!data || !original) return false
    return JSON.stringify(data) !== JSON.stringify(original)
  }, [data, original])

  const patch = <K extends keyof Settings>(section: K, update: Partial<Settings[K]>) => {
    setData((prev) => (prev ? { ...prev, [section]: { ...prev[section], ...update } } : prev))
  }

  const handleSave = async () => {
    if (!data || !original) return
    setSaving(true)
    try {
      const body: any = {}
      if (JSON.stringify(data.account) !== JSON.stringify(original.account)) {
        body.account = {
          first_name: data.account.first_name ?? "",
          last_name: data.account.last_name,
          phone: data.account.phone,
          city: data.account.city,
          timezone: data.account.timezone,
          language: data.account.language,
        }
      }
      if (JSON.stringify(data.notifications) !== JSON.stringify(original.notifications)) {
        body.notifications = data.notifications
      }
      if (JSON.stringify(data.ui) !== JSON.stringify(original.ui)) {
        body.ui = data.ui
      }
      if (JSON.stringify(data.visibility) !== JSON.stringify(original.visibility)) {
        body.visibility = data.visibility
      }

      if (Object.keys(body).length === 0) {
        setSaving(false)
        return
      }

      const res = await fetch("/api/settings/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? "Не удалось сохранить")
        return
      }
      toast.success("Настройки сохранены")
      setOriginal(JSON.parse(JSON.stringify(data)))
      if (body.ui?.theme) applyTheme(body.ui.theme)
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (!original) return
    setData(JSON.parse(JSON.stringify(original)))
    if (original.ui.theme) applyTheme(original.ui.theme)
    toast.info("Изменения отменены")
  }

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !data) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл больше 5 МБ")
      return
    }
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
      const storagePath = `avatars/${data.account.id}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(storagePath, file, { cacheControl: "3600", upsert: true })
      if (uploadErr) {
        toast.error("Ошибка загрузки фото")
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(storagePath)
      // Cache-bust so the image refreshes even when URL is the same.
      const url = `${publicUrl}?t=${Date.now()}`

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", data.account.id)
      if (updErr) {
        toast.error("Не удалось сохранить ссылку на фото")
        return
      }

      setData((prev) => (prev ? { ...prev, account: { ...prev.account, avatar_url: url } } : prev))
      setOriginal((prev) => (prev ? { ...prev, account: { ...prev.account, avatar_url: url } } : prev))
      toast.success("Фото обновлено")
    } catch {
      toast.error("Не удалось загрузить фото")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const stub = (title: string) => () => toast.info(`${title} — скоро будет доступно`)

  const supabase = createClient()

  const handleConnect = async (provider: "google" | "telegram") => {
    if (provider === "telegram") {
      toast.info("Telegram подключается через бот — скоро будет доступно")
      return
    }
    // Try linkIdentity first (requires Manual Linking enabled in Supabase).
    // Fallback to signInWithOAuth which auto-links by email if emails match.
    const link = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/student/settings` },
    })
    if (!link.error) return

    const msg = link.error.message || ""
    if (/manual.?linking/i.test(msg) || /404/.test(msg)) {
      toast.info("Перенаправляем на Google — используй тот же email, что и сейчас")
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/student/settings`,
          queryParams: { prompt: "select_account" },
        },
      })
      if (oauthErr) toast.error(oauthErr.message || "Не удалось открыть Google")
      return
    }
    if (/provider.*not (enabled|configured)/i.test(msg)) {
      toast.error("Google провайдер не включён в Supabase")
      return
    }
    toast.error(msg || "Не удалось подключить аккаунт")
  }

  const handleDisconnect = async (provider: "google" | "telegram") => {
    if (provider === "telegram") {
      toast.info("Telegram отключается через бот — скоро будет доступно")
      return
    }
    const { data: identitiesData, error: iErr } = await supabase.auth.getUserIdentities()
    if (iErr || !identitiesData) {
      toast.error("Не удалось получить идентичности")
      return
    }
    const target = identitiesData.identities.find((i: any) => i.provider === provider)
    if (!target) {
      toast.error("Этот аккаунт уже не подключён")
      return
    }
    if (identitiesData.identities.length <= 1) {
      toast.error("Нельзя отключить единственный способ входа")
      return
    }
    const { error } = await supabase.auth.unlinkIdentity(target)
    if (error) {
      toast.error(error.message || "Не удалось отключить аккаунт")
      return
    }
    toast.success("Google отключён")
    load()
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SETTINGS_CSS }} />
      <div className="settings-page">
        <div className="hdr">
          <h1>
            <span className="gl">Settings</span>
          </h1>
        </div>

        {loading || !data ? (
          <div className="loading-wrap">Загружаем настройки…</div>
        ) : (
          <div className="settings-layout">
            <nav className="s-nav">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={activeSection === n.id ? "active" : ""}
                  onClick={() => {
                    setActiveSection(n.id)
                    const el = document.getElementById(`sec-${n.id}`)
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                >
                  <svg viewBox="0 0 24 24">{n.icon}</svg>
                  {n.label}
                </button>
              ))}
            </nav>

            <div className="s-content">
              <AccountSection
                data={data}
                onPatch={(u) => patch("account", u)}
                onUpload={() => fileInputRef.current?.click()}
                uploading={uploading}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarPick}
                style={{ display: "none" }}
              />

              <NotificationsSection
                value={data.notifications}
                onPatch={(u) => patch("notifications", u)}
              />

              {/* TEMP: disabled by user request on 2026-04-23 — restore when needed.
              <AppearanceSection
                value={data.ui}
                onPatch={(u) => {
                  patch("ui", u)
                  if (u.theme) applyTheme(u.theme)
                }}
              />
              */}

              <SecuritySection
                value={data.visibility}
                onChangePassword={stub("Смена пароля")}
                onManageSessions={stub("Управление сессиями")}
                onPatch={(u) => patch("visibility", u)}
              />

              <ConnectedSection
                connected={data.connected}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />

              <SubscriptionSection
                value={data.subscription}
                onChangePayment={stub("Изменение способа оплаты")}
                onCancel={stub("Отмена подписки")}
              />

              {/* TEMP: disabled by user request on 2026-04-23 — restore when needed.
              <DangerSection
                onExport={stub("Экспорт данных")}
                onReset={stub("Сброс прогресса")}
                onDelete={stub("Удаление аккаунта")}
              />
              */}

              <div className="save-bar">
                <div className="save-bar-text">
                  {dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}
                </div>
                <div className="save-bar-actions">
                  <button
                    className="s-btn s-btn--outline"
                    onClick={handleCancel}
                    disabled={!dirty || saving}
                  >
                    Отменить
                  </button>
                  <button
                    className="s-btn s-btn--save"
                    onClick={handleSave}
                    disabled={!dirty || saving}
                  >
                    {saving ? "Сохраняем…" : "Сохранить изменения"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------

function initials(first?: string | null, last?: string | null) {
  const a = (first?.[0] ?? "").toUpperCase()
  const b = (last?.[0] ?? "").toUpperCase()
  return (a + b) || "?"
}

function AccountSection({
  data,
  onPatch,
  onUpload,
  uploading,
}: {
  data: Settings
  onPatch: (u: Partial<Settings["account"]>) => void
  onUpload: () => void
  uploading: boolean
}) {
  const a = data.account
  return (
    <div className="s-card" id="sec-account">
      <div className="s-card-head">
        <h3>Аккаунт</h3>
        <p>Основная информация профиля</p>
      </div>
      <div className="s-card-body">
        <div className="ava-upload">
          <div className={`ava-preview${uploading ? " ava-preview--busy" : ""}`}>
            {a.avatar_url ? (
              <img src={a.avatar_url} alt={a.full_name ?? "Аватар"} />
            ) : (
              initials(a.first_name, a.last_name)
            )}
          </div>
          <div className="ava-actions">
            <button className="s-btn s-btn--outline" onClick={onUpload} disabled={uploading}>
              {uploading ? "Загружаем…" : "Загрузить фото"}
            </button>
            <div className="ava-hint">JPG, PNG, WEBP до 5 МБ. Рекомендуем 400×400 px</div>
          </div>
        </div>

        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">Имя</div></div>
          <input
            className="s-input"
            type="text"
            value={a.first_name ?? ""}
            onChange={(e) => onPatch({ first_name: e.target.value })}
            placeholder="Имя"
          />
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">Фамилия</div></div>
          <input
            className="s-input"
            type="text"
            value={a.last_name ?? ""}
            onChange={(e) => onPatch({ last_name: e.target.value || null })}
            placeholder="Фамилия"
          />
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Email</div>
            <div className="s-field-desc">Используется для входа и уведомлений</div>
          </div>
          <input className="s-input" type="email" value={a.email ?? ""} disabled />
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">Телефон</div></div>
          <input
            className="s-input"
            type="tel"
            value={a.phone ?? ""}
            onChange={(e) => onPatch({ phone: e.target.value || null })}
            placeholder="+7 (999) 000-00-00"
          />
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">Город</div></div>
          <input
            className="s-input"
            type="text"
            value={a.city ?? ""}
            onChange={(e) => onPatch({ city: e.target.value || null })}
            placeholder="Москва"
          />
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">Часовой пояс</div></div>
          <select
            className="s-select"
            value={a.timezone}
            onChange={(e) => onPatch({ timezone: e.target.value })}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{TZ_LABELS[tz] ?? tz}</option>
            ))}
          </select>
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">Язык интерфейса</div></div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className={`lang-option${a.language === "ru" ? " active" : ""}`}
              onClick={() => onPatch({ language: "ru" })}
            >
              🇷🇺 Русский
            </button>
            <button
              type="button"
              className={`lang-option${a.language === "en" ? " active" : ""}`}
              onClick={() => onPatch({ language: "en" })}
            >
              🇬🇧 English
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`toggle${on ? " on" : ""}`}
      onClick={() => onChange(!on)}
    />
  )
}

function NotificationsSection({
  value,
  onPatch,
}: {
  value: Settings["notifications"]
  onPatch: (u: Partial<Settings["notifications"]>) => void
}) {
  const rows: Array<[keyof Settings["notifications"], string, string]> = [
    ["lesson_reminders", "Напоминание об уроке", "За 30 мин до начала урока или клуба"],
    ["daily_challenge", "Daily Challenge", "Ежедневное напоминание выполнить задание"],
    ["streak_warning", "Streak на грани", "Предупреждение если стрик может прерваться"],
    ["new_clubs", "Новые Speaking Clubs", "Когда появляются новые клубы на интересные темы"],
    ["achievements", "Достижения и XP", "Уведомления о новых ачивках и level up"],
    ["leaderboard", "Лидерборд", "Когда кто-то обгоняет тебя в рейтинге"],
    ["email_digest", "Email-рассылка", "Еженедельные итоги прогресса и рекомендации"],
    ["marketing", "Маркетинговые уведомления", "Акции, скидки и новые функции"],
  ]
  return (
    <div className="s-card" id="sec-notifications">
      <div className="s-card-head">
        <h3>Уведомления</h3>
        <p>Настрой что и как хочешь получать</p>
      </div>
      <div className="s-card-body">
        {rows.map(([key, label, desc]) => (
          <div className="s-field" key={key}>
            <div className="s-field-left">
              <div className="s-field-label">{label}</div>
              <div className="s-field-desc">{desc}</div>
            </div>
            <Toggle
              on={Boolean(value[key])}
              onChange={(next) => onPatch({ [key]: next } as any)}
            />
          </div>
        ))}
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Канал уведомлений</div>
            <div className="s-field-desc">Где получать напоминания</div>
          </div>
          <select
            className="s-select"
            value={value.channel}
            onChange={(e) => onPatch({ channel: e.target.value as any })}
          >
            <option value="telegram">Telegram бот</option>
            <option value="email">Email</option>
            <option value="push">Push в браузере</option>
            <option value="sms">SMS</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function AppearanceSection({
  value,
  onPatch,
}: {
  value: Settings["ui"]
  onPatch: (u: Partial<Settings["ui"]>) => void
}) {
  const themes: Array<["light" | "dark" | "auto", string, string]> = [
    ["light", "Светлая", "theme-preview--light"],
    ["dark", "Тёмная", "theme-preview--dark"],
    ["auto", "Авто", "theme-preview--auto"],
  ]
  return (
    <div className="s-card" id="sec-appearance">
      <div className="s-card-head">
        <h3>Оформление</h3>
        <p>Внешний вид платформы</p>
      </div>
      <div className="s-card-body">
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Тема</div>
            <div className="s-field-desc">Выбери светлую, тёмную или автоматическую</div>
          </div>
          <div className="theme-options">
            {themes.map(([id, name, cls]) => (
              <div
                key={id}
                className={`theme-card${value.theme === id ? " active" : ""}`}
                onClick={() => onPatch({ theme: id })}
              >
                <div className={`theme-preview ${cls}`}></div>
                <div className="theme-name">{name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Показывать XP на странице</div>
            <div className="s-field-desc">Отображать прогресс-бар XP в верхней части</div>
          </div>
          <Toggle on={value.show_xp_bar} onChange={(n) => onPatch({ show_xp_bar: n })} />
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Звуки достижений</div>
            <div className="s-field-desc">Звуковой эффект при получении XP и ачивок</div>
          </div>
          <Toggle on={value.sounds} onChange={(n) => onPatch({ sounds: n })} />
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Конфетти при level up</div>
            <div className="s-field-desc">Анимация конфетти при переходе на новый уровень</div>
          </div>
          <Toggle on={value.confetti} onChange={(n) => onPatch({ confetti: n })} />
        </div>
      </div>
    </div>
  )
}

function SecuritySection({
  value,
  onChangePassword,
  onManageSessions,
  onPatch,
}: {
  value: Settings["visibility"]
  onChangePassword: () => void
  onManageSessions: () => void
  onPatch: (u: Partial<Settings["visibility"]>) => void
}) {
  return (
    <div className="s-card" id="sec-privacy">
      <div className="s-card-head">
        <h3>Безопасность</h3>
        <p>Пароль и настройки входа</p>
      </div>
      <div className="s-card-body">
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Изменить пароль</div>
            <div className="s-field-desc">Отправим письмо с ссылкой на восстановление</div>
          </div>
          <a className="s-btn s-btn--outline" href="/reset-password">Изменить</a>
        </div>
        {/* Активные сессии — скрыто до интеграции с Supabase Admin API */}
        {/* <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Активные сессии</div>
            <div className="s-field-desc">Управление устройствами и выход с чужого устройства</div>
          </div>
          <button className="s-btn s-btn--outline" onClick={onManageSessions}>Управление</button>
        </div> */}
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Видимость в лидерборде</div>
            <div className="s-field-desc">Показывать имя и прогресс другим участникам</div>
          </div>
          <Toggle
            on={value.leaderboard_public}
            onChange={(n) => onPatch({ leaderboard_public: n })}
          />
        </div>
        {/* «Показывать профиль преподавателям» — скрыто, флаг ещё нигде не читается на бэке */}
        {/* <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Показывать профиль преподавателям</div>
            <div className="s-field-desc">Преподаватели видят твой уровень, цели и интересы</div>
          </div>
          <Toggle
            on={value.visible_to_teachers}
            onChange={(n) => onPatch({ visible_to_teachers: n })}
          />
        </div> */}
      </div>
    </div>
  )
}

function ConnectedSection({
  connected,
  onConnect,
  onDisconnect,
}: {
  connected: Settings["connected"]
  onConnect: (provider: "google" | "telegram") => void
  onDisconnect: (provider: "google" | "telegram") => void
}) {
  const toggle = (provider: "google" | "telegram", isConnected: boolean) =>
    isConnected ? onDisconnect(provider) : onConnect(provider)
  return (
    <div className="s-card" id="sec-connected">
      <div className="s-card-head">
        <h3>Подключённые аккаунты</h3>
        <p>Вход через соцсети и интеграции</p>
      </div>
      <div className="s-card-body">
        <div className="conn">
          <div className="conn-icon conn-icon--google">
            <svg viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div className="conn-info">
            <div className="conn-name">Google</div>
            <div className={`conn-status${connected.google ? " conn-status--ok" : ""}`}>
              {connected.google ? "Подключён" : "Не подключён"}
            </div>
          </div>
          <button className="s-btn s-btn--outline" onClick={() => toggle("google", connected.google)}>
            {connected.google ? "Отключить" : "Подключить"}
          </button>
        </div>
        <div className="conn">
          <div className="conn-icon conn-icon--telegram">
            <svg viewBox="0 0 24 24">
              <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a1.5 1.5 0 0 0 .108 2.79l4.716 1.572 2.25 6a1.5 1.5 0 0 0 2.529.6l2.407-2.407 4.473 3.315a1.5 1.5 0 0 0 2.341-.924l3-16.5a2.25 2.25 0 0 0-3.302-2.161z" fill="#2AABEE"/>
            </svg>
          </div>
          <div className="conn-info">
            <div className="conn-name">Telegram</div>
            <div className={`conn-status${connected.telegram ? " conn-status--ok" : ""}`}>
              {connected.telegram ? "Подключён" : "Не подключён"}
            </div>
          </div>
          <button className="s-btn s-btn--outline" onClick={() => toggle("telegram", connected.telegram)}>
            {connected.telegram ? "Отключить" : "Подключить"}
          </button>
        </div>
      </div>
    </div>
  )
}

function SubscriptionSection({
  value,
  onChangePayment,
  onCancel,
}: {
  value: Settings["subscription"]
  onChangePayment: () => void
  onCancel: () => void
}) {
  const isPro = value.tier === "pro"
  return (
    <div className="s-card" id="sec-subscription">
      <div className="s-card-head">
        <h3>Подписка</h3>
        <p>Управление подпиской Raw Pro</p>
      </div>
      <div className="s-card-body">
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Текущий план</div>
            <div
              className="s-field-desc"
              style={{ color: isPro ? "var(--red)" : "var(--muted)", fontWeight: 700 }}
            >
              {isPro ? "Raw Pro · 1 490 ₽/мес" : "Free · базовый доступ"}
            </div>
          </div>
          <span
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              background: isPro
                ? "color-mix(in srgb, var(--lime) 12%, transparent)"
                : "color-mix(in srgb, var(--muted) 10%, transparent)",
              color: isPro ? "var(--lime-dark)" : "var(--muted)",
              fontSize: ".68rem",
              fontWeight: 700,
            }}
          >
            {isPro ? "Активна" : "Не активна"}
          </span>
        </div>
        {isPro ? (
          <>
            <div className="s-field">
              <div className="s-field-left">
                <div className="s-field-label">Следующее списание</div>
                <div className="s-field-desc">{dateRu(value.until)} · 1 490 ₽</div>
              </div>
            </div>
            <div className="s-field">
              <div className="s-field-left">
                <div className="s-field-label">Способ оплаты</div>
                <div className="s-field-desc">Управляется через Yookassa</div>
              </div>
              <button className="s-btn s-btn--outline" onClick={onChangePayment}>Изменить</button>
            </div>
            <div className="s-field">
              <div className="s-field-left">
                <div className="s-field-label">Отменить подписку</div>
                <div className="s-field-desc">Доступ сохранится до конца оплаченного периода</div>
              </div>
              <button className="s-btn s-btn--danger" onClick={onCancel}>Отменить</button>
            </div>
          </>
        ) : (
          <div className="s-field">
            <div className="s-field-left">
              <div className="s-field-label">Апгрейд до Raw Pro</div>
              <div className="s-field-desc">Безлимитные клубы, расширенные материалы, приоритет в очереди</div>
            </div>
            <button className="s-btn s-btn--red" onClick={onChangePayment}>Оформить</button>
          </div>
        )}
      </div>
    </div>
  )
}

function DangerSection({
  onExport,
  onReset,
  onDelete,
}: {
  onExport: () => void
  onReset: () => void
  onDelete: () => void
}) {
  return (
    <div className="s-card danger-zone" id="sec-danger">
      <div className="s-card-head">
        <h3>Опасная зона</h3>
        <p>Необратимые действия с аккаунтом</p>
      </div>
      <div className="s-card-body">
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Экспорт данных</div>
            <div className="s-field-desc">Скачать все свои данные: историю уроков, XP, ачивки</div>
          </div>
          <button className="s-btn s-btn--outline" onClick={onExport}>Экспортировать</button>
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Сбросить прогресс</div>
            <div className="s-field-desc">Обнулить XP, стрики и ачивки. Уроки сохранятся.</div>
          </div>
          <button className="s-btn s-btn--danger" onClick={onReset}>Сбросить</button>
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Удалить аккаунт</div>
            <div className="s-field-desc">Все данные будут удалены навсегда. Баланс не возвращается.</div>
          </div>
          <button className="s-btn s-btn--danger" onClick={onDelete}>Удалить аккаунт</button>
        </div>
      </div>
    </div>
  )
}
