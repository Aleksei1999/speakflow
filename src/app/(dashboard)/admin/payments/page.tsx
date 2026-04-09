// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  ReceiptText,
  DollarSign,
  TrendingDown,
  CreditCard,
  Undo2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RoleGuard } from '@/components/auth/role-guard'
import { StatsCard } from '@/components/dashboard/stats-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const PAGE_SIZE = 20

type PaymentRow = {
  id: string
  lesson_id: string
  student_id: string
  yookassa_payment_id: string | null
  amount: number
  currency: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'cancelled' | 'refunded'
  payment_method: string | null
  paid_at: string | null
  refunded_at: string | null
  created_at: string
  student_name: string
  teacher_name: string
  lesson_date: string | null
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  waiting_for_capture: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  succeeded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
  refunded: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  waiting_for_capture: 'Захват',
  succeeded: 'Оплачен',
  cancelled: 'Отменён',
  refunded: 'Возврат',
}

function formatCurrency(kopecks: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(kopecks / 100)
}

function AdminPaymentsContent() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortField, setSortField] = useState<'created_at' | 'amount'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)

  // Stats
  const [monthRevenue, setMonthRevenue] = useState(0)
  const [avgCheck, setAvgCheck] = useState(0)
  const [platformFee, setPlatformFee] = useState(0)
  const [refundsTotal, setRefundsTotal] = useState(0)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null)

  // Refund dialog
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundLoading, setRefundLoading] = useState(false)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Fetch payments with joined data
    let query = supabase
      .from('payments')
      .select(
        '*, lesson:lessons!payments_lesson_id_fkey(scheduled_at, teacher_id, student_id)',
        { count: 'exact' }
      )

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (dateFrom) {
      query = query.gte('created_at', new Date(dateFrom).toISOString())
    }
    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      query = query.lte('created_at', toDate.toISOString())
    }

    query = query
      .order(sortField, { ascending: sortDir === 'asc' })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data: rawPayments, count, error } = await query

    if (error || !rawPayments) {
      setLoading(false)
      return
    }

    // Gather unique user IDs
    const userIds = new Set<string>()
    for (const p of rawPayments) {
      userIds.add(p.student_id)
      const lesson = p.lesson as any
      if (lesson?.teacher_id) userIds.add(lesson.teacher_id)
    }

    // Fetch profiles for those IDs
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(userIds))

    const profileMap = new Map<string, string>()
    for (const pr of profiles ?? []) {
      profileMap.set(pr.id, pr.full_name)
    }

    const mapped: PaymentRow[] = rawPayments.map((p: any) => {
      const lesson = p.lesson
      return {
        id: p.id,
        lesson_id: p.lesson_id,
        student_id: p.student_id,
        yookassa_payment_id: p.yookassa_payment_id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        payment_method: p.payment_method,
        paid_at: p.paid_at,
        refunded_at: p.refunded_at,
        created_at: p.created_at,
        student_name: profileMap.get(p.student_id) ?? 'Неизвестный',
        teacher_name: lesson?.teacher_id
          ? (profileMap.get(lesson.teacher_id) ?? 'Неизвестный')
          : 'Неизвестный',
        lesson_date: lesson?.scheduled_at ?? null,
      }
    })

    // Filter by search query (client-side name filter)
    let filtered = mapped
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filtered = mapped.filter(
        (p) =>
          p.student_name.toLowerCase().includes(q) ||
          p.teacher_name.toLowerCase().includes(q)
      )
    }

    setPayments(filtered)
    setTotalCount(count ?? 0)
    setLoading(false)
  }, [searchQuery, statusFilter, dateFrom, dateTo, sortField, sortDir, page])

  // Fetch summary stats
  const fetchStats = useCallback(async () => {
    const supabase = createClient()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const { data: monthPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'succeeded')
      .gte('paid_at', monthStart)
      .lte('paid_at', monthEnd)

    const total =
      monthPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0
    const count = monthPayments?.length ?? 0

    setMonthRevenue(total)
    setAvgCheck(count > 0 ? Math.round(total / count) : 0)
    // Platform fee estimated at 15%
    setPlatformFee(Math.round(total * 0.15))

    const { data: refunds } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'refunded')
      .gte('refunded_at', monthStart)
      .lte('refunded_at', monthEnd)

    setRefundsTotal(
      refunds?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0
    )
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    setPage(0)
  }, [searchQuery, statusFilter, dateFrom, dateTo, sortField, sortDir])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handleToggleSort = (field: 'created_at' | 'amount') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const handleRefund = async () => {
    if (!selectedPayment?.yookassa_payment_id) return
    setRefundLoading(true)

    try {
      const res = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: selectedPayment.yookassa_payment_id,
          amount: selectedPayment.amount,
        }),
      })

      if (res.ok) {
        const supabase = createClient()
        await supabase
          .from('payments')
          .update({
            status: 'refunded' as const,
            refunded_at: new Date().toISOString(),
          })
          .eq('id', selectedPayment.id)

        setRefundOpen(false)
        setDetailOpen(false)
        fetchPayments()
        fetchStats()
      }
    } catch {
      // Error handling -- toast would go here
    } finally {
      setRefundLoading(false)
    }
  }

  const exportCSV = () => {
    const headers = [
      'ID',
      'Ученик',
      'Преподаватель',
      'Сумма (руб)',
      'Статус',
      'Метод оплаты',
      'Дата',
    ]
    const rows = payments.map((p) => [
      p.id,
      p.student_name,
      p.teacher_name,
      (p.amount / 100).toFixed(2),
      statusLabels[p.status] ?? p.status,
      p.payment_method ?? '---',
      format(new Date(p.created_at), 'dd.MM.yyyy HH:mm'),
    ])

    const csvContent = [
      headers.join(';'),
      ...rows.map((r) => r.join(';')),
    ].join('\n')

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Управление платежами
          </h1>
          <p className="text-sm text-muted-foreground">
            Просмотр платежей и управление возвратами
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="size-4" />
          Экспорт CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Выручка за месяц"
          value={formatCurrency(monthRevenue)}
          icon={<DollarSign className="size-5" />}
        />
        <StatsCard
          title="Средний чек"
          value={formatCurrency(avgCheck)}
          icon={<ReceiptText className="size-5" />}
        />
        <StatsCard
          title="Комиссия платформы"
          value={formatCurrency(platformFee)}
          description="~15% от выручки"
          icon={<CreditCard className="size-5" />}
        />
        <StatsCard
          title="Возвраты за месяц"
          value={formatCurrency(refundsTotal)}
          icon={<TrendingDown className="size-5" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени ученика/преподавателя..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="pending">Ожидает</SelectItem>
            <SelectItem value="succeeded">Оплачен</SelectItem>
            <SelectItem value="cancelled">Отменён</SelectItem>
            <SelectItem value="refunded">Возврат</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
            placeholder="С"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[150px]"
            placeholder="По"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Ученик</TableHead>
              <TableHead>Преподаватель</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => handleToggleSort('amount')}
                >
                  Сумма
                  {sortField === 'amount' && (
                    <span className="text-xs">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Метод</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => handleToggleSort('created_at')}
                >
                  Дата
                  {sortField === 'created_at' && (
                    <span className="text-xs">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead className="w-12">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div
                      className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      style={{ color: '#722F37' }}
                    />
                    <span className="text-sm text-muted-foreground">
                      Загрузка...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  Платежи не найдены
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {payment.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-medium">
                    {payment.student_name}
                  </TableCell>
                  <TableCell>{payment.teacher_name}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusColors[payment.status]}
                    >
                      {statusLabels[payment.status] ?? payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {payment.payment_method ?? '---'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(payment.created_at), 'd MMM yyyy HH:mm', {
                      locale: ru,
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Действия</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedPayment(payment)
                            setDetailOpen(true)
                          }}
                        >
                          <ReceiptText className="size-4" />
                          Подробности
                        </DropdownMenuItem>
                        {payment.status === 'succeeded' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedPayment(payment)
                                setRefundOpen(true)
                              }}
                            >
                              <Undo2 className="size-4" />
                              Возврат
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Показано {page * PAGE_SIZE + 1}
            {' - '}
            {Math.min((page + 1) * PAGE_SIZE, totalCount)} из {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="size-4" />
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={page >= totalPages - 1}
            >
              Далее
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Payment Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Детали платежа</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">ID платежа</p>
                  <p className="font-mono text-xs">{selectedPayment.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    YooKassa ID
                  </p>
                  <p className="font-mono text-xs">
                    {selectedPayment.yookassa_payment_id ?? '---'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Ученик</p>
                  <p>{selectedPayment.student_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Преподаватель
                  </p>
                  <p>{selectedPayment.teacher_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Сумма</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(selectedPayment.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Статус</p>
                  <Badge
                    variant="secondary"
                    className={statusColors[selectedPayment.status]}
                  >
                    {statusLabels[selectedPayment.status]}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Метод оплаты
                  </p>
                  <p>{selectedPayment.payment_method ?? '---'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Дата урока
                  </p>
                  <p>
                    {selectedPayment.lesson_date
                      ? format(
                          new Date(selectedPayment.lesson_date),
                          'd MMMM yyyy, HH:mm',
                          { locale: ru }
                        )
                      : '---'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Дата создания
                  </p>
                  <p>
                    {format(
                      new Date(selectedPayment.created_at),
                      'd MMMM yyyy, HH:mm',
                      { locale: ru }
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Дата оплаты
                  </p>
                  <p>
                    {selectedPayment.paid_at
                      ? format(
                          new Date(selectedPayment.paid_at),
                          'd MMMM yyyy, HH:mm',
                          { locale: ru }
                        )
                      : '---'}
                  </p>
                </div>
              </div>
              {selectedPayment.refunded_at && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Дата возврата
                  </p>
                  <p>
                    {format(
                      new Date(selectedPayment.refunded_at),
                      'd MMMM yyyy, HH:mm',
                      { locale: ru }
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedPayment?.status === 'succeeded' && (
              <Button
                variant="destructive"
                onClick={() => {
                  setDetailOpen(false)
                  setRefundOpen(true)
                }}
              >
                <Undo2 className="size-4" />
                Оформить возврат
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Подтверждение возврата</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите оформить возврат на сумму{' '}
              <span className="font-bold text-foreground">
                {selectedPayment
                  ? formatCurrency(selectedPayment.amount)
                  : ''}
              </span>{' '}
              для ученика{' '}
              <span className="font-medium text-foreground">
                {selectedPayment?.student_name}
              </span>
              ? Это действие необратимо.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRefundOpen(false)}
              disabled={refundLoading}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={refundLoading}
            >
              {refundLoading ? 'Обработка...' : 'Подтвердить возврат'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminPaymentsPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminPaymentsContent />
    </RoleGuard>
  )
}
