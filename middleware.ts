import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const publicRoutes = ['/', '/teachers', '/teach', '/level-test', '/get-started', '/privacy', '/oferta']
const authRoutes = ['/login', '/register', '/forgot-password']
// /forgot-password и /reset-password обязаны быть доступны и
// залогиненным юзерам (смена пароля из /settings, recovery-flow при
// активной сессии). Иначе middleware редиректит обратно на dashboard.
const passwordFlowRoutes = ['/forgot-password', '/reset-password']

// Soft-enforce MFA on /admin/* when this env flag is on. Keep it OFF in
// production until at least one admin has completed TOTP enrollment via
// /admin/settings — otherwise the admin will be redirected to settings,
// enroll, and only then can reach /admin again. See migration 070 for the
// RPC definition.
const ADMIN_MFA_ENFORCE = process.env.ENABLE_ADMIN_MFA_ENFORCE === '1'

function homeForRole(role: string | null): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'teacher': return '/teacher'
    default: return '/student'
  }
}

export async function middleware(request: NextRequest) {
  const { user, role, supabase, supabaseResponse } = await updateSession(request)
  const path = request.nextUrl.pathname

  // Allow public routes, API, and static
  if (publicRoutes.some(route => path === route) || path.startsWith('/api/')) {
    return supabaseResponse
  }

  // Allow /teachers/* (catalog) as public
  if (path.startsWith('/teachers')) {
    return supabaseResponse
  }

  // Unauthenticated → login
  if (!user) {
    if (authRoutes.some(route => path === route)) {
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // Authenticated on auth pages → redirect to their dashboard.
  // Исключение: password-flow роуты (forgot/reset) — нужны и
  // залогиненному юзеру, чтобы он мог сменить пароль из настроек.
  if (
    authRoutes.some(route => path === route) &&
    !passwordFlowRoutes.includes(path)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = homeForRole(role)
    return NextResponse.redirect(url)
  }

  // Role-based route protection
  const rolePrefixes: Record<string, string> = {
    student: '/student',
    teacher: '/teacher',
    admin: '/admin',
  }

  const userRole = role ?? 'student'
  const userHome = rolePrefixes[userRole] ?? '/student'

  for (const [routeRole, prefix] of Object.entries(rolePrefixes)) {
    if (path.startsWith(prefix) && routeRole !== userRole) {
      const url = request.nextUrl.clone()
      url.pathname = userHome
      return NextResponse.redirect(url)
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // MFA soft-enforcement for admin routes.
  //
  // Runs AFTER role-based protection so we only ever check MFA for
  // admins who actually have access to /admin. The check is one
  // PostgREST RPC call (`public.admin_has_mfa()`) which translates to a
  // single index lookup on auth.mfa_factors — cheap enough for every
  // /admin/* navigation.
  //
  // On miss we redirect INSIDE the dashboard (no logout, no clearing of
  // cookies). The user lands on /student/settings?mfa=required where
  // the MFA card is auto-scrolled into view with a red banner.
  //
  // Gated by env so we can deploy the enrollment UI first, let admins
  // set up TOTP at their own pace, then flip the flag.
  // ──────────────────────────────────────────────────────────────────────
  if (ADMIN_MFA_ENFORCE && userRole === 'admin' && path.startsWith('/admin')) {
    try {
      const { data: hasMfa, error } = await supabase.rpc('admin_has_mfa')
      if (!error && hasMfa !== true) {
        const url = request.nextUrl.clone()
        // Settings page is reused for all three roles — same file.
        url.pathname = '/student/settings'
        url.searchParams.set('mfa', 'required')
        return NextResponse.redirect(url)
      }
      // On RPC error we FAIL-OPEN (admin keeps access). The alternative
      // — locking admins out on a transient DB blip — is worse than
      // briefly missing the second factor. The audit log will still
      // record the admin's actions either way.
    } catch {
      /* fail-open intentionally */
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|landing/|preview-|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|mjs|css|woff|woff2|ttf|otf|map|ico|html)$).*)',
  ],
}
