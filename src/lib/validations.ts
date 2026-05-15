import { z } from 'zod'

// Strong-password policy mirrors the Supabase Dashboard config:
//   Authentication → Auth Providers → Email → Minimum length 10, require
//   letters + digits, require uppercase + lowercase.
// Client-side check is a UX layer — Supabase still re-validates server-side,
// and "Prevent use of leaked passwords" rejects HIBP matches before we
// ever see them. Mirroring the rules here means the user sees a clear
// Russian-language error instead of Supabase's generic English message.
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 72 // bcrypt hard cap; do NOT raise.

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Минимум ${PASSWORD_MIN} символов`)
  .max(PASSWORD_MAX, `Максимум ${PASSWORD_MAX} символов`)
  .refine((v) => /[a-z]/.test(v), 'Нужна строчная латинская буква')
  .refine((v) => /[A-Z]/.test(v), 'Нужна заглавная латинская буква')
  .refine((v) => /[0-9]/.test(v), 'Нужна хотя бы одна цифра')

/**
 * Lightweight runtime check for non-zod call-sites (plain useState forms).
 * Returns the first failing rule, or null on success.
 */
export function validatePasswordStrength(password: string): string | null {
  const result = strongPasswordSchema.safeParse(password)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Слабый пароль'
}

export const registerSchema = z.object({
  firstName: z.string().min(1, 'Введите имя').max(50, 'Максимум 50 символов'),
  lastName: z.string().max(50, 'Максимум 50 символов').optional().or(z.literal('')),
  email: z.string().email('Неверный email'),
  phone: z
    .string()
    .min(1, 'Укажите телефон или Telegram')
    .max(80, 'Слишком длинное значение'),
  password: strongPasswordSchema,
  role: z.enum(['student', 'teacher']).default('student'),
  termsAccepted: z.literal(true, { message: 'Необходимо принять условия' }),
})

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  // Login still accepts ANY non-empty string — legacy passwords created
  // before the policy tightening must remain usable. Strength is enforced
  // only when a new password is *set* (register / reset).
  password: z.string().min(1, 'Введите пароль'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Введите корректный email'),
})

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Пароли не совпадают',
  })

export const teacherProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  specializations: z.array(z.string()).min(1, 'Выберите хотя бы одну специализацию'),
  experienceYears: z.number().min(0).max(50),
  hourlyRate: z.number().min(100, 'Минимальная ставка 100₽').transform(v => v * 100),
  trialRate: z.number().min(0).optional().transform(v => v ? v * 100 : undefined),
  languages: z.array(z.string()).min(1),
  education: z.string().optional(),
  certificates: z.array(z.string()).optional(),
})

export const bookingSchema = z.object({
  teacherId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.enum(['25', '50']).transform(Number),
})

export const teacherBookingSchema = z.object({
  studentId: z.string().uuid('Некорректный ID ученика'),
  scheduledAt: z.string().datetime('Некорректный формат даты'),
  durationMinutes: z.union([z.literal(25), z.literal(50), z.literal('25'), z.literal('50')]).transform(v => Number(v)),
})

export const levelTestSubmitSchema = z.object({
  answers: z.record(z.string(), z.string()),
  email: z.string().email().optional(),
})

export const lessonSummaryInputSchema = z.object({
  lessonId: z.string().uuid(),
  teacherInput: z.string().min(10, 'Минимум 10 символов заметок'),
  vocabulary: z.array(z.string()).optional(),
  grammarPoints: z.array(z.string()).optional(),
  homework: z.string().optional(),
})

export const reviewSchema = z.object({
  lessonId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

export const createPaymentSchema = z.object({
  lessonId: z.string().uuid('Некорректный ID урока'),
})

export const jitsiTokenSchema = z.object({
  lessonId: z.string().uuid('Некорректный ID урока'),
})

export const leaderboardQuerySchema = z.object({
  period: z.enum(['weekly', 'monthly', 'all_time']).default('weekly'),
  level: z
    .enum(['Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'])
    .optional(),
  friends_only: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const coursesListQuerySchema = z.object({
  goal: z.enum(['work', 'relocation', 'conversation', 'exam', 'other']).optional(),
  level: z
    .enum(['Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const clubsListQuerySchema = z.object({
  category: z
    .enum([
      'speaking', 'business', 'movies', 'debate', 'wine',
      'career', 'community', 'storytelling', 'smalltalk', 'other',
    ])
    .optional(),
  format: z.enum(['online', 'offline']).optional(),
  level: z
    .enum(['Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'])
    .optional(),
  scope: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
