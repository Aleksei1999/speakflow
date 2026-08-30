'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/client'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
        captchaToken: captchaToken ?? undefined,
      })
      if (error) {
        setErr('Не удалось отправить письмо. Попробуй позже.')
        setBusy(false)
        return
      }
      setSent(true)
    } catch {
      setErr('Не удалось отправить письмо. Попробуй позже.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="raw2 raw2-auth-page">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/landing/raw2/raw2.css" />
      <div className="raw2-auth-bg" />

      <div className="raw2-login raw2-login--page" role="dialog" aria-modal="false">
        <Link href="/login" className="raw2-login-close" aria-label="Назад">×</Link>

        <div className="raw2-login-title">Восстановление пароля</div>

        {sent ? (
          <div className="raw2-login-form" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, margin: '10px 0 20px' }}>
              Письмо со ссылкой для сброса отправлено на <b>{email}</b>. Проверь почту.
            </p>
            <Link href="/login" className="btn btn-red" style={{ textAlign: 'center' }}>Вернуться ко входу</Link>
          </div>
        ) : (
          <form className="raw2-login-form" onSubmit={onSubmit}>
            <p style={{ fontSize: 16, color: 'var(--ink)', opacity: .8, textAlign: 'center', margin: '0 0 6px' }}>
              Введи email — пришлём ссылку для сброса пароля
            </p>
            <input
              name="email"
              type="email"
              placeholder="электронная почта"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TurnstileWidget onToken={setCaptchaToken} />
            {err && <p className="raw2-login-err">{err}</p>}
            <button type="submit" className="btn btn-red" disabled={busy}>{busy ? 'Отправляем…' : 'Восстановить пароль'}</button>
            <Link href="/login" className="raw2-login-reg">Вспомнил? Войти</Link>
          </form>
        )}
      </div>

      <style jsx global>{`
        html:has(.raw2-auth-page) .auth-scope { padding: 0 !important; background: transparent !important; display: block !important; min-height: 0 !important; }
        html:has(.raw2-auth-page) .auth-modal { max-width: none !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
        html:has(.raw2-auth-page) .auth-modal::before { display: none !important; }
        html:has(.raw2-auth-page) .auth-header { display: none !important; }
        html:has(.raw2-auth-page) .auth-body { padding: 0 !important; }

        .raw2-auth-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 40px 20px; position: relative; background: #1E1E1E; }
        .raw2-auth-bg { position: fixed; inset: 0; z-index: 0; background-image: url(/landing/raw2/hero.jpg); background-size: cover; background-position: center; filter: blur(14px) brightness(.5); transform: scale(1.1); }
        .raw2 .raw2-login--page { position: relative; z-index: 1; }
      `}</style>
    </div>
  )
}
