"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function TeacherSetupForm({ name }: { name: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (password.length < 10) { setErr("Пароль не короче 10 символов"); return }
    if (password !== password2) { setErr("Пароли не совпадают"); return }
    setBusy(true)
    try {
      const res = await fetch("/api/teacher/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(data.error || "Не удалось сохранить"); setBusy(false); return }
      // Перелогиниваемся под новыми данными, чтобы сессия не осталась на временном логине.
      const supabase = createClient()
      await supabase.auth.signInWithPassword({ email: email.trim(), password })
      router.push("/teacher")
      router.refresh()
    } catch {
      setErr("Не удалось сохранить. Попробуйте ещё раз.")
      setBusy(false)
    }
  }

  return (
    <div className="raw2 raw2-auth-page">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/landing/raw2/raw2.css" />
      <div className="raw2-auth-bg" />
      <div className="raw2-login raw2-login--page" role="dialog" aria-modal="false">
        <div className="raw2-login-title">Добро пожаловать{name ? `, ${name.split(" ")[0]}` : ""}!</div>
        <p className="raw2-login-sub">Задайте свою почту и пароль. Дальше вход будет по ним, временный логин перестанет работать.</p>
        <form className="raw2-login-form" onSubmit={onSubmit}>
          <input name="email" type="email" placeholder="ваша электронная почта" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input name="password" type="password" placeholder="новый пароль" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input name="password2" type="password" placeholder="повтор пароля" required autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          {err && <p className="raw2-login-err">{err}</p>}
          <button type="submit" className="btn btn-red" disabled={busy || !email || !password || !password2} aria-busy={busy}>{busy ? "Сохраняем…" : "Сохранить и войти"}</button>
        </form>
      </div>
      <style jsx global>{`
        .raw2-auth-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 40px 20px; position: relative; background: #1E1E1E; }
        .raw2-auth-bg { position: fixed; inset: 0; z-index: 0; background-image: url(/landing/raw2/hero.webp); background-size: cover; background-position: center; filter: blur(14px) brightness(.5); transform: scale(1.1); }
        .raw2 .raw2-login--page { position: relative; z-index: 1; }
      `}</style>
    </div>
  )
}
