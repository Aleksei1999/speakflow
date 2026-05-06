import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { readRoleCookie, writeRoleCookie, clearRoleCookie } from '@/lib/auth/role-cache'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    // Try the signed cookie first — typical hot path on every navigation.
    // `undefined` means cache miss / invalid / expired — fall back to DB.
    const cached = await readRoleCookie(request, user.id)

    if (cached !== undefined) {
      role = cached
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      role = profile?.role ?? null

      // Best-effort write; silently no-ops if RW_ROLE_COOKIE_SECRET is missing.
      await writeRoleCookie(supabaseResponse, user.id, role)
    }
  } else {
    // No user → make sure we don't carry a stale role cookie around.
    clearRoleCookie(supabaseResponse)
  }

  // Public (non-httpOnly) flag cookie so the static landing can read auth
  // state on the client BEFORE React hydration / before the slow
  // `useUser()` Supabase round-trip resolves. Format: "<role>" (e.g.
  // "student" / "teacher" / "admin") for authed users, or absent.
  // This cookie is NOT a security boundary — actual auth still goes through
  // Supabase. It's purely a render hint.
  if (user) {
    supabaseResponse.cookies.set('rwen_authed', role ?? 'student', {
      httpOnly: false,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7d; refreshed on every middleware pass
    })
  } else {
    // Clear the flag so logged-out users don't see a stale "Личный кабинет".
    supabaseResponse.cookies.set('rwen_authed', '', {
      httpOnly: false,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 0,
    })
  }

  return { user, role, supabaseResponse }
}
