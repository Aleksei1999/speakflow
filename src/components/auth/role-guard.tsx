'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'

interface RoleGuardProps {
  allowedRoles: Array<'student' | 'teacher' | 'admin'>
  children: React.ReactNode
  /** Path to redirect to when the user is not authenticated. Defaults to "/login". */
  loginPath?: string
  /** Path to redirect to when the user's role is not allowed. Defaults to role-based dashboard. */
  unauthorizedPath?: string
}

export function RoleGuard({
  allowedRoles,
  children,
  loginPath = '/login',
  unauthorizedPath,
}: RoleGuardProps) {
  const { user, role, isLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.replace(loginPath)
      return
    }

    if (role && !allowedRoles.includes(role as 'student' | 'teacher' | 'admin')) {
      // Redirect to the user's own dashboard or a custom path
      const fallback = unauthorizedPath ?? (role === 'teacher' ? '/teacher' : '/student')
      router.replace(fallback)
    }
  }, [user, role, isLoading, allowedRoles, router, loginPath, unauthorizedPath])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent"
            style={{ color: '#CC3A3A' }}
          />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  // While redirecting, render nothing to avoid a flash of unauthorized content
  if (!user) return null
  if (role && !allowedRoles.includes(role as 'student' | 'teacher' | 'admin')) return null

  return <>{children}</>
}
