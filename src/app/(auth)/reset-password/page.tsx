// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema } from '@/lib/validations'

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

type SessionStatus = 'checking' | 'valid' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function checkSession() {
      const { data, error } = await supabase.auth.getUser()
      if (cancelled) return
      if (error || !data.user) {
        setSessionStatus('invalid')
      } else {
        setSessionStatus('valid')
      }
    }

    void checkSession()

    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(values: ResetPasswordValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: values.password,
    })

    if (error) {
      if (error.message.includes('New password should be different')) {
        setServerError('Новый пароль должен отличаться от старого')
      } else if (error.message.includes('Password should be at least')) {
        setServerError('Пароль слишком короткий')
      } else {
        setServerError('Не удалось обновить пароль. Попробуйте ещё раз.')
      }
      return
    }

    setIsSuccess(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    let target = '/student'
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role === 'teacher') {
        target = '/teacher'
      }
    }

    setTimeout(() => {
      router.push(target)
      router.refresh()
    }, 1500)
  }

  if (sessionStatus === 'checking') {
    return (
      <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Loader2
          className="animate-spin"
          style={{ width: 32, height: 32, color: 'var(--auth-red)' }}
        />
      </div>
    )
  }

  if (sessionStatus === 'invalid') {
    return (
      <div className="fade-in">
        <div className="auth-success">
          <div className="success-icon" style={{ background: 'rgba(230,57,70,.12)' }}>⏳</div>
          <h3>Ссылка недействительна</h3>
          <p>Ссылка для сброса пароля недействительна или истекла.</p>
          <Link href="/forgot-password" className="auth-submit auth-submit--red">
            Запросить новую ссылку
          </Link>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="fade-in">
        <div className="auth-success">
          <div className="success-icon">✅</div>
          <h3>Пароль обновлён</h3>
          <p>Сейчас перенаправим тебя в кабинет…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontSize: '1.1rem',
            fontWeight: 800,
            color: 'var(--auth-text)',
            marginBottom: 6,
          }}
        >
          Новый пароль
        </h2>
        <p style={{ fontSize: '.78rem', color: 'var(--auth-text2)', lineHeight: 1.5 }}>
          Придумай новый пароль для своего аккаунта.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
        {serverError && <div className="auth-error">{serverError}</div>}

        <div className="field">
          <div className="field-label">Новый пароль</div>
          <div className="pass-wrap">
            <input
              className="field-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Минимум 8 символов"
              autoComplete="new-password"
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

        <div className="field">
          <div className="field-label">Подтверди пароль</div>
          <div className="pass-wrap">
            <input
              className="field-input"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Повтори пароль"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className="pass-toggle"
              aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'}
              onClick={() => setShowConfirm((v) => !v)}
              style={showConfirm ? { color: 'var(--auth-red)' } : undefined}
            >
              {showConfirm ? (
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
          {errors.confirmPassword && (
            <div className="auth-field-error">{errors.confirmPassword.message}</div>
          )}
        </div>

        <button
          type="submit"
          className="auth-submit auth-submit--red"
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
          )}
          Сохранить новый пароль
        </button>
      </form>
    </div>
  )
}
