import { z } from 'zod'

// Strong-password policy mirrors the Supabase Dashboard config:
//   Authentication → Auth Providers → Email → Minimum length 10, require
//   letters + digits, require uppercase + lowercase.
// Client-side check is a UX layer — Supabase still re-validates server-side,
// and "Prevent use of leaked passwords" rejects HIBP matches before we
// ever see them. Mirroring the rules here means the user sees a clear
// Russian-language error instead of Supabase's generic English message.
export const PASSWORD_MIN = 10
const PASSWORD_MAX = 72 // bcrypt hard cap; do NOT raise.

const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Минимум ${PASSWORD_MIN} символов`)
  .max(PASSWORD_MAX, `Максимум ${PASSWORD_MAX} символов`)
  .refine((v) => /[a-z]/.test(v), 'Нужна строчная латинская буква')
  .refine((v) => /[A-Z]/.test(v), 'Нужна заглавная латинская буква')
  .refine((v) => /[0-9]/.test(v), 'Нужна хотя бы одна цифра')
export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Пароли не совпадают',
  })

// Допустимые длительности урока: 25/50 (legacy trial/regular), 60/90 (тарифы «час»/«1.5 часа»).
export const bookingSchema = z.object({
  teacherId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.union([
    z.literal(25), z.literal(50), z.literal(60), z.literal(90),
    z.literal('25'), z.literal('50'), z.literal('60'), z.literal('90'),
  ]).transform((v): number => Number(v)),
})

export const teacherBookingSchema = z.object({
  studentId: z.string().uuid('Некорректный ID ученика'),
  scheduledAt: z.string().datetime('Некорректный формат даты'),
  durationMinutes: z.union([
    z.literal(25), z.literal(50), z.literal(60), z.literal(90),
    z.literal('25'), z.literal('50'), z.literal('60'), z.literal('90'),
  ]).transform((v): number => Number(v)),
})
