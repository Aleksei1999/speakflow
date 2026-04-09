'use client'

import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

interface TimeSlot {
  startTime: string
  endTime: string
  available: boolean
}

interface TimeSlotsGridProps {
  slots: TimeSlot[]
  selectedSlot: string | null // startTime of selected slot
  onSlotSelect: (startTime: string) => void
  isLoading: boolean
  className?: string
}

function formatTimeUTC(isoString: string): string {
  const date = new Date(isoString)
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export function TimeSlotsGrid({
  slots,
  selectedSlot,
  onSlotSelect,
  isLoading,
  className,
}: TimeSlotsGridProps) {
  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Clock className="mb-2 size-8 opacity-50" />
        <p className="text-sm">Нет доступных слотов на этот день</p>
        <p className="mt-1 text-xs">Попробуйте выбрать другую дату</p>
      </div>
    )
  }

  const availableSlots = slots.filter((s) => s.available)
  const unavailableSlots = slots.filter((s) => !s.available)

  if (availableSlots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Clock className="mb-2 size-8 opacity-50" />
        <p className="text-sm">Все слоты на этот день заняты</p>
        <p className="mt-1 text-xs">Попробуйте выбрать другую дату</p>
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4', className)}>
      {slots.map((slot) => {
        const isSelected = selectedSlot === slot.startTime
        const isAvailable = slot.available

        return (
          <button
            key={slot.startTime}
            type="button"
            disabled={!isAvailable}
            onClick={() => onSlotSelect(slot.startTime)}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border px-2 py-3 text-sm transition-all',
              isAvailable && !isSelected &&
                'border-border bg-card hover:border-[#722F37]/50 hover:bg-[#722F37]/5 cursor-pointer',
              isSelected &&
                'border-[#722F37] bg-[#722F37]/10 ring-1 ring-[#722F37] cursor-pointer',
              !isAvailable &&
                'cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/50 line-through'
            )}
          >
            <span
              className={cn(
                'font-medium',
                isSelected && 'text-[#722F37]'
              )}
            >
              {formatTimeUTC(slot.startTime)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTimeUTC(slot.endTime)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
