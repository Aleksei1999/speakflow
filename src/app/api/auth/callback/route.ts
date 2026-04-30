// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { autoAssignTrial } from '@/lib/trial-lesson/auto-assign'

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

  // Always pull the user once — used for both role routing and trial auto-assign.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!redirectPath) {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      redirectPath =
        profile?.role === 'admin'
          ? '/admin'
          : profile?.role === 'teacher'
            ? '/teacher'
            : '/student'
    } else {
      redirectPath = '/student'
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

  return NextResponse.redirect(`${origin}${redirectPath}`)
}
