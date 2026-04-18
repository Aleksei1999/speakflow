'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'
import { registerSchema } from '@/lib/validations'
import { LevelQuiz, type QuizResult } from '@/components/onboarding/level-quiz'

type RegisterValues = z.infer<typeof registerSchema>

const QUIZ_STORAGE_KEY = 'raw_quiz_result'
const glutenStyle = { fontFamily: 'var(--font-gluten), cursive' }

function safeReadQuizResult(): QuizResult | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(QUIZ_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as QuizResult
    if (!parsed || typeof parsed.level !== 'string' || typeof parsed.xp !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export default function RegisterPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [successDetails, setSuccessDetails] = useState<{
    level: string
    levelName: string
    xp: number
    role: 'student' | 'teacher'
  } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [oauthPending, setOauthPending] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      role: 'student',
      termsAccepted: false as unknown as true,
    },
  })

  const role = watch('role')
  const termsAccepted = watch('termsAccepted')

  // Load quiz result from localStorage on mount & whenever the quiz closes
  useEffect(() => {
    setQuizResult(safeReadQuizResult())
  }, [quizOpen])

  // Cross-tab sync
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === QUIZ_STORAGE_KEY) {
        setQuizResult(safeReadQuizResult())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  async function onSubmit(values: RegisterValues) {
    setServerError(null)
    const supabase = createClient()

    const fullName = `${values.firstName} ${values.lastName}`.trim()

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: fullName,
          first_name: values.firstName,
          last_name: values.lastName,
          phone: values.phone || null,
          role: values.role,
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setServerError('Пользователь с таким email уже зарегистрирован')
      } else if (error.message.includes('rate limit')) {
        setServerError('Слишком много попыток. Подождите несколько минут и попробуйте снова.')
      } else if (error.message.includes('invalid')) {
        setServerError('Проверьте правильность email адреса.')
      } else {
        setServerError(`Не удалось создать аккаунт: ${error.message}`)
      }
      return
    }

    // Fire-and-forget trial lesson request + level test storage for students
    if (values.role === 'student') {
      void fetch('/api/trial-lesson/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelTestId: quizResult?.id ?? null }),
      }).catch(() => {})

      if (quizResult) {
        void fetch('/api/level-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quizResult),
        }).catch(() => {})
      }
    }

    setSuccessDetails({
      level: quizResult?.level ?? '—',
      levelName: quizResult?.levelName ?? 'Определим на пробном',
      xp: quizResult?.xp ?? 0,
      role: values.role,
    })
    setIsSuccess(true)
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

  function goToPlatform() {
    if (!successDetails) return
    router.push(successDetails.role === 'teacher' ? '/teacher' : '/student')
    router.refresh()
  }

  function goToBookTrial() {
    router.push('/teachers')
    router.refresh()
  }

  if (isSuccess && successDetails) {
    return (
      <div className="fade-in">
        <div className="auth-success">
          <div className="success-icon">🎉</div>
          <h3>
            Добро пожаловать в <span className="gl" style={glutenStyle}>Raw!</span>
          </h3>
          <p>
            Аккаунт создан! Пробное занятие уже ждёт тебя — преподаватель определит
            точный уровень и составит план.
          </p>
          <div className="success-details">
            <div className="sd-row">
              <div className="sd-icon sd-icon--red">🎙</div>
              <div>
                <div className="sd-label">Пробное занятие</div>
                <div className="sd-val">Бесплатно · 30 мин</div>
              </div>
            </div>
            <div className="sd-row">
              <div className="sd-icon sd-icon--lime">📈</div>
              <div>
                <div className="sd-label">Текущий уровень</div>
                <div className="sd-val">
                  {successDetails.levelName}
                  {successDetails.xp ? ` · ${successDetails.xp} XP` : ''}
                </div>
              </div>
            </div>
            <div className="sd-row">
              <div className="sd-icon sd-icon--red">🎯</div>
              <div>
                <div className="sd-label">Что дальше</div>
                <div className="sd-val">Преподаватель свяжется в Telegram</div>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="auth-submit auth-submit--lime"
            onClick={goToPlatform}
          >
            🔥 Перейти на платформу
          </button>
          <button
            type="button"
            className="auth-submit auth-submit--ghost"
            onClick={goToBookTrial}
          >
            Выбрать время пробного занятия
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Tabs */}
      <div className="auth-tabs" role="tablist">
        <button type="button" className="auth-tab active" role="tab" aria-selected="true">
          Регистрация
        </button>
        <Link href="/login" className="auth-tab" role="tab" aria-selected="false">
          Вход
        </Link>
      </div>

      {/* Level badge from quiz OR CTA to take it */}
      {quizResult ? (
        <div className="auth-level">
          <div className="auth-level-icon">📈</div>
          <div className="auth-level-info">
            <div className="auth-level-name">
              Твой уровень —{' '}
              <span className="gl" style={glutenStyle}>
                {quizResult.levelName}
              </span>
            </div>
            <div className="auth-level-sub">
              Пробное занятие определит уровень точнее
            </div>
          </div>
          <div className="auth-level-xp">⚡ {quizResult.xp} XP</div>
        </div>
      ) : (
        <button
          type="button"
          className="auth-quiz-cta"
          onClick={() => setQuizOpen(true)}
        >
          <div className="auth-quiz-cta-icon">📝</div>
          <div className="auth-quiz-cta-text">
            <div className="auth-quiz-cta-title">Пройти тест уровня</div>
            <div className="auth-quiz-cta-sub">
              Займёт 2 минуты — узнаешь свой примерный уровень
            </div>
          </div>
        </button>
      )}

      {/* Trial banner (students only) */}
      {role === 'student' && (
        <div className="trial-banner">
          <div className="trial-icon">🎙</div>
          <div className="trial-text">
            <div className="trial-title">Пробное занятие в подарок</div>
            <div className="trial-sub">
              Преподаватель определит твой точный уровень и составит персональный план
            </div>
          </div>
          <div className="trial-badge">Free</div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
        {serverError && <div className="auth-error">{serverError}</div>}

        <div className="field-row">
          <div className="field">
            <div className="field-label">Имя</div>
            <input
              className="field-input"
              type="text"
              placeholder="Как тебя зовут?"
              autoComplete="given-name"
              aria-invalid={!!errors.firstName}
              {...register('firstName')}
            />
            {errors.firstName && (
              <div className="auth-field-error">{errors.firstName.message}</div>
            )}
          </div>
          <div className="field">
            <div className="field-label">Фамилия</div>
            <input
              className="field-input"
              type="text"
              placeholder="Фамилия"
              autoComplete="family-name"
              aria-invalid={!!errors.lastName}
              {...register('lastName')}
            />
            {errors.lastName && (
              <div className="auth-field-error">{errors.lastName.message}</div>
            )}
          </div>
        </div>

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
          <div className="field-label">Телефон</div>
          <div className="phone-wrap" data-invalid={!!errors.phone}>
            <div className="phone-flag">🇷🇺</div>
            <input
              className="phone-input"
              type="tel"
              placeholder="+7 (999) 123-45-67"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              {...register('phone')}
            />
          </div>
          {errors.phone && (
            <div className="auth-field-error">{errors.phone.message}</div>
          )}
        </div>

        <div className="field">
          <div className="field-label">Пароль</div>
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

        {/* Role selector */}
        <div className="field">
          <div className="field-label">Я хочу</div>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <div className="role-row" role="radiogroup" aria-label="Роль">
                <button
                  type="button"
                  role="radio"
                  aria-checked={field.value === 'student'}
                  data-active={field.value === 'student'}
                  className="role-opt"
                  onClick={() => field.onChange('student')}
                >
                  Учиться
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={field.value === 'teacher'}
                  data-active={field.value === 'teacher'}
                  className="role-opt"
                  onClick={() => field.onChange('teacher')}
                >
                  Преподавать
                </button>
              </div>
            )}
          />
          {errors.role && (
            <div className="auth-field-error">{errors.role.message}</div>
          )}
        </div>

        {/* Terms checkbox */}
        <label className="check-row">
          <input
            type="checkbox"
            style={{ display: 'none' }}
            checked={!!termsAccepted}
            onChange={(e) =>
              setValue('termsAccepted', e.target.checked as unknown as true, {
                shouldValidate: true,
              })
            }
          />
          <span
            className="check-box"
            data-checked={!!termsAccepted}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="check-label">
            Я принимаю{' '}
            <Link href="/terms" target="_blank">
              условия использования
            </Link>{' '}
            и{' '}
            <Link href="/privacy" target="_blank">
              политику конфиденциальности
            </Link>
          </span>
        </label>
        {errors.termsAccepted && (
          <div className="auth-field-error">{errors.termsAccepted.message}</div>
        )}

        <button
          type="submit"
          className="auth-submit auth-submit--red"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          )}
          {role === 'teacher' ? 'Зарегистрироваться' : 'Зарегистрироваться и записаться'}
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
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.607.069-.607 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" fill="#1E1E1E" />
            </svg>
            GitHub
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
        Уже есть аккаунт? <Link href="/login">Войти</Link>
      </div>

      {quizResult && (
        <div className="auth-bottom" style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setQuizOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--auth-text3)',
              cursor: 'pointer',
              fontSize: '.72rem',
              textDecoration: 'underline',
              fontFamily: 'inherit',
            }}
          >
            Перепройти тест уровня
          </button>
        </div>
      )}

      <LevelQuiz
        open={quizOpen}
        onOpenChange={setQuizOpen}
        onComplete={(r) => {
          setQuizResult(r)
          setQuizOpen(false)
        }}
      />
    </div>
  )
}
