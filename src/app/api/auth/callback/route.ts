// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

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

  if (!redirectPath) {
    // Determine the correct dashboard based on the user's profile role
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      redirectPath = profile?.role === 'teacher' ? '/teacher' : '/student'
    } else {
      redirectPath = '/student'
    }
  }

  return NextResponse.redirect(`${origin}${redirectPath}`)
}
