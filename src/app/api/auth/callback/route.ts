// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // Validate redirect target to prevent open redirect attacks.
  // Only allow relative paths starting with "/" and reject protocol-relative URLs.
  let redirectPath = '/student'
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    redirectPath = next
  }

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

    if (profile?.role === 'teacher') {
      redirectPath = next ?? '/teacher'
    } else {
      redirectPath = next ?? '/student'
    }
  }

  return NextResponse.redirect(`${origin}${redirectPath}`)
}
