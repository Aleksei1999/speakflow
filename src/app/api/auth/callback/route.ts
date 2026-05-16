import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { autoAssignTrial } from '@/lib/trial-lesson/auto-assign'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { logAuditEvent } from '@/lib/audit/log'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from '@/i18n/config'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // Rate-limit: защита OAuth callback от brute-force / flood.
  // 10 попыток в минуту на IP, fail-closed (это auth-периметр).
  // NextRequest нужен только для headers — оборачиваем Request.
  const limited = await enforceRateLimitStrict(request as any, {
    name: 'auth:callback',
    keyParts: [getClientIp(request as any)],
    max: 10,
    windowSeconds: 60,
  })
  if (limited) return limited

  // Validate redirect target to prevent open redirect attacks.
  // Only allow relative paths starting with "/" and reject protocol-relative URLs.
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : null

  if (!code) {
    // No authorization code present — redirect to login with an error indicator
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Code exchange failed — expired or already used
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // If a valid `next` was supplied (e.g. /reset-password), honor it regardless of role.
  let redirectPath = safeNext

  // Always pull the user once — used for both role routing and trial auto-assign.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Резолвим роль один раз — нужна и для redirect, и для отдельной
  // admin_signin записи в audit log. Заодно подтягиваем language —
  // чтобы выставить rwen_locale cookie сразу после логина (next-intl
  // подхватит UI-локаль уже на дашборде).
  let resolvedRole: string | null = null
  let resolvedLanguage: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, language')
      .eq('id', user.id)
      .single<{ role: string; language: string | null }>()
    resolvedRole = profile?.role ?? null
    resolvedLanguage = profile?.language ?? null
  }

  if (!redirectPath) {
    if (user) {
      redirectPath =
        resolvedRole === 'admin'
          ? '/admin'
          : resolvedRole === 'teacher'
            ? '/teacher'
            : '/student'
    } else {
      redirectPath = '/student'
    }
  }

  // Audit: successful OAuth/email exchange. Best-effort — не блокируем callback.
  if (user) {
    await logAuditEvent(request as any, {
      category: 'auth',
      action: 'signin',
      target_type: 'auth.users',
      target_id: user.id,
      payload: {
        provider: user.app_metadata?.provider ?? null,
        next: safeNext,
        role: resolvedRole,
      },
    })

    // Отдельная запись для admin audit trail — облегчает фильтр по
    // category='admin' без необходимости джойнить profiles.
    if (resolvedRole === 'admin') {
      await logAuditEvent(request as any, {
        category: 'admin',
        action: 'admin_signin',
        target_type: 'auth.users',
        target_id: user.id,
        payload: {
          provider: user.app_metadata?.provider ?? null,
        },
      })
    }
  }

  // Trial-lesson auto-assignment runs once per signup, on the first time
  // the student lands here with a session. user_metadata.preferred_slot is
  // set during /register; on Google OAuth without preferred_slot the call
  // is a no-op.
  if (user) {
    const meta = user.user_metadata ?? {}
    const role = meta.role
    const preferredSlot =
      typeof meta.preferred_slot === 'string' ? meta.preferred_slot : null

    if (role !== 'teacher' && role !== 'admin') {
      try {
        await autoAssignTrial({
          userId: user.id,
          preferredSlot,
        })
      } catch (err) {
        console.error('[auth/callback] autoAssignTrial failed', err)
      }
    }
  }

  const res = NextResponse.redirect(`${origin}${redirectPath}`)

  // Persist UI locale in a cookie so SSR/next-intl can pick it up on
  // every subsequent request without hitting profiles each time.
  if (resolvedLanguage && isLocale(resolvedLanguage)) {
    res.cookies.set(LOCALE_COOKIE, resolvedLanguage, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    })
  }

  return res
}
