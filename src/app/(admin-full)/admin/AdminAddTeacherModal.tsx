"use client"

import { useEffect, useState } from "react"

// «Добавить преподавателя»: админ вводит имя и телефон, получает одноразовые
// логин и пароль. Преподаватель при первом входе задаёт свою почту и пароль.

type Created = { login: string; password: string }

export default function AdminAddTeacherModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [copied, setCopied] = useState<"login" | "password" | "all" | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function submit() {
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/teachers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name.trim(), phone: phone.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || "Не удалось создать преподавателя"); return }
      setCreated({ login: data.login, password: data.password })
      onCreated()
    } catch {
      setError("Не удалось создать преподавателя. Попробуйте ещё раз.")
    } finally {
      setBusy(false)
    }
  }

  async function copy(kind: "login" | "password" | "all") {
    if (!created) return
    const text = kind === "login" ? created.login : kind === "password" ? created.password : `Логин: ${created.login}\nПароль: ${created.password}`
    try { await navigator.clipboard.writeText(text); setCopied(kind); setTimeout(() => setCopied(null), 1500) } catch { /* буфер недоступен */ }
  }

  return (
    <div className="ad-cal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ad-addt" role="dialog" aria-modal="true" aria-label="Добавить преподавателя">
        <button type="button" className="ad-cal-close" aria-label="Закрыть" onClick={onClose}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dashboard/ic-close-lime.svg" alt="" aria-hidden />
        </button>
        {!created ? (
          <>
            <div className="ad-addt-title">Новый преподаватель</div>
            <p className="ad-addt-sub">Логин и пароль появятся после создания. Их нужно передать преподавателю: при первом входе он задаст свою почту и пароль.</p>
            <input className="ad-addt-input" placeholder="имя и фамилия" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <input className="ad-addt-input" placeholder="телефон (необязательно)" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            {error && <p className="ad-addt-error" role="alert">{error}</p>}
            <button type="button" className="ad-addt-submit" disabled={!name.trim() || busy} onClick={submit}>
              {busy ? "Создаём…" : "Создать"}
            </button>
          </>
        ) : (
          <>
            <div className="ad-addt-title">Преподаватель создан</div>
            <p className="ad-addt-sub">Передайте эти данные для первого входа. Показываются один раз.</p>
            <div className="ad-addt-cred">
              <span className="ad-addt-cred-label">логин</span>
              <code className="ad-addt-cred-value">{created.login}</code>
              <button type="button" className="ad-addt-copy" onClick={() => copy("login")}>{copied === "login" ? "Скопировано" : "Копировать"}</button>
            </div>
            <div className="ad-addt-cred">
              <span className="ad-addt-cred-label">пароль</span>
              <code className="ad-addt-cred-value">{created.password}</code>
              <button type="button" className="ad-addt-copy" onClick={() => copy("password")}>{copied === "password" ? "Скопировано" : "Копировать"}</button>
            </div>
            <button type="button" className="ad-addt-submit" onClick={() => copy("all")}>{copied === "all" ? "Скопировано" : "Скопировать оба"}</button>
            <button type="button" className="ad-addt-done" onClick={onClose}>Готово</button>
          </>
        )}
      </div>
    </div>
  )
}
