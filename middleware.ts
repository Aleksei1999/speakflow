import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const publicRoutes = ['/', '/teachers', '/level-test', '/login', '/register', '/forgot-password']
const authRoutes = ['/login', '/register', '/forgot-password']

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)
  const path = request.nextUrl.pathname

  if (publicRoutes.some(route => path === route || path.startsWith('/api/'))) {
    return supabaseResponse
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  if (authRoutes.some(route => path === route)) {
    const url = request.nextUrl.clone()
    url.pathname = '/student'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
