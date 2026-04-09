// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  subMonths,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  format,
} from 'date-fns'

export async function GET(request: NextRequest) {
  // Verify admin role via the authenticated user's session
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const period = searchParams.get('period') ?? 'year'

  const admin = createAdminClient()
  const now = new Date()

  // Determine how many months back to look
  const monthsBack = period === 'month' ? 1 : period === 'quarter' ? 3 : 12

  // --- Revenue by month ---
  const revenueByMonth: { month: string; revenue: number }[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i)
    const mStart = startOfMonth(monthDate).toISOString()
    const mEnd = endOfMonth(monthDate).toISOString()

    const { data: payments } = await admin
      .from('payments')
      .select('amount')
      .eq('status', 'succeeded')
      .gte('paid_at', mStart)
      .lte('paid_at', mEnd)

    const total = payments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0

    revenueByMonth.push({
      month: format(monthDate, 'yyyy-MM'),
      revenue: total,
    })
  }

  // --- New users by month ---
  const usersByMonth: { month: string; count: number }[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i)
    const mStart = startOfMonth(monthDate).toISOString()
    const mEnd = endOfMonth(monthDate).toISOString()

    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', mStart)
      .lte('created_at', mEnd)

    usersByMonth.push({
      month: format(monthDate, 'yyyy-MM'),
      count: count ?? 0,
    })
  }

  // --- Lessons per day (last 30 days) ---
  const lessonsByDay: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const dayDate = subDays(now, i)
    const dStart = startOfDay(dayDate).toISOString()
    const dEnd = endOfDay(dayDate).toISOString()

    const { count } = await admin
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .in('status', ['completed', 'booked', 'in_progress'])
      .gte('scheduled_at', dStart)
      .lte('scheduled_at', dEnd)

    lessonsByDay.push({
      date: format(dayDate, 'yyyy-MM-dd'),
      count: count ?? 0,
    })
  }

  // --- Top teachers by earnings ---
  const { data: topTeachersRaw } = await admin
    .from('teacher_earnings')
    .select('teacher_id, net_amount')
    .eq('status', 'available')

  const teacherTotals: Record<string, number> = {}
  for (const row of topTeachersRaw ?? []) {
    teacherTotals[row.teacher_id] =
      (teacherTotals[row.teacher_id] ?? 0) + row.net_amount
  }

  const topTeacherIds = Object.entries(teacherTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const topTeachers: {
    teacher_id: string
    full_name: string
    earnings: number
  }[] = []

  for (const [teacherId, earnings] of topTeacherIds) {
    const { data: tp } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', teacherId)
      .single()

    topTeachers.push({
      teacher_id: teacherId,
      full_name: tp?.full_name ?? 'Неизвестный',
      earnings,
    })
  }

  return NextResponse.json({
    revenueByMonth,
    usersByMonth,
    lessonsByDay,
    topTeachers,
  })
}
