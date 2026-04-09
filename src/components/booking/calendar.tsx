'use client'

import * as React from 'react'
import { ru } from 'date-fns/locale'
import { addDays, isBefore, startOfDay, isSameDay } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

interface BookingCalendarProps {
  availableDays: number[] // day_of_week values (0=Sunday, 1=Monday, etc.)
  selectedDate: Date | undefined
  onDateSelect: (date: Date | undefined) => void
  className?: string
}

export function BookingCalendar({
  availableDays,
  selectedDate,
  onDateSelect,
  className,
}: BookingCalendarProps) {
  const today = startOfDay(new Date())
  const maxDate = addDays(today, 30)

  const isDateDisabled = (date: Date): boolean => {
    // Disable past dates
    if (isBefore(date, today) && !isSameDay(date, today)) {
      return true
    }

    // Disable dates beyond 30 days
    if (date > maxDate) {
      return true
    }

    // Disable days where teacher has no availability
    const dayOfWeek = date.getDay()
    return !availableDays.includes(dayOfWeek)
  }

  const modifiers = {
    available: (date: Date) => {
      if (isBefore(date, today) && !isSameDay(date, today)) return false
      if (date > maxDate) return false
      return availableDays.includes(date.getDay())
    },
  }

  return (
    <div className={cn('w-full', className)}>
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onDateSelect}
        locale={ru}
        disabled={isDateDisabled}
        modifiers={modifiers}
        modifiersClassNames={{
          available:
            'relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-[#722F37]',
        }}
        fromDate={today}
        toDate={maxDate}
        className="mx-auto"
      />
    </div>
  )
}
