'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import { type QuizResult } from '@/components/onboarding/level-quiz'
import { RawLogo } from '@/components/ui/raw-logo'

type Mood = 'happy' | 'neutral' | 'worried' | 'wow' | 'cool' | 'dead'

const QUIZ_KEY = 'raw_quiz_result'
const GOALS_KEY = 'raw_quiz_goals'

type QuizGoals = {
  purpose: string | null
  purposeLabel: string | null
  timeline: string | null
  timelineLabel: string | null
  intensity: string | null
  intensityLabel: string | null
}

const GRADE_MAP: Record<
  string,
  { name: string; cefr: string; color: string; body: string }
> = {
  raw: { name: 'Raw', cefr: 'A1', color: '#D33F3F', body: '#8B0000' },
  rare: { name: 'Rare', cefr: 'A1+', color: '#D33F3F', body: '#B22222' },
  mediumrare: { name: 'Medium Rare', cefr: 'A2', color: '#FF8A7A', body: '#CD5C5C' },
  medium: { name: 'Medium', cefr: 'B1', color: '#FFD93D', body: '#D2691E' },
  mediumwell: { name: 'Medium Well', cefr: 'B2', color: '#A8E063', body: '#A0826D' },
  welldone: { name: 'Well Done', cefr: 'C1+', color: '#4ADE80', body: '#8B4513' },
}

function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function nextSlots() {
  const now = new Date()
  const mk = (addDays: number, h: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + addDays)
    d.setHours(h, 0, 0, 0)
    return d
  }
  return [
    { id: 0, day: 'завтра', time: '10:00', iso: mk(1, 10).toISOString() },
    { id: 1, day: 'завтра', time: '19:00', iso: mk(1, 19).toISOString() },
    { id: 2, day: 'послезавтра', time: '11:00', iso: mk(2, 11).toISOString() },
    { id: 3, day: 'послезавтра', time: '20:00', iso: mk(2, 20).toISOString() },
  ]
}

function SteakSVG({ mood, size = 72, color = '#D33F3F' }: { mood: Mood; size?: number; color?: string }) {
  const face: Record<Mood, React.ReactNode> = {
    cool: (
      <>
        <rect x="26" y="42" width="16" height="10" rx="3" fill="#1a1a1a" />
        <rect x="54" y="42" width="16" height="10" rx="3" fill="#1a1a1a" />
        <rect x="42" y="46" width="12" height="2" fill="#1a1a1a" />
        <path d="M 36 62 Q 48 72, 60 62" stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </>
    ),
    happy: (
      <>
        <ellipse cx="36" cy="46" rx="3.5" ry="5" fill="white" />
        <ellipse cx="60" cy="46" rx="3.5" ry="5" fill="white" />
        <circle cx="36" cy="47" r="2.2" fill="#1a1a1a" />
        <circle cx="60" cy="47" r="2.2" fill="#1a1a1a" />
        <path d="M 34 60 Q 48 70, 62 60" stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </>
    ),
    neutral: <path d="M 36 62 L 60 62" stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" />,
    worried: <path d="M 34 65 Q 48 58, 62 65" stroke="#1a1a1a" strokeWidth={2.4} fill="none" strokeLinecap="round" />,
    wow: <ellipse cx="48" cy="64" rx="5" ry="6" fill="#1a1a1a" />,
    dead: null,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <ellipse cx="48" cy="52" rx="34" ry="36" fill={color} />
      <ellipse cx="24" cy="56" rx="5" ry="3" fill="#FF8A7A" opacity="0.65" />
      <ellipse cx="72" cy="56" rx="5" ry="3" fill="#FF8A7A" opacity="0.65" />
      {face[mood]}
      <ellipse cx="48" cy="94" rx="22" ry="3" fill="black" opacity="0.25" />
    </svg>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  )
}

function RegisterPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [goals, setGoals] = useState<QuizGoals | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const slots = useMemo(() => nextSlots(), [])
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(true)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [oauthPending, setOauthPending] = useState(false)
  const [refCode, setRefCode] = useState<string | null>(null)
  const [refBanner, setRefBanner] = useState<{ inviterName: string | null; bonusXp: number } | null>(null)
  const roleParam = (searchParams?.get('role') ?? '').toLowerCase()
  const isTeacher = roleParam === 'teacher'
  const [success, setSuccess] = useState<{
    name: string
    email: string
    slot: string
    level: string
    cefr: string
    color: string
    purpose: string | null
  } | null>(null)

  useEffect(() => {
    setQuizResult(readJSON<QuizResult>(QUIZ_KEY))
    setGoals(readJSON<QuizGoals>(GOALS_KEY))
  }, [])

  // Читаем ?ref=XXX и валидируем через API. Если endpoint упал или код невалиден —
  // просто не показываем баннер, но код сохраняем (сервер проигнорирует невалидный
  // при signUp, а backend-агент мог ещё не задеплоить endpoint).
  useEffect(() => {
    const code = searchParams?.get('ref')?.trim() ?? null
    if (!code) return
    setRefCode(code)
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/referrals/verify?code=${encodeURIComponent(code)}`,
          { cache: 'no-store' },
        )
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        if (json?.valid) {
          setRefBanner({
            inviterName: typeof json?.inviter_name === 'string' ? json.inviter_name : null,
            bonusXp: Number(json?.bonus_xp ?? 50),
          })
        }
      } catch {
        // Graceful degradation — код всё равно отправится в signUp
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  const grade = useMemo(() => {
    if (!quizResult) return null
    return (
      GRADE_MAP[quizResult.level] ?? {
        name: quizResult.levelName,
        cefr: '—',
        color: '#D33F3F',
        body: '#8B0000',
      }
    )
  }, [quizResult])

  const hasProfile = !!(grade || goals?.purposeLabel || goals?.timelineLabel || goals?.intensityLabel)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const validate = useCallback(() => {
    const e: Record<string, boolean> = {}
    if (!name.trim()) e.name = true
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = true
    if (password.length < 6) e.password = true
    if (!phone.trim()) e.phone = true
    setErrors(e)
    if (!consent) {
      showToast('Нужно согласие с условиями')
      return false
    }
    return Object.keys(e).length === 0
  }, [name, email, password, phone, consent, showToast])

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setServerError(null)
    if (!validate()) return
    setPending(true)
    const supabase = createClient()
    const parts = name.trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ') || ''
    const chosen = slots[selectedSlot]
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          first_name: firstName,
          last_name: lastName,
          phone: phone.trim() || null,
          role: isTeacher ? 'teacher' : 'student',
          // preferred_slot — только для студентского пробного.
          ...(isTeacher ? {} : { preferred_slot: chosen.iso }),
          // Реферальный код (если есть). Триггер handle_new_user валидирует и,
          // если код невалиден, просто игнорирует — signUp всё равно пройдёт.
          ...(refCode ? { ref_code: refCode } : {}),
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (error) {
      setPending(false)
      if (error.message.includes('already registered')) {
        setServerError('Пользователь с таким email уже зарегистрирован')
      } else if (error.message.includes('rate limit')) {
        setServerError('Слишком много попыток. Подождите несколько минут.')
      } else {
        setServerError('Не удалось создать аккаунт: ' + error.message)
      }
      return
    }
    // trial_lesson_requests + auto-assignment теперь создаются на сервере
    // в /api/auth/callback после подтверждения email — там есть кука сессии.
    if (quizResult) {
      void fetch('/api/level-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizResult),
      }).catch(() => {})
    }
    setSuccess({
      name: firstName,
      email: email.trim(),
      slot: isTeacher ? '' : `${chosen.day}, ${chosen.time}`,
      level: isTeacher ? '' : (grade?.name || quizResult?.levelName || 'Определим на пробном'),
      cefr: isTeacher ? '' : (grade?.cefr || '—'),
      color: grade?.color || '#D33F3F',
      purpose: isTeacher ? null : (goals?.purposeLabel || null),
    })
    setPending(false)
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
      showToast('Не удалось подключиться к Google')
    }
  }

  if (success) {
    return (
      <>
        <RegisterStyles />
        <div className="r-page">
          <div className="success-wrap">
            <div className="success-icon">
              <svg width="40" height="40" viewBox="0 0 20 20" aria-hidden>
                <path
                  d="M5 10 L9 14 L16 6"
                  stroke="#4ADE80"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2>Готово, {success.name}!</h2>
            {isTeacher ? (
              <p>
                Аккаунт преподавателя создан. Мы написали тебе на <b>{success.email}</b>{' '}
                ссылку для подтверждения email. После входа заполни профиль и расписание —
                и можно работать.
              </p>
            ) : (
              <p>
                Аккаунт создан. Мы напишем на <b>{success.email}</b> в течение часа,
                чтобы подтвердить время пробного урока. Стейк уже ждёт.
              </p>
            )}
            {!isTeacher && (
              <div className="success-detail">
                <div className="sd-row">
                  <span className="sd-k">Уровень</span>
                  <span className="sd-v" style={{ color: success.color }}>
                    {success.level} · {success.cefr}
                  </span>
                </div>
                {success.purpose && (
                  <div className="sd-row">
                    <span className="sd-k">Цель</span>
                    <span className="sd-v">{success.purpose}</span>
                  </div>
                )}
                <div className="sd-row">
                  <span className="sd-k">Пробный</span>
                  <span className="sd-v">{success.slot}</span>
                </div>
                <div className="sd-row">
                  <span className="sd-k">Длительность</span>
                  <span className="sd-v">45 минут</span>
                </div>
                <div className="sd-row">
                  <span className="sd-k">Стоимость</span>
                  <span className="sd-v" style={{ color: '#4ADE80' }}>бесплатно</span>
                </div>
              </div>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                router.push(isTeacher ? '/teacher' : '/student')
                router.refresh()
              }}
            >
              Перейти в приложение
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => router.push('/')}
              style={{ marginTop: 10 }}
            >
              На главную
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <RegisterStyles />
      <div className="r-page">
        <div className="r-topbar">
          <Link href="/" className="r-iconbtn" aria-label="На главную">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M11 3 L5 9 L11 15"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link href="/" className="r-topbar-logo" aria-label="Raw English">
            <RawLogo size={28} />
          </Link>
          <Link href="/" className="r-iconbtn" aria-label="Закрыть">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>
        <div className="form-wrap">
          <div className="head-label">Последний шаг</div>

          <div className="mascot">
            <SteakSVG mood="cool" size={72} color={grade?.body || '#D33F3F'} />
          </div>
          <h2 className="form-title">{isTeacher ? 'Стать преподавателем' : 'Создай аккаунт'}</h2>
          <p className="form-sub">
            {isTeacher
              ? 'Присоединяйся к Raw English как преподаватель'
              : 'И записывайся на бесплатный пробный'}
          </p>

          {refBanner && (
            <div className="ref-banner" role="status">
              <div className="ref-banner-emoji">🎁</div>
              <div className="ref-banner-text">
                {refBanner.inviterName ? (
                  <>
                    Тебя пригласил <b>{refBanner.inviterName}</b> — получи{' '}
                    <b>+{refBanner.bonusXp} XP</b> и бесплатный пробный урок
                  </>
                ) : (
                  <>
                    У тебя реферальная ссылка — получи <b>+{refBanner.bonusXp} XP</b>{' '}
                    и бесплатный пробный урок
                  </>
                )}
              </div>
            </div>
          )}

          {hasProfile && (
            <div className="profile-summary">
              {grade && (
                <div className="ps-row">
                  <span className="ps-k">Уровень</span>
                  <span className="ps-v" style={{ color: grade.color }}>
                    {grade.name} · {grade.cefr}
                  </span>
                </div>
              )}
              {goals?.purposeLabel && (
                <div className="ps-row">
                  <span className="ps-k">Цель</span>
                  <span className="ps-v">{goals.purposeLabel}</span>
                </div>
              )}
              {goals?.timelineLabel && (
                <div className="ps-row">
                  <span className="ps-k">Срок</span>
                  <span className="ps-v">{goals.timelineLabel}</span>
                </div>
              )}
              {goals?.intensityLabel && (
                <div className="ps-row">
                  <span className="ps-k">Интенсивность</span>
                  <span className="ps-v">{goals.intensityLabel}</span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate>
            {serverError && <div className="server-error">{serverError}</div>}

            <div className="field">
              <label htmlFor="r-name">Имя</label>
              <input
                id="r-name"
                type="text"
                placeholder="Мария"
                autoComplete="given-name"
                className={errors.name ? 'err' : ''}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="r-email">Email</label>
              <input
                id="r-email"
                type="email"
                placeholder="maria@example.com"
                autoComplete="email"
                className={errors.email ? 'err' : ''}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="r-password">Пароль</label>
              <div className="pwd-wrap">
                <input
                  id="r-password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Минимум 6 символов"
                  autoComplete="new-password"
                  className={errors.password ? 'err' : ''}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path d="M1 9 Q9 3, 17 9 Q9 15, 1 9 Z" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="r-phone">Телефон или Telegram</label>
              <input
                id="r-phone"
                type="text"
                placeholder="+7 999 123-45-67 или @username"
                autoComplete="tel"
                className={errors.phone ? 'err' : ''}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {!isTeacher && (
              <div className="field">
                <label>Удобное время для пробного</label>
                <div className="slot-grid">
                  {slots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`slot ${selectedSlot === s.id ? 'active' : ''}`}
                      onClick={() => setSelectedSlot(s.id)}
                    >
                      <div className="slot-day">{s.day}</div>
                      <div className="slot-time">{s.time}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Согласен(на) с{' '}
                <Link href="/terms" target="_blank">
                  условиями
                </Link>{' '}
                и{' '}
                <Link href="/privacy" target="_blank">
                  политикой
                </Link>
              </span>
            </label>

            <button
              type="submit"
              className="btn-primary"
              disabled={pending}
              style={{ marginTop: 14, maxWidth: 'none' }}
            >
              {pending
                ? 'Создаём аккаунт…'
                : isTeacher
                  ? 'Создать аккаунт преподавателя'
                  : 'Создать аккаунт и записаться'}
            </button>

            <div className="sso-divider">
              <span>или</span>
            </div>

            <div className="sso-row">
              <button
                type="button"
                className="sso-btn"
                onClick={handleGoogle}
                disabled={oauthPending}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                  <path
                    d="M17 9.2 C17 8.6, 17 8.1, 16.9 7.5 L9 7.5 L9 10.5 L13.5 10.5 C13.3 11.7, 12.6 12.7, 11.6 13.3 L11.6 15.2 L14.2 15.2 C15.9 13.7, 17 11.6, 17 9.2 Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 17 C11.4 17, 13.4 16.2, 14.2 15.2 L11.6 13.3 C10.9 13.8, 10 14.1, 9 14.1 C6.7 14.1, 4.8 12.6, 4.1 10.5 L1.5 10.5 L1.5 12.5 C2.9 15.2, 5.7 17, 9 17 Z"
                    fill="#34A853"
                  />
                  <path
                    d="M4.1 10.5 C3.9 9.9, 3.8 9.3, 3.8 8.5 C3.8 7.7, 3.9 7.1, 4.1 6.5 L4.1 4.5 L1.5 4.5 C0.8 5.7, 0.5 7.1, 0.5 8.5 C0.5 9.9, 0.8 11.3, 1.5 12.5 L4.1 10.5 Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 2.9 C10.3 2.9, 11.5 3.4, 12.4 4.2 L14.3 2.3 C13.1 1.2, 11.3 0.5, 9 0.5 C5.7 0.5, 2.9 2.3, 1.5 5 L4.1 7 C4.8 4.9, 6.7 2.9, 9 2.9 Z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>
              <button
                type="button"
                className="sso-btn"
                onClick={() => showToast('Apple SSO — скоро')}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="white" aria-hidden>
                  <path d="M12.3 9.5 C12.3 7.3, 14.1 6.4, 14.2 6.3 C13.2 4.9, 11.7 4.7, 11.2 4.7 C10 4.6, 8.8 5.4, 8.2 5.4 C7.6 5.4, 6.6 4.7, 5.6 4.8 C4.3 4.8, 3.1 5.6, 2.5 6.7 C1.1 9.1, 2.1 12.6, 3.4 14.6 C4.1 15.5, 4.9 16.5, 5.9 16.5 C6.9 16.5, 7.2 15.9, 8.4 15.9 C9.6 15.9, 9.9 16.5, 10.9 16.5 C12 16.5, 12.6 15.5, 13.3 14.6 C14.1 13.6, 14.4 12.5, 14.4 12.5 C14.4 12.5, 12.3 11.7, 12.3 9.5 Z M10.4 3.5 C10.9 2.9, 11.2 2, 11.1 1.2 C10.4 1.3, 9.5 1.7, 9 2.3 C8.5 2.9, 8.2 3.7, 8.3 4.5 C9.1 4.6, 9.9 4.1, 10.4 3.5 Z" />
                </svg>
                Apple
              </button>
            </div>
          </form>

          <div className="login-link">
            Уже есть аккаунт? <Link href="/login">Войти</Link>
          </div>
        </div>

        {toast && <div className="toast show">{toast}</div>}
      </div>
    </>
  )
}

function RegisterStyles() {
  return (
    <style>{`
      /* Override the light auth-modal chrome: /register runs its own dark layout. */
      html:has(.r-page), html:has(.r-page) body {
        background-color: #0a0a0a !important;
        background-image:
          radial-gradient(ellipse at 20% 0%, rgba(211,63,63,0.18), transparent 45%),
          radial-gradient(ellipse at 90% 100%, rgba(211,63,63,0.12), transparent 50%) !important;
        background-attachment: fixed !important;
      }
      .auth-scope:has(.r-page) { padding: 0 !important; align-items: stretch !important; min-height: 100dvh; background: transparent !important; }
      .auth-scope:has(.r-page) .auth-modal {
        max-width: 720px;
        background: transparent;
        box-shadow: none;
        border-radius: 0;
        overflow: visible;
      }
      .auth-scope:has(.r-page) .auth-modal::before { display: none; }
      /* Register renders its own top bar inside .r-page, so hide the shared one. */
      .auth-scope:has(.r-page) .auth-header { display: none; }
      .auth-scope:has(.r-page) .auth-body { padding: 0; }

      .r-topbar {
        max-width: 720px;
        margin: 0 auto;
        padding: 20px 20px 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .r-topbar-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
      }
      .r-topbar-logo img { filter: brightness(0) invert(1); }
      .r-iconbtn {
        width: 40px; height: 40px; border-radius: 12px;
        background: var(--rp-surface);
        border: 1px solid var(--rp-border);
        display: flex; align-items: center; justify-content: center;
        color: rgba(255,255,255,0.7);
        transition: all 0.15s;
        flex-shrink: 0;
        text-decoration: none;
        cursor: pointer;
      }
      .r-iconbtn:hover {
        background: var(--rp-surface-2);
        border-color: var(--rp-red);
        color: var(--rp-red);
      }

      .r-page {
        --rp-red: #D33F3F;
        --rp-red-dark: #991F1F;
        --rp-red-soft: #FF8A7A;
        --rp-green: #4ADE80;
        --rp-surface: #141414;
        --rp-surface-2: #1c1c1c;
        --rp-text: #ffffff;
        --rp-muted: rgba(255,255,255,0.5);
        --rp-border: rgba(255,255,255,0.08);
        --rp-border-hover: rgba(255,255,255,0.2);
        color: var(--rp-text);
      }

      .r-page * { box-sizing: border-box; }
      .r-page button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }

      .form-wrap { animation: r-pop 0.4s ease-out; text-align: left; max-width: 480px; margin: 0 auto; padding: 0 20px 40px; }
      .head-label {
        font-size: 10px; letter-spacing: 0.2em; color: var(--rp-red);
        text-transform: uppercase; font-weight: 600;
        text-align: center; margin-bottom: 14px;
      }

      .mascot { display: flex; justify-content: center; margin-bottom: 14px; }
      .mascot svg { animation: r-float 3s ease-in-out infinite; }

      .form-title { font-size: 22px; font-weight: 700; text-align: center; margin: 0 0 6px; letter-spacing: -0.01em; }
      .form-sub { font-size: 14px; color: var(--rp-muted); text-align: center; margin: 0 0 24px; }

      .ref-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        background: linear-gradient(135deg, rgba(74,222,128,0.14), rgba(211,63,63,0.08));
        border: 1px solid rgba(74,222,128,0.28);
        border-radius: 14px;
        padding: 12px 14px;
        margin-bottom: 18px;
        animation: r-pop 0.4s ease-out;
      }
      .ref-banner-emoji { font-size: 24px; flex-shrink: 0; }
      .ref-banner-text { font-size: 13px; line-height: 1.4; color: rgba(255,255,255,0.85); }
      .ref-banner-text b { color: white; font-weight: 700; }

      .profile-summary {
        background: linear-gradient(135deg, rgba(211,63,63,0.12), rgba(211,63,63,0.04));
        border: 1px solid rgba(211,63,63,0.25);
        border-radius: 14px;
        padding: 12px 14px;
        margin-bottom: 20px;
      }
      .ps-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; }
      .ps-k { color: var(--rp-muted); font-weight: 500; }
      .ps-v { color: white; font-weight: 600; }

      .r-page .field { margin-bottom: 14px; }
      .r-page .field label {
        display: block; font-size: 12px; letter-spacing: 0.1em;
        text-transform: uppercase; color: var(--rp-muted);
        font-weight: 600; margin-bottom: 6px;
      }
      .r-page .field input {
        width: 100%;
        background: var(--rp-surface);
        border: 1.5px solid var(--rp-border);
        border-radius: 12px;
        padding: 14px 16px;
        color: white;
        font-size: 15px;
        font-family: inherit;
        transition: border-color 0.15s;
        outline: none;
      }
      .r-page .field input:focus { border-color: var(--rp-red); }
      .r-page .field input::placeholder { color: rgba(255,255,255,0.3); }
      .r-page .field input.err { border-color: var(--rp-red); animation: r-shake 0.35s; }

      .pwd-wrap { position: relative; }
      .pwd-wrap input { padding-right: 44px; }
      .pwd-toggle {
        position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
        width: 30px; height: 30px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        color: var(--rp-muted); transition: color 0.15s;
      }
      .pwd-toggle:hover { color: white; }

      .slot-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .slot {
        background: var(--rp-surface);
        border: 1.5px solid var(--rp-border);
        border-radius: 12px;
        padding: 12px;
        text-align: center;
        transition: all 0.15s;
        color: white;
      }
      .slot:hover { border-color: var(--rp-red-soft); background: rgba(211,63,63,0.05); }
      .slot.active { background: rgba(211,63,63,0.15); border-color: var(--rp-red); }
      .slot-day { font-size: 11px; color: var(--rp-muted); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
      .slot-time { font-size: 15px; font-weight: 600; }

      .consent {
        display: flex; gap: 10px; align-items: flex-start;
        margin-top: 12px; font-size: 12px; color: var(--rp-muted);
        cursor: pointer;
      }
      .consent input { margin-top: 2px; accent-color: var(--rp-red); flex-shrink: 0; }
      .consent a { color: var(--rp-red-soft); text-decoration: none; }
      .consent a:hover { text-decoration: underline; }

      .r-page .btn-primary {
        background: var(--rp-red);
        color: white;
        font-size: 16px;
        font-weight: 600;
        padding: 16px 28px;
        border-radius: 14px;
        box-shadow: 0 4px 0 var(--rp-red-dark);
        transition: transform 0.1s, box-shadow 0.1s;
        width: 100%;
      }
      .r-page .btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
      .r-page .btn-primary:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 var(--rp-red-dark); }
      .r-page .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

      .r-page .btn-ghost {
        background: transparent;
        color: rgba(255,255,255,0.7);
        border: 1px solid var(--rp-border-hover);
        padding: 14px 24px;
        border-radius: 14px;
        font-size: 14px;
        font-weight: 500;
        width: 100%;
        transition: background 0.15s;
      }
      .r-page .btn-ghost:hover { background: rgba(255,255,255,0.05); }

      .sso-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0 14px; }
      .sso-divider::before, .sso-divider::after { content: ''; flex: 1; height: 1px; background: var(--rp-border); }
      .sso-divider span { font-size: 11px; color: var(--rp-muted); letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; }

      .sso-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .sso-btn {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        background: var(--rp-surface); border: 1px solid var(--rp-border);
        border-radius: 12px; padding: 12px;
        color: white; font-size: 14px; font-weight: 500;
        transition: background 0.15s;
      }
      .sso-btn:hover:not(:disabled) { background: var(--rp-surface-2); }
      .sso-btn:disabled { opacity: 0.55; cursor: not-allowed; }

      .server-error {
        background: rgba(211,63,63,0.12);
        border: 1px solid rgba(211,63,63,0.3);
        color: var(--rp-red-soft);
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 12px;
      }

      .login-link { text-align: center; margin-top: 18px; font-size: 13px; color: var(--rp-muted); }
      .login-link a { color: var(--rp-red-soft); font-weight: 600; text-decoration: none; }
      .login-link a:hover { text-decoration: underline; }

      /* Success */
      .success-wrap { text-align: center; padding: 20px 0; animation: r-pop 0.5s ease-out; max-width: 480px; margin: 0 auto; }
      .success-icon {
        width: 80px; height: 80px; margin: 0 auto 18px;
        background: rgba(74,222,128,0.15);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        animation: r-pop 0.6s 0.1s both;
      }
      .success-wrap h2 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 10px; }
      .success-wrap p { color: var(--rp-muted); max-width: 420px; margin: 0 auto 24px; line-height: 1.5; font-size: 14px; }
      .success-wrap p b { color: white; font-weight: 600; }
      .success-detail {
        background: var(--rp-surface);
        border: 1px solid var(--rp-border);
        border-radius: 14px;
        padding: 16px;
        max-width: 340px;
        margin: 0 auto 20px;
        text-align: left;
      }
      .sd-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--rp-border); font-size: 14px; }
      .sd-row:last-child { border-bottom: none; }
      .sd-k { color: var(--rp-muted); }
      .sd-v { font-weight: 600; color: white; }

      /* Toast */
      .toast {
        position: fixed; bottom: 20px; left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: var(--rp-surface-2); color: white;
        padding: 12px 20px; border-radius: 12px;
        border: 1px solid var(--rp-border);
        font-size: 13px; font-weight: 500;
        opacity: 0; transition: all 0.3s;
        z-index: 1000;
        max-width: 90vw;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      }
      .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

      @keyframes r-pop { 0% { transform: scale(0.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes r-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      @keyframes r-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }

      @media (max-width: 480px) {
        .auth-scope:has(.r-page) .auth-body { padding: 16px 14px 30px; }
        .form-title { font-size: 20px; }
        .slot-grid { grid-template-columns: repeat(2, 1fr); }
      }
    `}</style>
  )
}
