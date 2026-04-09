'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Clock, CreditCard, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface BookingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isLoading: boolean
  teacher: {
    name: string
    avatarUrl: string | null
  }
  date: Date
  startTime: string // ISO string
  durationMinutes: number
  price: number // in kopeks
}

function formatTimeUTC(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

function formatPrice(kopeks: number): string {
  return `${Math.round(kopeks / 100)} ₽`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function BookingModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  teacher,
  date,
  startTime,
  durationMinutes,
  price,
}: BookingModalProps) {
  const endMinutes =
    new Date(startTime).getUTCHours() * 60 +
    new Date(startTime).getUTCMinutes() +
    durationMinutes
  const endHours = Math.floor(endMinutes / 60)
  const endMins = endMinutes % 60
  const endTimeStr = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Подтверждение бронирования</DialogTitle>
          <DialogDescription>
            Проверьте данные урока перед оплатой
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Teacher info */}
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              {teacher.avatarUrl ? (
                <AvatarImage src={teacher.avatarUrl} alt={teacher.name} />
              ) : null}
              <AvatarFallback>{getInitials(teacher.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{teacher.name}</p>
              <p className="text-xs text-muted-foreground">Преподаватель</p>
            </div>
          </div>

          {/* Booking details */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="size-4 text-[#722F37]" />
              <span className="text-muted-foreground">Дата:</span>
              <span className="font-medium">
                {format(date, 'd MMMM yyyy, EEEE', { locale: ru })}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-[#722F37]" />
              <span className="text-muted-foreground">Время:</span>
              <span className="font-medium">
                {formatTimeUTC(startTime)} &mdash; {endTimeStr} (UTC)
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-[#722F37]" />
              <span className="text-muted-foreground">Длительность:</span>
              <Badge variant="secondary">{durationMinutes} мин</Badge>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4 text-[#722F37]" />
              <span className="text-muted-foreground">Стоимость:</span>
              <span className="text-base font-semibold text-[#722F37]">
                {formatPrice(price)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Отмена
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-[#722F37] text-white hover:bg-[#722F37]/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Бронирование...
              </>
            ) : (
              `Оплатить ${formatPrice(price)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
