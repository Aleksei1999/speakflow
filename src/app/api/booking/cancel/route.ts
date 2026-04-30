// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { notifyLessonCancelled } from '@/lib/notifications/booking'

const cancelSchema = z.object({
  lessonId: z.string().uuid('Некорректный идентификатор урока'),
  reason: z.string().max(500, 'Максимум 500 символов').optional(),
})

const CANCELLATION_POLICY_HOURS = 24

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = cancelSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const { lessonId, reason } = parsed.data

    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Необходимо авторизоваться' },
        { status: 401 }
      )
    }

    // Fetch the lesson
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, student_id, teacher_id, scheduled_at, duration_minutes, status, price')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { error: 'Урок не найден' },
        { status: 404 }
      )
    }

    // Verify user owns this lesson (student or teacher)
    const isStudent = lesson.student_id === user.id
    const isTeacher = lesson.teacher_id === user.id

    if (!isStudent && !isTeacher) {
      return NextResponse.json(
        { error: 'У вас нет прав на отмену этого урока' },
        { status: 403 }
      )
    }

    // Check lesson is in a cancellable status
    const cancellableStatuses = ['pending_payment', 'booked']
    if (!cancellableStatuses.includes(lesson.status)) {
      return NextResponse.json(
        { error: `Нельзя отменить урок со статусом "${lesson.status}"` },
        { status: 400 }
      )
    }

    // Determine refund eligibility based on cancellation policy
    const scheduledAt = new Date(lesson.scheduled_at)
    const now = new Date()
    const hoursUntilLesson =
      (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60)

    const refundEligible = hoursUntilLesson >= CANCELLATION_POLICY_HOURS

    // Update lesson status to cancelled
    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        status: 'cancelled',
        cancelled_by: user.id,
        cancellation_reason: reason || null,
      })
      .eq('id', lessonId)

    if (updateError) {
      console.error('Ошибка отмены урока:', updateError)
      return NextResponse.json(
        { error: 'Ошибка отмены урока' },
        { status: 500 }
      )
    }

    // If payment exists and eligible for refund, mark for refund
    if (refundEligible && lesson.status === 'booked') {
      const { data: payment } = await supabase
        .from('payments')
        .select('id, status')
        .eq('lesson_id', lessonId)
        .eq('status', 'succeeded')
        .single()

      if (payment) {
        await supabase
          .from('payments')
          .update({ status: 'refunded', refunded_at: new Date().toISOString() })
          .eq('id', payment.id)
      }
    }

    void notifyLessonCancelled({
      lessonId,
      cancelledByUserId: user.id,
      reason: reason || null,
    }).catch(() => {})

    // Prepare notification data (actual sending handled by separate module)
    const notificationData = {
      type: 'lesson_cancelled' as const,
      lessonId,
      cancelledBy: user.id,
      cancelledByRole: isStudent ? 'student' : 'teacher',
      recipientId: isStudent ? lesson.teacher_id : lesson.student_id,
      scheduledAt: lesson.scheduled_at,
      reason: reason || null,
      refundEligible,
    }

    // Log notification data for the notification service to pick up
    console.log('Notification prepared:', JSON.stringify(notificationData))

    return NextResponse.json({
      success: true,
      refundEligible,
      message: refundEligible
        ? 'Урок отменён. Возврат средств будет обработан в течение 3-5 рабочих дней.'
        : hoursUntilLesson < CANCELLATION_POLICY_HOURS && lesson.status === 'booked'
          ? `Урок отменён. Возврат не предусмотрен при отмене менее чем за ${CANCELLATION_POLICY_HOURS} часов.`
          : 'Урок отменён.',
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в cancel API:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
