// @ts-nocheck
import { redirect } from 'next/navigation'
import {
  format,
  subMonths,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Users,
  GraduationCap,
  BookOpen,
  TrendingUp,
  DollarSign,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { StatsCard } from '@/components/dashboard/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AdminChartsClient } from './admin-charts-client'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatCurrency(kopecks: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(kopecks / 100)
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/student')

  const admin = createAdminClient()
  const now = new Date()

  // ---- KPI Data ----

  // Total users
  const { count: totalUsers } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  // Active students
  const { count: activeStudents } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'student')
    .eq('is_active', true)

  // Active teachers
  const { count: activeTeachers } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'teacher')
    .eq('is_active', true)

  // Monthly revenue
  const monthStart = startOfMonth(now).toISOString()
  const monthEnd = endOfMonth(now).toISOString()

  const { data: monthPayments } = await admin
    .from('payments')
    .select('amount')
    .eq('status', 'succeeded')
    .gte('paid_at', monthStart)
    .lte('paid_at', monthEnd)

  const monthlyRevenue =
    monthPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0

  // Lessons this month
  const { count: lessonsThisMonth } = await admin
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .in('status', ['completed', 'booked', 'in_progress'])
    .gte('scheduled_at', monthStart)
    .lte('scheduled_at', monthEnd)

  // ---- Revenue trend (last 12 months) ----
  const revenueTrend: { month: string; revenue: number }[] = []
  for (let i = 11; i >= 0; i--) {
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

    revenueTrend.push({
      month: format(monthDate, 'LLL yy', { locale: ru }),
      revenue: Math.round(total / 100),
    })
  }

  // ---- New users trend (last 12 months) ----
  const usersTrend: { month: string; count: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(now, i)
    const mStart = startOfMonth(monthDate).toISOString()
    const mEnd = endOfMonth(monthDate).toISOString()

    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', mStart)
      .lte('created_at', mEnd)

    usersTrend.push({
      month: format(monthDate, 'LLL yy', { locale: ru }),
      count: count ?? 0,
    })
  }

  // ---- Lessons per day (last 30 days) ----
  const lessonsTrend: { date: string; count: number }[] = []
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

    lessonsTrend.push({
      date: format(dayDate, 'd MMM', { locale: ru }),
      count: count ?? 0,
    })
  }

  // ---- Recent activity (last 10 events) ----
  type ActivityEvent = {
    id: string
    type: 'registration' | 'payment' | 'lesson'
    description: string
    date: string
    userName: string
  }

  const recentActivity: ActivityEvent[] = []

  // Recent registrations
  const { data: recentUsers } = await admin
    .from('profiles')
    .select('id, full_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  for (const u of recentUsers ?? []) {
    const roleLabel =
      u.role === 'student'
        ? 'ученик'
        : u.role === 'teacher'
          ? 'преподаватель'
          : 'админ'
    recentActivity.push({
      id: `reg-${u.id}`,
      type: 'registration',
      description: `Регистрация (${roleLabel})`,
      date: u.created_at,
      userName: u.full_name,
    })
  }

  // Recent payments
  const { data: recentPayments } = await admin
    .from('payments')
    .select('id, amount, status, created_at, student_id')
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(5)

  for (const p of recentPayments ?? []) {
    const { data: pUser } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', p.student_id)
      .single()

    recentActivity.push({
      id: `pay-${p.id}`,
      type: 'payment',
      description: `Оплата ${formatCurrency(p.amount)}`,
      date: p.created_at,
      userName: pUser?.full_name ?? 'Неизвестный',
    })
  }

  // Recent completed lessons
  const { data: recentLessons } = await admin
    .from('lessons')
    .select('id, status, scheduled_at, student_id')
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(5)

  for (const l of recentLessons ?? []) {
    const { data: lUser } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', l.student_id)
      .single()

    recentActivity.push({
      id: `les-${l.id}`,
      type: 'lesson',
      description: 'Урок завершён',
      date: l.scheduled_at,
      userName: lUser?.full_name ?? 'Неизвестный',
    })
  }

  // Sort by date descending and take 10
  recentActivity.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const topActivity = recentActivity.slice(0, 10)

  const eventTypeColors: Record<string, string> = {
    registration: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    payment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    lesson: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  }

  const eventTypeLabels: Record<string, string> = {
    registration: 'Регистрация',
    payment: 'Оплата',
    lesson: 'Урок',
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Панель администратора
        </h1>
        <p className="text-sm text-muted-foreground">
          Обзор платформы SpeakFlow
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Всего пользователей"
          value={totalUsers ?? 0}
          icon={<Users className="size-5" />}
        />
        <StatsCard
          title="Активных учеников"
          value={activeStudents ?? 0}
          icon={<GraduationCap className="size-5" />}
        />
        <StatsCard
          title="Активных преподавателей"
          value={activeTeachers ?? 0}
          icon={<BookOpen className="size-5" />}
        />
        <StatsCard
          title="Выручка за месяц"
          value={formatCurrency(monthlyRevenue)}
          icon={<DollarSign className="size-5" />}
        />
        <StatsCard
          title="Уроков за месяц"
          value={lessonsThisMonth ?? 0}
          icon={<TrendingUp className="size-5" />}
        />
      </div>

      {/* Charts */}
      <AdminChartsClient
        revenueTrend={revenueTrend}
        usersTrend={usersTrend}
        lessonsTrend={lessonsTrend}
      />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Последняя активность</CardTitle>
        </CardHeader>
        <CardContent>
          {topActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Нет активности
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {topActivity.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <Avatar size="sm">
                    <AvatarFallback>
                      {getInitials(event.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{event.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={eventTypeColors[event.type]}
                    >
                      {eventTypeLabels[event.type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.date), 'd MMM HH:mm', {
                        locale: ru,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
