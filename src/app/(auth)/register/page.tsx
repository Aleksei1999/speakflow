'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'
import { transliterateRu } from '@/lib/transliterate'
import { PASSWORD_MIN } from '@/lib/validations'

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialRole = searchParams.get('as') === 'teacher' ? 'teacher' : 'student'

  const [role, setRole] = useState<'student' | 'teacher'>(initialRole)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [agree, setAgree] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr('')

    if (password.length < PASSWORD_MIN) { setErr(`Пароль должен быть не короче ${PASSWORD_MIN} символов`); return }
    if (password !== password2) { setErr('Пароли не совпадают'); return }
    if (!agree) { setErr('Нужно согласие на обработку данных'); return }

    setBusy(true)
    try {
      const supabase = createClient()
      const first = transliterateRu(firstName.trim())
      const last = transliterateRu(lastName.trim())
      const fullLatin = [first, last].filter(Boolean).join(' ').trim() || email.trim()
      const originalFull = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim()

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          captchaToken: captchaToken ?? undefined,
          data: {
            full_name: fullLatin,
            first_name: first,
            last_name: last,
            full_name_ru: originalFull && originalFull !== fullLatin ? originalFull : null,
            role,
            marketing_opt_in: marketing,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (error) {
        setErr(error.message.includes('already') ? 'Такой email уже зарегистрирован' : 'Не удалось зарегистрироваться')
        setBusy(false)
        return
      }
      router.push(role === 'teacher' ? '/teacher' : '/student')
      router.refresh()
    } catch {
      setErr('Не удалось зарегистрироваться. Попробуй позже.')
      setBusy(false)
    }
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

        <div className="raw2-login-title">Регистрация для входа в ЛК</div>

        <form className="raw2-login-form" onSubmit={onSubmit}>
          <input name="first_name" type="text" placeholder="имя" required autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} />
          <input name="last_name" type="text" placeholder="фамилия" required autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} />
          <input name="email" type="email" placeholder="электронная почта" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input name="password" type="password" placeholder="пароль" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
          <input name="password2" type="password" placeholder="повтор пароля" required autoComplete="new-password" value={password2} onChange={e => setPassword2(e.target.value)} />
          <TurnstileWidget onToken={setCaptchaToken} />
          <button type="submit" className="btn btn-red" disabled={busy}>{busy ? 'Регистрируем…' : 'Зарегистрироваться'}</button>
          {err && <p className="raw2-login-err">{err}</p>}
          <label className="raw2-check"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>Согласен с обработкой персональных данных</span></label>
          <label className="raw2-check"><input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} /><span>Согласен получать рекламные материалы</span></label>
          <Link href="/login" className="raw2-login-reg">Уже есть аккаунт? Войти</Link>
        </form>
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#1E1E1E' }} />}>
      <RegisterPageContent />
    </Suspense>
  )
}
