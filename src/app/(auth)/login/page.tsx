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
  // как в попапе на лендинге: «Войти» активна только когда форма валидна
  const [valid, setValid] = useState(false)

  const callbackError = searchParams.get('error')
  useEffect(() => {
    if (mfaRequired) setErr('MFA-проверка не прошла, попробуй войти снова.')
    else if (callbackError === 'auth_failed' || callbackError === 'missing_code') setErr('Ссылка недействительна или устарела. Войди с паролем или запроси новую ссылку.')
  }, [mfaRequired, callbackError])

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
        const m = error.message || ''
        if (/not confirmed/i.test(m)) setErr('Почта не подтверждена. Открой письмо, которое мы отправили при регистрации.')
        else if (/banned/i.test(m)) setErr('Аккаунт отключён. Напиши администратору.')
        else if (/rate limit|too many/i.test(m)) setErr('Слишком много попыток. Подожди минуту и попробуй снова.')
        else setErr('Неверный email или пароль')
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

      // Только внутренние пути: «//evil.com» тоже начинается с «/».
      if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) router.push(redirectTo)
      else if (profile?.role === 'admin') router.push('/admin')
      else if (profile?.role === 'teacher') router.push('/teacher')
      else router.push('/student')
      router.refresh()
    } catch {
      setErr('Не удалось войти. Попробуй позже.')
      setBusy(false)
    }
  }

  // Google-логин временно отключён — используем только email/пароль.
  // Логика оставлена как заглушка на случай возврата фичи.

  return (
    <div className="raw2 raw2-auth-page">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/landing/raw2/raw2.css" />
      <div className="raw2-auth-bg" />

      {/* Та же разметка и стили, что у попапа «Войти» на лендинге (Figma 2522:2340) */}
      <div className="raw2-login raw2-login--page" role="dialog" aria-modal="false">
        <div className="raw2-login-tabs">
          <button type="button" className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}>Ученик</button>
          <button type="button" className={role === 'teacher' ? 'active' : ''} onClick={() => setRole('teacher')}>Учитель</button>
        </div>

        <form
          className="raw2-login-form"
          onSubmit={onSubmit}
          onChange={(e) => setValid(e.currentTarget.checkValidity())}
          onInput={(e) => setValid(e.currentTarget.checkValidity())}
        >
          <input
            name="email"
            type="email"
            placeholder="электронная почта"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            name="password"
            type="password"
            placeholder="пароль"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TurnstileWidget onToken={setCaptchaToken} />
          {err && <p className="raw2-login-err">{err}</p>}
          {/* busy: чёрная с лаймовым текстом, подпись не меняется */}
          <button type="submit" className={`btn btn-red${busy ? ' busy' : ''}`} disabled={busy || !valid} aria-busy={busy}>Войти</button>
          <Link href="/register" className="raw2-login-reg">Регистрация</Link>
          <Link href="/forgot-password" className="raw2-login-forgot">Забыл пароль?</Link>
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
        .raw2-auth-bg { position: fixed; inset: 0; z-index: 0; background-image: url(/landing/raw2/hero.webp); background-size: cover; background-position: center; filter: blur(14px) brightness(.5); transform: scale(1.1); }
        .raw2 .raw2-login--page { position: relative; z-index: 1; }
        /* «Забыл пароль?» — такая же типографика, как у «Регистрация», но тише; в попапе лендинга ссылки нет */
        .raw2 .raw2-login-forgot { align-self: center; margin-top: 6px; font-size: 20px; font-weight: 500; line-height: 0.975; letter-spacing: -1px; color: var(--ink); opacity: .6; text-decoration: none; }
        .raw2 .raw2-login-forgot:hover { opacity: 1; color: var(--red); }
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
