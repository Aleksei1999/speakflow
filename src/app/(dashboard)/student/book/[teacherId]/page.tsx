// @ts-nocheck
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookingCalendar } from '@/components/booking/calendar'
import { TimeSlotsGrid } from '@/components/booking/time-slots'
import { BookingModal } from '@/components/booking/booking-modal'
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Timer,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface TimeSlot {
  startTime: string
  endTime: string
  available: boolean
}

interface SlotsResponse {
  slots: Record<number, TimeSlot[]> | TimeSlot[]
  teacherRate: number
  trialRate: number | null
}

interface TeacherInfo {
  userId: string
  name: string
  avatarUrl: string | null
  availableDays: number[]
}

type BookingStep = 'date' | 'time' | 'duration' | 'confirm'

const DURATION_OPTIONS = [
  { value: 25, label: '25 мин', description: 'Короткий урок' },
  { value: 50, label: '50 мин', description: 'Стандартный урок' },
] as const

function formatPrice(kopeks: number): string {
  return `${Math.round(kopeks / 100)} ₽`
}

function formatTimeUTC(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

export default function BookTeacherPage() {
  const params = useParams()
  const router = useRouter()
  const teacherId = params.teacherId as string

  // Teacher info
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null)
  const [teacherLoading, setTeacherLoading] = useState(true)
  const [teacherError, setTeacherError] = useState<string | null>(null)

  // Booking state
  const [step, setStep] = useState<BookingStep>('date')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<25 | 50>(50)

  // Slots
  const [slotsData, setSlotsData] = useState<SlotsResponse | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)

  // Booking
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Load teacher info
  useEffect(() => {
    async function loadTeacher() {
      setTeacherLoading(true)
      setTeacherError(null)

      try {
        const supabase = createClient()

        // Fetch teacher profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', teacherId)
          .eq('role', 'teacher')
          .single()

        if (profileError || !profile) {
          setTeacherError('Преподаватель не найден')
          return
        }

        // Fetch availability days
        const { data: availability, error: availError } = await supabase
          .from('teacher_availability')
          .select('day_of_week')
          .eq('teacher_id', teacherId)
          .eq('is_available', true)

        if (availError) {
          setTeacherError('Ошибка загрузки расписания')
          return
        }

        const availableDays = [
          ...new Set((availability || []).map((a) => a.day_of_week)),
        ]

        setTeacher({
          userId: profile.id,
          name: profile.full_name,
          avatarUrl: profile.avatar_url,
          availableDays,
        })
      } catch {
        setTeacherError('Непредвиденная ошибка')
      } finally {
        setTeacherLoading(false)
      }
    }

    if (teacherId) {
      loadTeacher()
    }
  }, [teacherId])

  // Load slots when date changes
  const loadSlots = useCallback(async (date: Date) => {
    setSlotsLoading(true)
    setSlotsError(null)
    setSlotsData(null)

    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const response = await fetch(
        `/api/booking/slots?teacherId=${teacherId}&date=${dateStr}`
      )

      if (!response.ok) {
        const data = await response.json()
        setSlotsError(data.error || 'Ошибка загрузки слотов')
        return
      }

      const data: SlotsResponse = await response.json()
      setSlotsData(data)
    } catch {
      setSlotsError('Ошибка соединения с сервером')
    } finally {
      setSlotsLoading(false)
    }
  }, [teacherId])

  // Handle date selection
  function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date)
    setSelectedSlot(null)
    setBookingError(null)

    if (date) {
      setStep('time')
      loadSlots(date)
    } else {
      setStep('date')
      setSlotsData(null)
    }
  }

  // Handle slot selection
  function handleSlotSelect(startTime: string) {
    setSelectedSlot(startTime)
    setBookingError(null)
    setStep('duration')
  }

  // Handle duration selection
  function handleDurationSelect(duration: 25 | 50) {
    setSelectedDuration(duration)
    setBookingError(null)
    setStep('confirm')
  }

  // Get current slots for selected duration
  function getCurrentSlots(): TimeSlot[] {
    if (!slotsData) return []

    if (Array.isArray(slotsData.slots)) {
      return slotsData.slots
    }

    return slotsData.slots[selectedDuration] || []
  }

  // Calculate price
  function calculatePrice(): number {
    if (!slotsData) return 0

    // Check if trial rate applies (we don't know from client, so show regular rate)
    const hourlyRate = slotsData.teacherRate
    return Math.round((hourlyRate * selectedDuration) / 60)
  }

  // Handle booking confirmation
  async function handleConfirmBooking() {
    if (!selectedSlot || !selectedDate) return

    setBookingLoading(true)
    setBookingError(null)

    try {
      const response = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          scheduledAt: selectedSlot,
          durationMinutes: String(selectedDuration),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setBookingError(data.error || 'Ошибка бронирования')
        setShowConfirmModal(false)

        // If slot is no longer available, reload slots
        if (response.status === 409) {
          setSelectedSlot(null)
          setStep('time')
          if (selectedDate) {
            loadSlots(selectedDate)
          }
        }
        return
      }

      // Redirect to payment page
      router.push(data.redirectUrl)
    } catch {
      setBookingError('Ошибка соединения с сервером')
      setShowConfirmModal(false)
    } finally {
      setBookingLoading(false)
    }
  }

  // Step indicators
  const steps = [
    { key: 'date', label: 'Дата', icon: CalendarDays },
    { key: 'time', label: 'Время', icon: Clock },
    { key: 'duration', label: 'Длительность', icon: Timer },
    { key: 'confirm', label: 'Подтверждение', icon: CheckCircle2 },
  ] as const

  const currentStepIndex = steps.findIndex((s) => s.key === step)

  // Loading state
  if (teacherLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-[#CC3A3A]" />
          <p className="text-sm text-muted-foreground">
            Загрузка информации о преподавателе...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (teacherError || !teacher) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <AlertCircle className="size-10 text-destructive" />
            <p className="font-medium">
              {teacherError || 'Преподаватель не найден'}
            </p>
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 size-4" />
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Бронирование урока</h1>
          <p className="text-sm text-muted-foreground">
            Преподаватель: {teacher.name}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const Icon = s.icon
          const isActive = i === currentStepIndex
          const isCompleted = i < currentStepIndex

          return (
            <div key={s.key} className="flex flex-1 items-center">
              <button
                type="button"
                disabled={i > currentStepIndex}
                onClick={() => {
                  if (i < currentStepIndex) {
                    setStep(s.key)
                    // Reset dependent selections
                    if (s.key === 'date') {
                      setSelectedSlot(null)
                    }
                  }
                }}
                className={cn(
                  'flex w-full flex-col items-center gap-1 rounded-lg p-2 text-xs transition-colors',
                  isActive && 'bg-[#CC3A3A]/10 text-[#CC3A3A]',
                  isCompleted &&
                    'cursor-pointer text-[#CC3A3A] hover:bg-[#CC3A3A]/5',
                  !isActive &&
                    !isCompleted &&
                    'text-muted-foreground/50'
                )}
              >
                <Icon
                  className={cn(
                    'size-4',
                    isActive && 'text-[#CC3A3A]',
                    isCompleted && 'text-[#CC3A3A]'
                  )}
                />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-px w-4 flex-shrink-0',
                    isCompleted ? 'bg-[#CC3A3A]' : 'bg-border'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Error banner */}
      {bookingError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 flex-shrink-0" />
          <span>{bookingError}</span>
        </div>
      )}

      {/* Step 1: Date selection */}
      <Card className={cn(step !== 'date' && currentStepIndex > 0 && 'opacity-60')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-[#CC3A3A]" />
            Выберите дату
          </CardTitle>
          {selectedDate && step !== 'date' && (
            <CardDescription>
              {format(selectedDate, 'd MMMM yyyy, EEEE', { locale: ru })}
            </CardDescription>
          )}
        </CardHeader>
        {(step === 'date' || currentStepIndex >= 0) && (
          <CardContent>
            <BookingCalendar
              availableDays={teacher.availableDays}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
            {teacher.availableDays.length === 0 && (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                У преподавателя нет доступных дней для бронирования
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Step 2: Time slot selection */}
      {currentStepIndex >= 1 && selectedDate && (
        <Card className={cn(step !== 'time' && currentStepIndex > 1 && 'opacity-60')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-[#CC3A3A]" />
              Выберите время
            </CardTitle>
            {selectedSlot && step !== 'time' && (
              <CardDescription>
                {formatTimeUTC(selectedSlot)} (UTC)
              </CardDescription>
            )}
            {slotsError && (
              <p className="text-sm text-destructive">{slotsError}</p>
            )}
          </CardHeader>
          {(step === 'time' || step === 'date') && (
            <CardContent>
              {/* Duration toggle for slot display */}
              <div className="mb-4 flex gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={selectedDuration === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDuration(opt.value)}
                    className={cn(
                      selectedDuration === opt.value &&
                        'bg-[#CC3A3A] text-white hover:bg-[#CC3A3A]/90'
                    )}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              <TimeSlotsGrid
                slots={getCurrentSlots()}
                selectedSlot={selectedSlot}
                onSlotSelect={handleSlotSelect}
                isLoading={slotsLoading}
              />
            </CardContent>
          )}
        </Card>
      )}

      {/* Step 3: Duration confirmation */}
      {currentStepIndex >= 2 && selectedSlot && (
        <Card className={cn(step !== 'duration' && currentStepIndex > 2 && 'opacity-60')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="size-4 text-[#CC3A3A]" />
              Длительность урока
            </CardTitle>
          </CardHeader>
          {(step === 'duration' || step === 'confirm') && (
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {DURATION_OPTIONS.map((opt) => {
                  const price = slotsData
                    ? Math.round(
                        (slotsData.teacherRate * opt.value) / 60
                      )
                    : 0
                  const isSelected = selectedDuration === opt.value

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleDurationSelect(opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border p-4 transition-all',
                        isSelected
                          ? 'border-[#CC3A3A] bg-[#CC3A3A]/10 ring-1 ring-[#CC3A3A]'
                          : 'border-border hover:border-[#CC3A3A]/50 hover:bg-[#CC3A3A]/5'
                      )}
                    >
                      <span
                        className={cn(
                          'text-lg font-semibold',
                          isSelected && 'text-[#CC3A3A]'
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                      <Badge
                        variant={isSelected ? 'default' : 'secondary'}
                        className={cn(
                          isSelected &&
                            'bg-[#CC3A3A] text-white'
                        )}
                      >
                        {formatPrice(price)}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Step 4: Confirmation */}
      {step === 'confirm' && selectedDate && selectedSlot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-[#CC3A3A]" />
              Подтверждение
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Преподаватель</span>
                <span className="font-medium">{teacher.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Дата</span>
                <span className="font-medium">
                  {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Время (UTC)</span>
                <span className="font-medium">
                  {formatTimeUTC(selectedSlot)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Длительность</span>
                <span className="font-medium">{selectedDuration} мин</span>
              </div>
              {/* TEMP: disabled until Yookassa integration is live — a2a0600
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-medium">Стоимость</span>
                  <span className="text-lg font-semibold text-[#CC3A3A]">
                    {formatPrice(calculatePrice())}
                  </span>
                </div>
              </div>
              */}
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-medium">Стоимость</span>
                  <span className="text-lg font-semibold text-[#CC3A3A]">
                    Бесплатно
                  </span>
                </div>
              </div>
            </div>

            <Button
              className="mt-4 w-full bg-[#CC3A3A] text-white hover:bg-[#CC3A3A]/90"
              size="lg"
              onClick={() => setShowConfirmModal(true)}
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Бронирование...
                </>
              ) : (
                // TEMP: disabled until Yookassa integration is live — a2a0600
                // `Оплатить ${formatPrice(calculatePrice())}`
                `Записаться бесплатно`
              )}
            </Button>

            <p className="mt-2 text-center text-xs text-muted-foreground">
              Бесплатная отмена более чем за 24 часа до урока
            </p>
          </CardContent>
        </Card>
      )}

      {/* Confirmation modal */}
      {selectedDate && selectedSlot && (
        <BookingModal
          open={showConfirmModal}
          onOpenChange={setShowConfirmModal}
          onConfirm={handleConfirmBooking}
          isLoading={bookingLoading}
          teacher={{
            name: teacher.name,
            avatarUrl: teacher.avatarUrl,
          }}
          date={selectedDate}
          startTime={selectedSlot}
          durationMinutes={selectedDuration}
          price={calculatePrice()}
        />
      )}
    </div>
  )
}
