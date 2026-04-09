import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  fullName: z.string().min(2, 'Минимум 2 символа'),
  role: z.enum(['student', 'teacher']),
})

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
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
