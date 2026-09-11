"use client"

import { useEffect, useState } from "react"
import { PhoneInput } from "@/components/ui/phone-input"

// «Добавить учителя» — по макету регистрации Figma 2522:3001 (лаймовая модалка 686,
// пилюля-заголовок 578×68 на 61, белые поля 578×68 с шагом 93 от 202, красная кнопка 386×68).
// Админ вводит имя, фамилию и телефон, получает одноразовые логин и пароль;
// преподаватель при первом входе задаёт свою почту и пароль.

type Created = { login: string; password: string }

export default function AdminAddTeacherModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
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

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/teachers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: `${firstName.trim()} ${lastName.trim()}`, phone: phone || null }),
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
    <div className="tr">
      <div className="tr-modal-backdrop tr-modal-backdrop--top" onClick={onClose}>
        <div className="tr-modal tr-modal--add-teacher" role="dialog" aria-modal="true" aria-labelledby="ad-addt-title" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="tr-modal-close tr-modal-close--dark" aria-label="Закрыть" onClick={onClose}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
          </button>
          {!created ? (
            <>
              <h2 id="ad-addt-title" className="tr-at-title">Новый учитель</h2>
              <input className="tr-at-input" placeholder="имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus autoComplete="off" />
              <input className="tr-at-input" placeholder="фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
              <PhoneInput className="tr-at-phone" inputClassName="tr-at-input tr-at-input--phone" placeholder="номер телефона" value={phone} onChange={(e164) => setPhone(e164)} />
              {error && <p className="tr-at-error" role="alert">{error}</p>}
              <button type="button" className="tr-at-submit" disabled={!canSubmit} onClick={submit}>
                {busy ? "Создаём…" : "Создать"}
              </button>
              <p className="tr-at-hint">Логин и пароль появятся после создания. Их нужно передать учителю: при первом входе он задаст свою почту и пароль.</p>
            </>
          ) : (
            <>
              <h2 id="ad-addt-title" className="tr-at-title">Учитель создан</h2>
              <button type="button" className="tr-at-input tr-at-cred" onClick={() => copy("login")} title="Скопировать логин">
                <span className="tr-at-cred-label">логин</span>{created.login}<span className="tr-at-cred-copied">{copied === "login" ? "скопировано" : ""}</span>
              </button>
              <button type="button" className="tr-at-input tr-at-cred" onClick={() => copy("password")} title="Скопировать пароль">
                <span className="tr-at-cred-label">пароль</span>{created.password}<span className="tr-at-cred-copied">{copied === "password" ? "скопировано" : ""}</span>
              </button>
              <button type="button" className="tr-at-submit" onClick={() => copy("all")}>{copied === "all" ? "Скопировано" : "Скопировать оба"}</button>
              <p className="tr-at-hint">Показываются один раз. Передайте учителю: он войдёт с ними и задаст свою почту и пароль.</p>
              <button type="button" className="tr-at-done" onClick={onClose}>Готово</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
