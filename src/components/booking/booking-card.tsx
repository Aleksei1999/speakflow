'use client'

import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  CalendarDays,
  Clock,
  Video,
  XCircle,
  Star,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type LessonStatus =
  | 'pending_payment'
  | 'booked'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

interface BookingCardProps {
  lesson: {
    id: string
    scheduledAt: string
    durationMinutes: number
    status: LessonStatus
    price: number
  }
  counterpart: {
    name: string
    avatarUrl: string | null
    role: 'student' | 'teacher'
  }
  onJoin?: (lessonId: string) => void
  onCancel?: (lessonId: string) => void
  onReview?: (lessonId: string) => void
  isActionLoading?: boolean
  className?: string
}

const STATUS_CONFIG: Record<
  LessonStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  pending_payment: { label: 'Ожидает оплаты', variant: 'outline' },
  booked: { label: 'Забронирован', variant: 'default' },
  in_progress: { label: 'Идёт урок', variant: 'default' },
  completed: { label: 'Завершён', variant: 'secondary' },
  cancelled: { label: 'Отменён', variant: 'destructive' },
  no_show: { label: 'Неявка', variant: 'destructive' },
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatPrice(kopeks: number): string {
  return `${Math.round(kopeks / 100)} ₽`
}

function formatTimeUTC(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

export function BookingCard({
  lesson,
  counterpart,
  onJoin,
  onCancel,
  onReview,
  isActionLoading = false,
  className,
}: BookingCardProps) {
  const statusConfig = STATUS_CONFIG[lesson.status]
  const scheduledDate = new Date(lesson.scheduledAt)
  const now = new Date()

  // Determine if join window is active (5 min before to end of lesson)
  const joinWindowStart = new Date(
    scheduledDate.getTime() - 5 * 60 * 1000
  )
  const lessonEnd = new Date(
    scheduledDate.getTime() + lesson.durationMinutes * 60 * 1000
  )
  const canJoin =
    (lesson.status === 'booked' || lesson.status === 'in_progress') &&
    now >= joinWindowStart &&
    now <= lessonEnd

  const canCancel =
    lesson.status === 'pending_payment' || lesson.status === 'booked'

  const canReview = lesson.status === 'completed'

  const isPast = scheduledDate < now

  return (
    <Card size="sm" className={cn('overflow-hidden', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar>
              {counterpart.avatarUrl ? (
                <AvatarImage
                  src={counterpart.avatarUrl}
                  alt={counterpart.name}
                />
              ) : null}
              <AvatarFallback>
                {getInitials(counterpart.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-sm">{counterpart.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {counterpart.role === 'teacher'
                  ? 'Преподаватель'
                  : 'Студент'}
              </p>
            </div>
          </div>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <span>
              {format(scheduledDate, 'd MMMM yyyy, EEEE', { locale: ru })}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="size-3.5 text-muted-foreground" />
            <span>
              {formatTimeUTC(lesson.scheduledAt)} (UTC) &middot;{' '}
              {lesson.durationMinutes} мин
            </span>
          </div>

          {/* TEMP: disabled until Yookassa integration is live — a2a0600 */}
          {/* <div className="text-sm font-medium text-[#CC3A3A]">
            {formatPrice(lesson.price)}
          </div> */}
          <div className="text-sm font-medium text-[#CC3A3A]">Бесплатно</div>
        </div>
      </CardContent>

      {(canJoin || canCancel || canReview) && (
        <CardFooter className="gap-2">
          {canJoin && onJoin && (
            <Button
              size="sm"
              onClick={() => onJoin(lesson.id)}
              disabled={isActionLoading}
              className="bg-[#CC3A3A] text-white hover:bg-[#CC3A3A]/90"
            >
              {isActionLoading ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Video className="mr-1 size-3.5" />
              )}
              Войти в урок
            </Button>
          )}

          {canCancel && onCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancel(lesson.id)}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <XCircle className="mr-1 size-3.5" />
              )}
              Отменить
            </Button>
          )}

          {canReview && onReview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReview(lesson.id)}
              disabled={isActionLoading}
            >
              <Star className="mr-1 size-3.5" />
              Оставить отзыв
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
