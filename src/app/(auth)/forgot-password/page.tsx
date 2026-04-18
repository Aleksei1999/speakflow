'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'
import { forgotPasswordSchema } from '@/lib/validations'

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    })

    if (error) {
      setServerError('Не удалось отправить письмо. Попробуйте позже.')
      return
    }

    // Always show success to prevent email enumeration
    setIsSuccess(true)
  }

  if (isSuccess) {
    return (
      <div className="fade-in">
        <div className="auth-success">
          <div className="success-icon">✉️</div>
          <h3>Письмо отправлено</h3>
          <p>
            Ссылка для сброса пароля отправлена на email. Проверь почту и следуй
            инструкциям в письме.
          </p>
          <Link href="/login" className="auth-submit auth-submit--ghost">
            Вернуться ко входу
          </Link>
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
          Сброс пароля
        </h2>
        <p style={{ fontSize: '.78rem', color: 'var(--auth-text2)', lineHeight: 1.5 }}>
          Отправляем письмо со ссылкой для сброса пароля
        </p>
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

        <button
          type="submit"
          className="auth-submit auth-submit--red"
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
          )}
          Восстановить пароль
        </button>
      </form>

      <div className="auth-bottom">
        Вспомнил? <Link href="/login">Войти</Link>
      </div>
    </div>
  )
}
