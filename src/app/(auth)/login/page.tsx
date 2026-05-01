// @ts-nocheck
'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations'

type LoginValues = z.infer<typeof loginSchema>

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const initialRole = searchParams.get('as') === 'teacher' ? 'teacher' : 'student'
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [oauthPending, setOauthPending] = useState(false)
  const [role, setRole] = useState<'student' | 'teacher'>(initialRole)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setServerError('Неверный email или пароль')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setServerError('Не удалось получить данные пользователя')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (redirectTo && redirectTo.startsWith('/')) {
      router.push(redirectTo)
    } else if (profile?.role === 'teacher') {
      router.push('/teacher')
    } else {
      router.push('/student')
    }

    router.refresh()
  }

  async function handleGoogle() {
    setServerError(null)
    setOauthPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) {
      setOauthPending(false)
      setServerError('Не удалось подключиться к Google. Попробуйте ещё раз.')
    }
  }

  return (
    <div className="fade-in">
      <style>{`
        .role-toggle{display:flex;gap:6px;background:var(--auth-bg,rgba(0,0,0,.04));border-radius:12px;padding:4px;margin-bottom:18px}
        .role-toggle button{flex:1;padding:10px 14px;border:none;background:transparent;border-radius:9px;font:inherit;font-weight:600;font-size:13px;color:var(--auth-muted,rgba(0,0,0,.55));cursor:pointer;transition:all .15s}
        .role-toggle button.active{background:var(--auth-surface,#fff);color:var(--auth-text,#111);box-shadow:0 1px 3px rgba(0,0,0,.06)}
        .role-toggle button:hover:not(.active){color:var(--auth-text,#111)}
      `}</style>
      <div className="role-toggle" role="tablist" aria-label="Тип аккаунта">
        <button
          type="button"
          role="tab"
          aria-selected={role === 'student'}
          className={role === 'student' ? 'active' : ''}
          onClick={() => setRole('student')}
        >
          🎓 Ученик
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={role === 'teacher'}
          className={role === 'teacher' ? 'active' : ''}
          onClick={() => setRole('teacher')}
        >
          👨‍🏫 Преподаватель
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
        {serverError && <div className="auth-error">{serverError}</div>}

        <div className="field">
          <div className="field-label">Email</div>
          <input
            className="field-input"
            type="email"
            placeholder="hello@example.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <div className="auth-field-error">{errors.email.message}</div>
          )}
        </div>

        <div className="field">
          <div className="field-label">Пароль</div>
          <div className="pass-wrap">
            <input
              className="field-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Введи пароль"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            <button
              type="button"
              className="pass-toggle"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              onClick={() => setShowPassword((v) => !v)}
              style={showPassword ? { color: 'var(--auth-red)' } : undefined}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <div className="auth-field-error">{errors.password.message}</div>
          )}
        </div>

        <Link href="/forgot-password" className="forgot-link">
          Забыли пароль?
        </Link>

        <button
          type="submit"
          className="auth-submit auth-submit--red"
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
          )}
          Войти
        </button>

        <div className="auth-divider">
          <span>или</span>
        </div>

        <div className="social-btns">
          <button
            type="button"
            className="social-btn"
            onClick={handleGoogle}
            disabled={oauthPending}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </button>
          <button type="button" className="social-btn" disabled title="Скоро">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-16.5 7.5a1.5 1.5 0 0 0 .108 2.79l4.716 1.572 2.25 6a1.5 1.5 0 0 0 2.529.6l2.407-2.407 4.473 3.315a1.5 1.5 0 0 0 2.341-.924l3-16.5a2.25 2.25 0 0 0-3.302-2.161z" fill="#2AABEE" />
            </svg>
            Telegram
          </button>
        </div>
      </form>

      <div className="auth-bottom">
        {role === 'teacher' ? (
          <>Ещё не преподаёшь у нас? <Link href="/teach">Подать заявку</Link></>
        ) : (
          <>Нет аккаунта? <Link href="/register">Зарегистрироваться</Link></>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <Loader2
            className="animate-spin"
            style={{ width: 32, height: 32, color: 'var(--auth-red)' }}
          />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
