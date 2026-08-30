// @ts-nocheck
"use client"

import "@/styles/dashboard/student-settings.css"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { MfaTotpSection } from "@/components/auth/mfa-totp-section"

// ---------------------------------------------------------------------------
// Settings page — ported from settings-page.html prototype, fully DB-driven
// via /api/settings/me (GET/PATCH) + Supabase Storage for avatar upload.
// All user-facing strings come from messages/{ru,en}.json under
// `dashboard.student.settings.*` via next-intl.
// ---------------------------------------------------------------------------

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

const TZ_I18N_KEY: Record<string, string> = {
  "Europe/Kaliningrad": "kaliningrad",
  "Europe/Moscow": "moscow",
  "Europe/Samara": "samara",
  "Asia/Yekaterinburg": "yekaterinburg",
  "Asia/Omsk": "omsk",
  "Asia/Krasnoyarsk": "krasnoyarsk",
  "Asia/Irkutsk": "irkutsk",
  "Asia/Yakutsk": "yakutsk",
  "Asia/Vladivostok": "vladivostok",
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

function formatLocalizedDate(iso: string | null, locale: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

export default function StudentSettingsPage() {
  const t = useTranslations("dashboard.student.settings")
  const locale = useLocale()
  // Middleware sets ?mfa=required after a soft-redirect for admins without
  // a verified TOTP factor.
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const isTeacher = (pathname ?? "").startsWith("/teacher")
  const mfaRequired = searchParams?.get("mfa") === "required"
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeSection, setActiveSection] = useState<string>("account")
  const [data, setData] = useState<Settings | null>(null)
  const [original, setOriginal] = useState<Settings | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // NAV is built inside the component so labels respond to locale changes.
  const NAV = [
    { id: "account", label: t("nav.account"), icon: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
    { id: "notifications", label: t("nav.notifications"), icon: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></> },
    { id: "privacy", label: t("nav.privacy"), icon: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
    { id: "mfa", label: t("nav.mfa"), icon: <><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
    { id: "connected", label: t("nav.connected"), icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></> },
    { id: "subscription", label: t("nav.subscription"), icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/> },
  ]

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
      toast.error(t("toasts.loadFail"))
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

  useEffect(() => {
    if (!mfaRequired || loading) return
    const el = document.getElementById("sec-mfa")
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [mfaRequired, loading])

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
          toast.success(t("toasts.tgConnected"))
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
        toast.error(json?.error ?? t("toasts.saveFail"))
        return
      }
      toast.success(t("toasts.savedOk"))
      setOriginal(JSON.parse(JSON.stringify(data)))
      if (body.ui?.theme) applyTheme(body.ui.theme)
      if (body.account?.language && body.account.language !== original.account.language) {
        router.refresh()
      }
    } catch {
      toast.error(t("toasts.networkError"))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (!original) return
    setData(JSON.parse(JSON.stringify(original)))
    if (original.ui.theme) applyTheme(original.ui.theme)
    toast.info(t("toasts.cancelled"))
  }

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !data) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("toasts.fileTooBig"))
      return
    }
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
      const storagePath = `${data.account.id}/avatar.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(storagePath, file, { cacheControl: "3600", upsert: true })
      if (uploadErr) {
        console.error("[avatar upload] storage error:", uploadErr)
        toast.error(
          t("toasts.uploadError", {
            message: uploadErr.message || t("toasts.uploadErrorUnknown"),
          }),
        )
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(storagePath)
      const url = `${publicUrl}?t=${Date.now()}`

      const apiRes = await fetch("/api/settings/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: { avatar_url: url } }),
      })
      if (!apiRes.ok) {
        const j = await apiRes.json().catch(() => ({}))
        toast.error(
          j?.error
            ? t("toasts.saveAvatarFailWith", { error: j.error })
            : t("toasts.saveAvatarFail"),
        )
        return
      }

      setData((prev) => (prev ? { ...prev, account: { ...prev.account, avatar_url: url } } : prev))
      setOriginal((prev) => (prev ? { ...prev, account: { ...prev.account, avatar_url: url } } : prev))
      toast.success(t("toasts.avatarUpdated"))
      router.refresh()
    } catch {
      toast.error(t("toasts.avatarUploadFail"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const stub = (titleKey: string) => () =>
    toast.info(t("toasts.comingSoon", { title: t(`toasts.${titleKey}`) }))

  const supabase = createClient()

  const handleConnect = async (provider: "google" | "telegram") => {
    if (provider === "telegram") {
      try {
        const res = await fetch("/api/telegram/link/start", { method: "POST" })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json?.error || t("toasts.tgGenFail"))
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
        toast.error(t("toasts.networkError"))
      }
      return
    }
    const link = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/student/settings` },
    })
    if (!link.error) return

    const msg = link.error.message || ""
    if (/manual.?linking/i.test(msg) || /404/.test(msg)) {
      toast.info(t("toasts.tgRedirectGoogle"))
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/student/settings`,
          queryParams: { prompt: "select_account" },
        },
      })
      if (oauthErr) toast.error(oauthErr.message || t("toasts.googleOpenFail"))
      return
    }
    if (/provider.*not (enabled|configured)/i.test(msg)) {
      toast.error(t("toasts.googleProviderOff"))
      return
    }
    toast.error(msg || t("toasts.providerLinkFail"))
  }

  const handleDisconnect = async (provider: "google" | "telegram") => {
    if (provider === "telegram") {
      try {
        const res = await fetch("/api/telegram/link/disconnect", { method: "POST" })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error(j?.error || t("toasts.tgDisconnectFail"))
          return
        }
        toast.success(t("toasts.tgDisconnected"))
        setData((prev) =>
          prev
            ? { ...prev, connected: { ...prev.connected, telegram: false } }
            : prev,
        )
        load()
      } catch {
        toast.error(t("toasts.networkError"))
      }
      return
    }
    const { data: identitiesData, error: iErr } = await supabase.auth.getUserIdentities()
    if (iErr || !identitiesData) {
      toast.error(t("toasts.identitiesFail"))
      return
    }
    const target = identitiesData.identities.find((i: any) => i.provider === provider)
    if (!target) {
      toast.error(t("toasts.providerAlreadyOff"))
      return
    }
    if (identitiesData.identities.length <= 1) {
      toast.error(t("toasts.lastAuthMethod"))
      return
    }
    const { error } = await supabase.auth.unlinkIdentity(target)
    if (error) {
      toast.error(error.message || t("toasts.providerUnlinkFail"))
      return
    }
    toast.success(t("toasts.googleDisconnected"))
    load()
  }

  return (
    <>
      <div className="settings-page">
        <div className="hdr">
          <h1>
            {t("pageTitleA")} <span className="gl">{t("pageTitleB")}</span>
          </h1>
        </div>

        {loading || !data ? (
          <div className="loading-wrap">{t("loadingSettings")}</div>
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

              <SecuritySection
                value={data.visibility}
                onChangePassword={stub("stubChangePassword")}
                onManageSessions={stub("stubManageSessions")}
                onPatch={(u) => patch("visibility", u)}
                isTeacher={isTeacher}
              />

              <MfaTotpSection required={mfaRequired} />

              <ConnectedSection
                connected={data.connected}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />

              <SubscriptionSection
                value={data.subscription}
                onChangePayment={stub("stubChangePayment")}
                onCancel={stub("stubCancelSubscription")}
                locale={locale}
              />

              <div className="save-bar">
                <div className="save-bar-text">
                  {dirty ? t("saveBar.hasChanges") : t("saveBar.allSaved")}
                </div>
                <div className="save-bar-actions">
                  <button
                    className="s-btn s-btn--outline"
                    onClick={handleCancel}
                    disabled={!dirty || saving}
                  >
                    {t("saveBar.cancel")}
                  </button>
                  <button
                    className="s-btn s-btn--save"
                    onClick={handleSave}
                    disabled={!dirty || saving}
                  >
                    {saving ? t("saveBar.saving") : t("saveBar.save")}
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
  const t = useTranslations("dashboard.student.settings.telegramModal")
  const tToasts = useTranslations("dashboard.student.settings.toasts")
  return (
    <div className="tg-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tg-card">
        <button type="button" className="x" onClick={onClose}>
          ×
        </button>
        <h2>{t("title")}</h2>
        <p className="sub">{t("desc")}</p>
        <div className="tg-code">{code}</div>
        <div className="tg-row">
          {deepLink ? (
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="tg-btn tg-btn-primary"
            >
              {t("openBot")}
            </a>
          ) : null}
          <button
            type="button"
            className="tg-btn tg-btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(code).catch(() => {})
              toast.success(t("copied"))
            }}
          >
            {t("copyCode")}
          </button>
        </div>
        <div className="tg-steps">
          <b>{t("howToTitle")}</b>
          <br />
          {t("step1")}
          <br />
          {t("step2Prefix")} <code>{code}</code>
          <br />
          {t("step3")}
        </div>
        <div className="tg-status">
          <span className="pulse" />
          {t("waiting")}
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
  const t = useTranslations("dashboard.student.settings.account")
  const tTz = useTranslations("dashboard.student.settings.tz")
  const a = data.account
  return (
    <div className="s-card" id="sec-account">
      <div className="s-card-head">
        <h3>{t("title")}</h3>
        <p>{t("subtitle")}</p>
      </div>
      <div className="s-card-body">
        <div className="ava-upload">
          <div className={`ava-preview${uploading ? " ava-preview--busy" : ""}`}>
            {a.avatar_url ? (
              <img src={a.avatar_url} alt={a.full_name ?? t("avatarAlt")} />
            ) : (
              initials(a.first_name, a.last_name)
            )}
          </div>
          <div className="ava-actions">
            <button className="s-btn s-btn--outline" onClick={onUpload} disabled={uploading}>
              {uploading ? t("uploading") : t("uploadPhoto")}
            </button>
            <div className="ava-hint">{t("avatarHint")}</div>
          </div>
        </div>

        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">{t("firstName")}</div></div>
          <input
            className="s-input"
            type="text"
            value={a.first_name ?? ""}
            onChange={(e) => onPatch({ first_name: e.target.value })}
            placeholder={t("firstName")}
          />
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">{t("lastName")}</div></div>
          <input
            className="s-input"
            type="text"
            value={a.last_name ?? ""}
            onChange={(e) => onPatch({ last_name: e.target.value || null })}
            placeholder={t("lastName")}
          />
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">{t("email")}</div>
            <div className="s-field-desc">{t("emailDesc")}</div>
          </div>
          <input className="s-input" type="email" value={a.email ?? ""} disabled />
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">{t("phone")}</div></div>
          <input
            className="s-input"
            type="tel"
            value={a.phone ?? ""}
            onChange={(e) => onPatch({ phone: e.target.value || null })}
            placeholder={t("phonePlaceholder")}
          />
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">{t("city")}</div></div>
          <input
            className="s-input"
            type="text"
            value={a.city ?? ""}
            onChange={(e) => onPatch({ city: e.target.value || null })}
            placeholder={t("cityPlaceholder")}
          />
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">{t("timezone")}</div></div>
          <select
            className="s-select"
            value={a.timezone}
            onChange={(e) => onPatch({ timezone: e.target.value })}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tTz(TZ_I18N_KEY[tz] ?? "moscow")}</option>
            ))}
          </select>
        </div>
        <div className="s-field">
          <div className="s-field-left"><div className="s-field-label">{t("language")}</div></div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className={`lang-option${a.language === "ru" ? " active" : ""}`}
              onClick={() => onPatch({ language: "ru" })}
            >
              {t("languageRu")}
            </button>
            <button
              type="button"
              className={`lang-option${a.language === "en" ? " active" : ""}`}
              onClick={() => onPatch({ language: "en" })}
            >
              {t("languageEn")}
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
  const t = useTranslations("dashboard.student.settings.notifications")
  // Only toggles whose backend cron/emitter actually runs.
  const rows: Array<[keyof Settings["notifications"], string, string]> = [
    ["lesson_reminders", t("lessonReminders"), t("lessonRemindersDesc")],
  ]
  return (
    <div className="s-card" id="sec-notifications">
      <div className="s-card-head">
        <h3>{t("title")}</h3>
        <p>{t("subtitle")}</p>
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
            <div className="s-field-label">{t("channel")}</div>
            <div className="s-field-desc">{t("channelDesc")}</div>
          </div>
          <select
            className="s-select"
            value={value.channel}
            onChange={(e) => onPatch({ channel: e.target.value as any })}
          >
            <option value="telegram">{t("channelTelegram")}</option>
            <option value="email">{t("channelEmail")}</option>
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
  const t = useTranslations("dashboard.student.settings.appearance")
  const themes: Array<["light" | "dark" | "auto", string, string]> = [
    ["light", t("themeLight"), "theme-preview--light"],
    ["dark", t("themeDark"), "theme-preview--dark"],
    ["auto", t("themeAuto"), "theme-preview--auto"],
  ]
  return (
    <div className="s-card" id="sec-appearance">
      <div className="s-card-head">
        <h3>{t("title")}</h3>
        <p>{t("subtitle")}</p>
      </div>
      <div className="s-card-body">
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">{t("theme")}</div>
            <div className="s-field-desc">{t("themeDesc")}</div>
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
            <div className="s-field-label">{t("showXp")}</div>
            <div className="s-field-desc">{t("showXpDesc")}</div>
          </div>
          <Toggle on={value.show_xp_bar} onChange={(n) => onPatch({ show_xp_bar: n })} />
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">{t("sounds")}</div>
            <div className="s-field-desc">{t("soundsDesc")}</div>
          </div>
          <Toggle on={value.sounds} onChange={(n) => onPatch({ sounds: n })} />
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">{t("confetti")}</div>
            <div className="s-field-desc">{t("confettiDesc")}</div>
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
  const t = useTranslations("dashboard.student.settings.security")
  return (
    <div className="s-card" id="sec-privacy">
      <div className="s-card-head">
        <h3>{t("title")}</h3>
        <p>{t("subtitle")}</p>
      </div>
      <div className="s-card-body">
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">{t("changePassword")}</div>
            <div className="s-field-desc">{t("changePasswordDesc")}</div>
          </div>
          <a className="s-btn s-btn--outline" href="/forgot-password">{t("change")}</a>
        </div>
        {isTeacher ? null : (
          <div className="s-field">
            <div className="s-field-left">
              <div className="s-field-label">{t("leaderboardPublic")}</div>
              <div className="s-field-desc">{t("leaderboardPublicDesc")}</div>
            </div>
            <Toggle
              on={value.leaderboard_public}
              onChange={(n) => onPatch({ leaderboard_public: n })}
            />
          </div>
        )}
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
  const t = useTranslations("dashboard.student.settings.connected")
  const toggle = (provider: "google" | "telegram", isConnected: boolean) =>
    isConnected ? onDisconnect(provider) : onConnect(provider)
  return (
    <div className="s-card" id="sec-connected">
      <div className="s-card-head">
        <h3>{t("title")}</h3>
        <p>{t("subtitle")}</p>
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
              {connected.google ? t("connected") : t("notConnected")}
            </div>
          </div>
          <button className="s-btn s-btn--outline" onClick={() => toggle("google", connected.google)}>
            {connected.google ? t("disconnect") : t("connect")}
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
              {connected.telegram ? t("connected") : t("notConnected")}
            </div>
          </div>
          <button className="s-btn s-btn--outline" onClick={() => toggle("telegram", connected.telegram)}>
            {connected.telegram ? t("disconnect") : t("connect")}
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
  locale,
}: {
  value: Settings["subscription"]
  onChangePayment: () => void
  onCancel: () => void
  locale: string
}) {
  const t = useTranslations("dashboard.student.settings.subscription")
  const isPro = value.tier === "pro"
  return (
    <div className="s-card" id="sec-subscription">
      <div className="s-card-head">
        <h3>{t("title")}</h3>
        <p>{t("subtitle")}</p>
      </div>
      <div className="s-card-body">
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">{t("currentPlan")}</div>
            <div
              className="s-field-desc"
              style={{ color: isPro ? "var(--red)" : "var(--muted)", fontWeight: 700 }}
            >
              {isPro ? t("planPro") : t("planFree")}
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
            {isPro ? t("active") : t("inactive")}
          </span>
        </div>
        {isPro ? (
          <>
            <div className="s-field">
              <div className="s-field-left">
                <div className="s-field-label">{t("nextBilling")}</div>
                <div className="s-field-desc">
                  {t("nextBillingValue", { date: formatLocalizedDate(value.until, locale) })}
                </div>
              </div>
            </div>
            <div className="s-field">
              <div className="s-field-left">
                <div className="s-field-label">{t("paymentMethod")}</div>
                <div className="s-field-desc">{t("paymentMethodDesc")}</div>
              </div>
              <button className="s-btn s-btn--outline" onClick={onChangePayment}>{t("changePaymentBtn")}</button>
            </div>
            <div className="s-field">
              <div className="s-field-left">
                <div className="s-field-label">{t("cancelSubscription")}</div>
                <div className="s-field-desc">{t("cancelSubscriptionDesc")}</div>
              </div>
              <button className="s-btn s-btn--danger" onClick={onCancel}>{t("cancel")}</button>
            </div>
          </>
        ) : (
          <div className="s-field">
            <div className="s-field-left">
              <div className="s-field-label">{t("upgrade")}</div>
              <div className="s-field-desc">{t("upgradeDesc")}</div>
            </div>
            <button className="s-btn s-btn--red" onClick={onChangePayment}>{t("upgradeBtn")}</button>
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
  const t = useTranslations("dashboard.student.settings.danger")
  return (
    <div className="s-card danger-zone" id="sec-danger">
      <div className="s-card-head">
        <h3>{t("title")}</h3>
        <p>{t("subtitle")}</p>
      </div>
      <div className="s-card-body">
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">{t("exportData")}</div>
            <div className="s-field-desc">{t("exportDataDesc")}</div>
          </div>
          <button className="s-btn s-btn--outline" onClick={onExport}>{t("exportBtn")}</button>
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">{t("resetProgress")}</div>
            <div className="s-field-desc">{t("resetProgressDesc")}</div>
          </div>
          <button className="s-btn s-btn--danger" onClick={onReset}>{t("resetBtn")}</button>
        </div>
        <div className="s-field">
          <div className="s-field-left">
            <div className="s-field-label">{t("deleteAccount")}</div>
            <div className="s-field-desc">{t("deleteAccountDesc")}</div>
          </div>
          <button className="s-btn s-btn--danger" onClick={onDelete}>{t("deleteBtn")}</button>
        </div>
      </div>
    </div>
  )
}
