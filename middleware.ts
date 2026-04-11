import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const publicRoutes = ['/', '/teachers', '/level-test', '/get-started']
const authRoutes = ['/login', '/register', '/forgot-password']

function homeForRole(role: string | null): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'teacher': return '/teacher'
    default: return '/student'
  }
}

export async function middleware(request: NextRequest) {
  const { user, role, supabaseResponse } = await updateSession(request)
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

  // Authenticated on auth pages → redirect to their dashboard
  if (authRoutes.some(route => path === route)) {
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

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
