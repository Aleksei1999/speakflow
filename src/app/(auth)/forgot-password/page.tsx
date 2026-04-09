'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const forgotPasswordSchema = z.object({
  email: z.string().email('Введите корректный email'),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    })

    if (error) {
      setServerError('Не удалось отправить письмо. Попробуйте позже.')
      return
    }

    // Always show success to prevent email enumeration
    setIsSuccess(true)
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Письмо отправлено</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <CheckCircle2 className="size-12" style={{ color: '#722F37' }} />
          <p className="text-center text-sm text-muted-foreground">
            Ссылка для сброса пароля отправлена на email. Проверьте почту и
            следуйте инструкциям в письме.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full" size="lg">
              <ArrowLeft />
              Вернуться ко входу
            </Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Сброс пароля</CardTitle>
        <CardDescription>
          Введите email, привязанный к вашему аккаунту. Мы отправим ссылку для
          сброса пароля.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="forgot-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button
          type="submit"
          form="forgot-form"
          disabled={isSubmitting}
          className="w-full"
          size="lg"
          style={{ backgroundColor: '#722F37' }}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          Отправить ссылку
        </Button>
        <Link
          href="/login"
          className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-3" />
          Вернуться ко входу
        </Link>
      </CardFooter>
    </Card>
  )
}
