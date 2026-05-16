// @ts-nocheck
"use client"

import "@/styles/dashboard/student-settings.css"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { MfaTotpSection } from "@/components/auth/mfa-totp-section"

// ---------------------------------------------------------------------------
// Settings page — ported from settings-page.html prototype, fully DB-driven
// via /api/settings/me (GET/PATCH) + Supabase Storage for avatar upload.
// ---------------------------------------------------------------------------

// «Оформление» и «Удаление» временно скрыты из NAV — соответствующие
// секции (AppearanceSection / DangerSection) закомменчены ниже как не-
// доделанные. Когда раскомментим — добавим обратно.
const NAV = [
  { id: "account", label: "Аккаунт", icon: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  { id: "notifications", label: "Уведомления", icon: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></> },
  { id: "privacy", label: "Безопасность", icon: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
  { id: "mfa", label: "2FA", icon: <><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
  { id: "connected", label: "Подключения", icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></> },
  { id: "subscription", label: "Подписка", icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/> },
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
  // Middleware sets ?mfa=required after a soft-redirect for admins without
  // a verified TOTP factor. We use it (a) to scroll the user to the MFA
  // card on mount and (b) to show a red "обязательно" banner inside it.
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  // Эта же страница re-export'нута в /teacher/settings (см. memory
  // 2026-04-22 Teacher reuse student). Гэйтим студенческие XP-toggle'ы
  // (Daily Challenge / Streak / Достижения / Лидерборд) и блок «Видимость
  // в лидерборде» в Безопасности по pathname, чтобы у преподов их не было.
  const isTeacher = (pathname ?? "").startsWith("/teacher")
  const mfaRequired = searchParams?.get("mfa") === "required"
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("account")
  const [data, setData] = useState<Settings | null>(null)
  const [original, setOriginal] = useState<Settings | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Telegram linking modal state
  const [tgModal, setTgModal] = useState<{
    open: boolean
    code?: string
    deepLink?: string | null
    expiresAt?: string
    polling?: boolean
  } | null>(null)

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

  // When middleware redirects us here with ?mfa=required (admin without a
  // verified TOTP factor), jump straight to the MFA card on the first
  // render. We give the layout one tick to settle, then scroll.
  useEffect(() => {
    if (!mfaRequired || loading) return
    const el = document.getElementById("sec-mfa")
    if (!el) return
    // scroll-margin-top на .s-card задаёт визуальный отступ; нативный
    // scrollIntoView сам найдёт правильный scroll-container (window или
    // .main-content — зависит от того, где реально живёт overflow).
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [mfaRequired, loading])

  // While the Telegram link modal is open, poll status every 3s. As soon as
  // the bot writes telegram_chat_id we close the modal and refresh settings.
  useEffect(() => {
    if (!tgModal?.open || !tgModal.polling) return
    let cancelled = false
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/telegram/link/status", { cache: "no-store" })
        if (!r.ok) return
        const j = await r.json()
        if (cancelled) return
        if (j?.connected) {
          setTgModal(null)
          toast.success("Telegram подключён")
          load()
        }
      } catch {}
    }, 3_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [tgModal?.open, tgModal?.polling])

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
      // Language change → server PATCH already set rwen_locale cookie.
      // router.refresh() re-renders the dashboard layout (server) so
      // NextIntlClientProvider picks up the new messages on the next paint.
      if (body.account?.language && body.account.language !== original.account.language) {
        router.refresh()
      }
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
      // RLS storage.objects (миграция 072): первая папка должна быть
      // auth.uid()::text. Bucket уже `avatars`, поэтому путь — `<uid>/avatar.<ext>`,
      // НЕ `avatars/<uid>.<ext>` (с двойным префиксом RLS блокирует).
      const storagePath = `${data.account.id}/avatar.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(storagePath, file, { cacheControl: "3600", upsert: true })
      if (uploadErr) {
        console.error("[avatar upload] storage error:", uploadErr)
        toast.error(`Ошибка загрузки: ${uploadErr.message || "неизвестная"}`)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(storagePath)
      // Cache-bust so the image refreshes even when URL is the same.
      const url = `${publicUrl}?t=${Date.now()}`

      // Используем /api/settings/me PATCH вместо прямого UPDATE — оно
      // вызывает invalidateProfile() и evict'ит per-user cache
      // (getCachedProfile, TTL 120s). Без этого sidebar Avatar остаётся
      // со старым URL до 2 минут.
      const apiRes = await fetch("/api/settings/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: { avatar_url: url } }),
      })
      if (!apiRes.ok) {
        const j = await apiRes.json().catch(() => ({}))
        toast.error(`Не удалось сохранить ссылку на фото${j?.error ? ": " + j.error : ""}`)
        return
      }

      setData((prev) => (prev ? { ...prev, account: { ...prev.account, avatar_url: url } } : prev))
      setOriginal((prev) => (prev ? { ...prev, account: { ...prev.account, avatar_url: url } } : prev))
      toast.success("Фото обновлено")
      // Заставляем server-layout перечитать profile (после invalidate
      // в API кэш уже evict'нут, refresh подтянет свежий avatar в sidebar).
      router.refresh()
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
      try {
        const res = await fetch("/api/telegram/link/start", { method: "POST" })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json?.error || "Не удалось сгенерировать код")
          return
        }
        setTgModal({
          open: true,
          code: json.code,
          deepLink: json.deepLink ?? null,
          expiresAt: json.expiresAt,
          polling: true,
        })
      } catch {
        toast.error("Ошибка сети")
      }
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
      try {
        const res = await fetch("/api/telegram/link/disconnect", { method: "POST" })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error(j?.error || "Не удалось отключить Telegram")
          return
        }
        toast.success("Telegram отключён")
        setData((prev) =>
          prev
            ? { ...prev, connected: { ...prev.connected, telegram: false } }
            : prev
        )
        load()
      } catch {
        toast.error("Ошибка сети")
      }
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
      <div className="settings-page">
        <div className="hdr">
          <h1>
            Мои <span className="gl">settings</span>
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
                    if (!el) return
                    // Раньше пытались скроллить .dash .main-content вручную,
                    // но у этого контейнера height не зафиксирована — реальный
                    // overflow-scroll живёт на window, и container.scrollTo
                    // ничего не делал. scrollIntoView сам найдёт правильный
                    // ancestor; визуальный отступ задаёт scroll-margin-top на
                    // .s-card в student-settings.css.
                    el.scrollIntoView({ behavior: "smooth", block: "start" })
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
                isTeacher={isTeacher}
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
                isTeacher={isTeacher}
              />

              {/*
                TOTP MFA — opt-in for students/teachers, soft-enforced for
                admins via middleware + env flag ENABLE_ADMIN_MFA_ENFORCE.
                When middleware redirects an admin here with ?mfa=required,
                we surface a red banner inside the section.
              */}
              <MfaTotpSection required={mfaRequired} />

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

      {tgModal?.open ? (
        <TelegramLinkModal
          code={tgModal.code ?? ""}
          deepLink={tgModal.deepLink ?? null}
          onClose={() => setTgModal(null)}
        />
      ) : null}
    </>
  )
}

function TelegramLinkModal({
  code,
  deepLink,
  onClose,
}: {
  code: string
  deepLink: string | null
  onClose: () => void
}) {
  return (
    <div className="tg-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tg-card">
        <button type="button" className="x" onClick={onClose}>
          ×
        </button>
        <h2>📱 Подключить Telegram</h2>
        <p className="sub">
          Получай уведомления об уроках, клубах, заявках и поддержке прямо в
          Telegram. Код действителен 10 минут.
        </p>
        <div className="tg-code">{code}</div>
        <div className="tg-row">
          {deepLink ? (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="tg-btn tg-btn-primary"
            >
              Открыть бот
            </a>
          ) : null}
          <button
            type="button"
            className="tg-btn tg-btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(code).catch(() => {})
              toast.success("Код скопирован")
            }}
          >
            Скопировать код
          </button>
        </div>
        <div className="tg-steps">
          <b>Как привязать:</b>
          <br />
          1. Открой бот по кнопке выше
          <br />
          2. Нажми «Start» (если первый раз) или отправь <code>{code}</code>
          <br />
          3. Окно закроется автоматически — придёт приветствие
        </div>
        <div className="tg-status">
          <span className="pulse" />
          Ждём подтверждения от бота…
        </div>
      </div>
    </div>
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
  isTeacher,
}: {
  value: Settings["notifications"]
  onPatch: (u: Partial<Settings["notifications"]>) => void
  isTeacher?: boolean
}) {
  // Показываем только те toggle'ы, которые реально работают на бэке.
  // Скрытые типы уведомлений не имеют активного cron'а или emitter'а:
  //   - daily_challenge / streak_warning / weekly_digest — endpoint'ы
  //     есть, но cron-job не запланирован в БД
  //   - new_clubs / achievements / leaderboard / marketing — emitter
  //     отсутствует вообще
  // Бэк-значения в profiles.notification_prefs сохраняются (PATCH
  // ничего не теряет), мы просто прячем UI до момента когда фичу
  // реально доделают.
  const rows: Array<[keyof Settings["notifications"], string, string]> = [
    ["lesson_reminders", "Напоминание об уроке", "За 30 мин до начала урока или клуба"],
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
            {/* Только реально работающие каналы. Push (Web Push API +
                Service Worker) и SMS (через Twilio/etc) пока не
                реализованы — скрываем чтобы не обманывать пользователя. */}
            <option value="telegram">Telegram бот</option>
            <option value="email">Email</option>
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
            <div className="s-field-desc">Звуковой эффект при получении XP и достижений</div>
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
  isTeacher,
}: {
  value: Settings["visibility"]
  onChangePassword: () => void
  onManageSessions: () => void
  onPatch: (u: Partial<Settings["visibility"]>) => void
  isTeacher?: boolean
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
          <a className="s-btn s-btn--outline" href="/forgot-password">Изменить</a>
        </div>
        {/* Активные сессии — скрыто до интеграции с Supabase Admin API */}
        {/* <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Активные сессии</div>
            <div className="s-field-desc">Управление устройствами и выход с чужого устройства</div>
          </div>
          <button className="s-btn s-btn--outline" onClick={onManageSessions}>Управление</button>
        </div> */}
        {isTeacher ? null : (
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
        )}
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
            <div className="s-field-desc">Скачать все свои данные: историю уроков, XP, достижения</div>
          </div>
          <button className="s-btn s-btn--outline" onClick={onExport}>Экспортировать</button>
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">Сбросить прогресс</div>
            <div className="s-field-desc">Обнулить XP, стрики и достижения. Уроки сохранятся.</div>
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
