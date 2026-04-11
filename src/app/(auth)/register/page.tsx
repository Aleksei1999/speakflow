'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Lock, User, Loader2, CheckCircle2 } from 'lucide-react'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'
import { registerSchema } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'student',
    },
  })

  async function onSubmit(values: RegisterValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
          role: values.role,
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setServerError('Пользователь с таким email уже зарегистрирован')
      } else if (error.message.includes('rate limit')) {
        setServerError('Слишком много попыток. Подождите несколько минут и попробуйте снова.')
      } else if (error.message.includes('invalid')) {
        setServerError('Проверьте правильность email адреса.')
      } else {
        setServerError(`Не удалось создать аккаунт: ${error.message}`)
      }
      return
    }

    setIsSuccess(true)
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Регистрация завершена</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <CheckCircle2 className="size-12" style={{ color: '#CC3A3A' }} />
          <p className="text-center text-sm text-muted-foreground">
            Проверьте email для подтверждения. Мы отправили вам письмо со ссылкой
            для активации аккаунта.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full" size="lg">
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
        <CardTitle className="text-xl">Создать аккаунт</CardTitle>
        <CardDescription>
          Заполните форму для регистрации на платформе
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="register-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {serverError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Полное имя</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="fullName"
                type="text"
                placeholder="Иван Иванов"
                autoComplete="name"
                className="pl-9"
                aria-invalid={!!errors.fullName}
                {...register('fullName')}
              />
            </div>
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName.message}</p>
            )}
          </div>

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
            <Label htmlFor="password">Пароль</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Минимум 8 символов"
                autoComplete="new-password"
                className="pl-9"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="role">Я хочу</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" aria-invalid={!!errors.role}>
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Учиться (Ученик)</SelectItem>
                    <SelectItem value="teacher">Преподавать (Учитель)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button
          type="submit"
          form="register-form"
          disabled={isSubmitting}
          className="w-full"
          size="lg"
          style={{ backgroundColor: '#CC3A3A' }}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          Зарегистрироваться
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="font-medium hover:underline" style={{ color: '#CC3A3A' }}>
            Войти
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
