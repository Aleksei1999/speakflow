'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/client'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const initialRole = searchParams.get('as') === 'teacher' ? 'teacher' : 'student'
  const mfaRequired = searchParams.get('error') === 'mfa_check_failed'

  const [role, setRole] = useState<'student' | 'teacher'>(initialRole)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (mfaRequired) setErr('MFA-проверка не прошла, попробуй войти снова.')
  }, [mfaRequired])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: captchaToken ? { captchaToken } : undefined,
      })
      if (error) {
        setErr('Неверный email или пароль')
        setBusy(false)
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setErr('Не удалось войти'); setBusy(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, language')
        .eq('id', user.id)
        .single<{ role: 'student' | 'teacher' | 'admin' | null; language: 'ru' | 'en' | null }>()

      if (profile?.language === 'ru' || profile?.language === 'en') {
        try {
          document.cookie = `rwen_locale=${profile.language}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
        } catch {}
      }

      if (redirectTo && redirectTo.startsWith('/')) router.push(redirectTo)
      else if (profile?.role === 'admin') router.push('/admin')
      else if (profile?.role === 'teacher') router.push('/teacher')
      else router.push('/student')
      router.refresh()
    } catch {
      setErr('Не удалось войти. Попробуй позже.')
      setBusy(false)
    }
  }

  async function onGoogle() {
    setErr('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      })
      if (error) setErr('Не удалось войти через Google')
    } catch { setErr('Не удалось войти через Google') }
  }

  return (
    <div className="raw2 raw2-auth-page">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/landing/raw2/raw2.css" />
      <div className="raw2-auth-bg" />

      <div className="raw2-login raw2-login--page" role="dialog" aria-modal="false">
        <Link href="/" className="raw2-login-close" aria-label="На главную">×</Link>

        <div className="raw2-login-tabs">
          <button type="button" className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}>Ученик</button>
          <button type="button" className={role === 'teacher' ? 'active' : ''} onClick={() => setRole('teacher')}>Учитель</button>
        </div>

        <form className="raw2-login-form" onSubmit={onSubmit}>
          <input
            name="email"
            type="email"
            placeholder="электронная почта"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="raw2-login-pass">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="пароль"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="raw2-login-pass-eye"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 6.2A10.4 10.4 0 0 1 12 6c6 0 10 6 10 6a17.3 17.3 0 0 1-3.2 3.7" />
                  <path d="M6.6 6.6C3.8 8.3 2 12 2 12s4 6 10 6c1.5 0 2.9-.3 4.1-.9" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <TurnstileWidget onToken={setCaptchaToken} />
          {err && <p className="raw2-login-err">{err}</p>}
          <button type="submit" className="btn btn-red" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
          <button type="button" className="btn btn-red raw2-login-oauth" onClick={onGoogle}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path fill="#fff" d="M22 12.2c0-.7-.06-1.5-.19-2.2H12v4.17h5.62c-.24 1.28-.98 2.36-2.09 3.09v2.57h3.38c1.98-1.82 3.09-4.51 3.09-7.63ZM12 22c2.83 0 5.2-.94 6.94-2.54l-3.38-2.62c-.94.63-2.13.99-3.55.99-2.73 0-5.05-1.85-5.88-4.33H2.65v2.7C4.39 19.71 7.94 22 12 22ZM6.11 13.5c-.21-.63-.33-1.31-.33-2s.12-1.37.33-2v-2.7H2.65C1.87 8.4 1.44 10.15 1.44 12s.43 3.6 1.21 5.2l3.46-2.7ZM12 6.13c1.54 0 2.92.53 4.01 1.57l3-3C17.19 3.02 14.83 2 12 2 7.94 2 4.39 4.29 2.65 6.8l3.46 2.7c.83-2.48 3.15-4.33 5.89-4.33Z"/></svg>
            Войти через Google
          </button>
          <Link href="/forgot-password" className="raw2-login-forgot">Забыл пароль?</Link>
          <Link href="/register" className="raw2-login-reg">Регистрация</Link>
        </form>
      </div>

      <style jsx global>{`
        /* Нейтрализуем родительскую auth-обёртку из layout.tsx — раскрываем полный экран под raw2. */
        html:has(.raw2-auth-page) .auth-scope { padding: 0 !important; background: transparent !important; display: block !important; min-height: 0 !important; }
        html:has(.raw2-auth-page) .auth-modal { max-width: none !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
        html:has(.raw2-auth-page) .auth-modal::before { display: none !important; }
        html:has(.raw2-auth-page) .auth-header { display: none !important; }
        html:has(.raw2-auth-page) .auth-body { padding: 0 !important; }

        .raw2-auth-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 40px 20px; position: relative; background: #1E1E1E; }
        .raw2-auth-bg { position: fixed; inset: 0; z-index: 0; background-image: url(/landing/raw2/hero.jpg); background-size: cover; background-position: center; filter: blur(14px) brightness(.5); transform: scale(1.1); }
        .raw2 .raw2-login--page { position: relative; z-index: 1; }
        .raw2 .raw2-login-oauth { display: inline-flex; align-items: center; justify-content: center; gap: 12px; }
        .raw2 .raw2-login-forgot { align-self: center; margin-top: 8px; font-size: 14px; color: var(--ink); opacity: .7; text-decoration: none; }
        .raw2 .raw2-login-forgot:hover { opacity: 1; text-decoration: underline; }
        .raw2 .raw2-login-pass { position: relative; display: flex; }
        .raw2 .raw2-login-pass input { flex: 1 1 auto; padding-right: 56px; }
        .raw2 .raw2-login-pass-eye {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 999px;
          background: transparent; border: none; padding: 0; cursor: pointer;
          color: rgba(30,30,30,.55); transition: color .15s, background .15s;
        }
        .raw2 .raw2-login-pass-eye:hover { color: var(--ink); background: rgba(30,30,30,.06); }
        .raw2 .raw2-login-pass-eye:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#1E1E1E' }} />}>
      <LoginPageContent />
    </Suspense>
  )
}
