// @ts-nocheck
'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type LoginValues = z.infer<typeof loginSchema>

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setServerError('Неверный email или пароль')
      return
    }

    // Fetch the user profile to determine the correct dashboard
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setServerError('Не удалось получить данные пользователя')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // If there is a safe redirect path, use it; otherwise route by role
    if (redirectTo && redirectTo.startsWith('/')) {
      router.push(redirectTo)
    } else if (profile?.role === 'teacher') {
      router.push('/teacher')
    } else {
      router.push('/student')
    }

    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Вход в аккаунт</CardTitle>
        <CardDescription>
          Введите свой email и пароль для входа
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="login-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {serverError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="pl-9"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Пароль</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:underline"
              >
                Забыли пароль?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="pl-9"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button
          type="submit"
          form="login-form"
          disabled={isSubmitting}
          className="w-full"
          size="lg"
          style={{ backgroundColor: '#722F37' }}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          Войти
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Нет аккаунта?{' '}
          <Link href="/register" className="font-medium hover:underline" style={{ color: '#722F37' }}>
            Зарегистрироваться
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="size-8 animate-spin" style={{ color: '#722F37' }} /></div>}>
      <LoginPageContent />
    </Suspense>
  )
}
