// @ts-nocheck
'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AdminChartsClientProps {
  revenueTrend: { month: string; revenue: number }[]
  usersTrend: { month: string; count: number }[]
  lessonsTrend: { date: string; count: number }[]
}

const BRAND_COLOR = '#722F37'
const BRAND_COLOR_LIGHT = 'rgba(114, 47, 55, 0.15)'

function formatRub(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} млн`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} тыс`
  return value.toString()
}

export function AdminChartsClient({
  revenueTrend,
  usersTrend,
  lessonsTrend,
}: AdminChartsClientProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Revenue Trend */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Выручка за 12 месяцев (руб.)</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueTrend.every((d) => d.revenue === 0) ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Нет данных о выручке
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND_COLOR} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={BRAND_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatRub}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                  formatter={(value: number) => [
                    `${value.toLocaleString('ru-RU')} руб.`,
                    'Выручка',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={BRAND_COLOR}
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* New Users Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Новые пользователи</CardTitle>
        </CardHeader>
        <CardContent>
          {usersTrend.every((d) => d.count === 0) ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Нет регистраций
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={usersTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                  formatter={(value: number) => [value, 'Регистрации']}
                />
                <Bar
                  dataKey="count"
                  fill={BRAND_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Lessons per Day */}
      <Card>
        <CardHeader>
          <CardTitle>Уроков в день (30 дней)</CardTitle>
        </CardHeader>
        <CardContent>
          {lessonsTrend.every((d) => d.count === 0) ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Нет данных об уроках
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lessonsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                  formatter={(value: number) => [value, 'Уроков']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={BRAND_COLOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: BRAND_COLOR }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
