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
  const [checkEmail, setCheckEmail] = useState('')
  const [contact, setContact] = useState('')
  const [applied, setApplied] = useState(false)

  // Вкладка «Учитель» — заявка админу (одобрение создаёт аккаунт и присылает пароль),
  // а не самостоятельная регистрация с кабинетом.
  async function onApply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr('')
    if (!agree) { setErr('Нужно согласие на обработку данных'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/teach/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(), contact: contact.trim() || email.trim() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error || 'Не удалось отправить заявку'); setBusy(false); return }
      setApplied(true)
    } catch {
      setErr('Не удалось отправить заявку. Попробуй позже.')
    } finally {
      setBusy(false)
    }
  }
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

      const { data: res, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          captchaToken: captchaToken ?? undefined,
          data: {
            full_name: fullLatin,
            first_name: first,
            last_name: last,
            full_name_ru: originalFull && originalFull !== fullLatin ? originalFull : null,
            role: 'student',
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
      // Confirm email включён — сессии нет, показываем «проверьте почту».
      if (!res?.session) {
        setCheckEmail(email.trim())
        setBusy(false)
        return
      }
      router.push('/student')
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
          <button type="button" className={role === 'student' ? 'active' : ''} onClick={() => { setRole('student'); setApplied(false); setErr('') }}>Ученик</button>
          <button type="button" className={role === 'teacher' ? 'active' : ''} onClick={() => { setRole('teacher'); setCheckEmail(''); setErr('') }}>Учитель</button>
        </div>

        {applied ? (
          <>
            <div className="raw2-login-title">Заявка отправлена</div>
            <p className="raw2-login-check-msg">
              Мы получили заявку и напишем на<br />
              <b>{email.trim()}</b>.<br />
              После одобрения придёт письмо с доступом в кабинет преподавателя.
            </p>
            <Link href="/" className="btn btn-red" style={{ alignSelf: 'center', marginTop: 8, textAlign: 'center' }}>
              Ок
            </Link>
          </>
        ) : role === 'teacher' ? (
          <>
            <div className="raw2-login-title">Заявка преподавателя</div>

            <form className="raw2-login-form" onSubmit={onApply}>
              <input name="first_name" type="text" placeholder="имя" required autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} />
              <input name="last_name" type="text" placeholder="фамилия" required autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} />
              <input name="email" type="email" placeholder="электронная почта" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
              <input name="contact" type="text" placeholder="telegram или телефон" autoComplete="tel" value={contact} onChange={e => setContact(e.target.value)} />
              <button type="submit" className="btn btn-red" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить заявку'}</button>
              {err && <p className="raw2-login-err">{err}</p>}
              <label className="raw2-check"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>Согласен с обработкой персональных данных</span></label>
              <Link href="/login" className="raw2-login-reg">Уже есть аккаунт? Войти</Link>
            </form>
          </>
        ) : checkEmail ? (
          <>
            <div className="raw2-login-title">Проверьте почту</div>
            <p className="raw2-login-check-msg">
              Мы отправили ссылку для подтверждения на<br />
              <b>{checkEmail}</b>.<br />
              Перейдите по ссылке из письма, чтобы войти в личный кабинет.
            </p>
            <Link href="/login" className="btn btn-red" style={{ alignSelf: 'center', marginTop: 8, textAlign: 'center' }}>
              Ок
            </Link>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <style jsx global>{`
        html:has(.raw2-auth-page) .auth-scope { padding: 0 !important; background: transparent !important; display: block !important; min-height: 0 !important; }
        html:has(.raw2-auth-page) .auth-modal { max-width: none !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
        html:has(.raw2-auth-page) .auth-modal::before { display: none !important; }
        html:has(.raw2-auth-page) .auth-header { display: none !important; }
        html:has(.raw2-auth-page) .auth-body { padding: 0 !important; }

        .raw2-auth-page { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 40px 20px; position: relative; background: #1E1E1E; }
        .raw2-auth-bg { position: fixed; inset: 0; z-index: 0; background-image: url(/landing/raw2/hero.webp); background-size: cover; background-position: center; filter: blur(14px) brightness(.5); transform: scale(1.1); }
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
