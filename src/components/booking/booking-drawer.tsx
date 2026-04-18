'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Star,
  Timer,
  UserCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar } from '@/components/ui/calendar'
import { useLessonsRealtime } from '@/hooks/use-lessons-realtime'

interface BookingDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  onBooked?: () => void
}

type Step = 'teacher' | 'details'

interface TeacherOption {
  teacherProfileId: string
  userId: string
  name: string
  avatarUrl: string | null
  hourlyRate: number
  trialRate: number | null
  rating: number | null
}

interface TimeSlot {
  startTime: string
  endTime: string
  available: boolean
}

interface SlotsResponse {
  slots: TimeSlot[] | Record<number, TimeSlot[]>
  teacherRate: number
  trialRate: number | null
}

type Duration = 25 | 50

function formatPrice(kopeks: number): string {
  return `${Math.ceil(kopeks / 100)} ₽`
}

function formatTimeUTC(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function BookingDrawer({
  open,
  onOpenChange,
  initialDate,
  onBooked,
}: BookingDrawerProps) {
  const [step, setStep] = useState<Step>('teacher')
  const [search, setSearch] = useState('')

  // Teachers
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherOption | null>(
    null
  )

  // Date / duration / slot
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialDate ?? new Date()
  )
  const [duration, setDuration] = useState<Duration>(50)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  // Slots
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [teacherRate, setTeacherRate] = useState(0)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Booking
  const [bookingLoading, setBookingLoading] = useState(false)

  // Reset when drawer closes
  useEffect(() => {
    if (!open) {
      // Delay so that close animation doesn't flicker content
      const t = setTimeout(() => {
        setStep('teacher')
        setSelectedTeacher(null)
        setSelectedSlot(null)
        setSearch('')
        setSlots([])
      }, 200)
      return () => clearTimeout(t)
    }
  }, [open])

  // Sync initialDate from parent
  useEffect(() => {
    if (open && initialDate) {
      setSelectedDate(initialDate)
    }
  }, [open, initialDate])

  // Load teachers list
  useEffect(() => {
    if (!open || step !== 'teacher') return
    let cancelled = false

    async function loadTeachers() {
      setTeachersLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('teacher_profiles')
        .select(
          'id, user_id, hourly_rate, trial_rate, rating, profiles:profiles!teacher_profiles_user_id_fkey(full_name, avatar_url)'
        )
        .eq('is_listed', true)

      if (cancelled) return

      if (error) {
        toast.error('Не удалось загрузить преподавателей')
        setTeachersLoading(false)
        return
      }

      const list: TeacherOption[] = ((data as any[]) ?? []).map((row) => ({
        teacherProfileId: row.id,
        userId: row.user_id,
        name: row.profiles?.full_name ?? 'Преподаватель',
        avatarUrl: row.profiles?.avatar_url ?? null,
        hourlyRate: row.hourly_rate ?? 0,
        trialRate: row.trial_rate ?? null,
        rating: row.rating ?? null,
      }))

      setTeachers(list)
      setTeachersLoading(false)
    }

    loadTeachers()
    return () => {
      cancelled = true
    }
  }, [open, step])

  // Load slots when teacher / date / duration change
  const loadSlots = useCallback(
    async (teacherUserId: string, date: Date, dur: Duration) => {
      setSlotsLoading(true)
      setSlots([])
      setSelectedSlot(null)
      try {
        const dateStr = format(date, 'yyyy-MM-dd')
        const res = await fetch(
          `/api/booking/slots?teacherId=${teacherUserId}&date=${dateStr}&duration=${dur}`
        )
        const data = await res.json()

        if (!res.ok) {
          toast.error(data?.error ?? 'Ошибка загрузки слотов')
          setSlots([])
          return
        }

        const payload = data as SlotsResponse
        const list = Array.isArray(payload.slots)
          ? payload.slots
          : (payload.slots?.[dur] ?? [])

        setSlots(list)
        setTeacherRate(payload.teacherRate ?? 0)
      } catch {
        toast.error('Ошибка соединения с сервером')
      } finally {
        setSlotsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (step !== 'details' || !selectedTeacher) return
    loadSlots(selectedTeacher.userId, selectedDate, duration)
  }, [step, selectedTeacher, selectedDate, duration, loadSlots])

  // Realtime: if the selected teacher gets a new booking/cancellation while
  // the drawer is open, reload slots for the currently viewed date so the
  // student doesn't click a slot that just got taken.
  useLessonsRealtime({
    teacherId: selectedTeacher?.teacherProfileId ?? null,
    enabled: open && step === 'details' && !!selectedTeacher,
    onChange: () => {
      if (selectedTeacher) {
        loadSlots(selectedTeacher.userId, selectedDate, duration)
      }
    },
  })

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter((t) => t.name.toLowerCase().includes(q))
  }, [teachers, search])

  const price = useMemo(() => {
    const hourly = teacherRate || selectedTeacher?.hourlyRate || 0
    return Math.round((hourly * duration) / 60)
  }, [teacherRate, duration, selectedTeacher])

  async function handleConfirm() {
    if (!selectedTeacher || !selectedSlot) return
    setBookingLoading(true)
    try {
      const res = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: selectedTeacher.userId,
          scheduledAt: selectedSlot,
          durationMinutes: String(duration),
        }),
      })

      const data = await res.json()

      if (res.status === 409) {
        toast.error('Слот только что занят, выберите другой')
        // Refresh slots
        loadSlots(selectedTeacher.userId, selectedDate, duration)
        setBookingLoading(false)
        return
      }

      if (!res.ok) {
        toast.error(data?.error ?? 'Ошибка бронирования')
        setBookingLoading(false)
        return
      }

      onBooked?.()
      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl
      }
    } catch {
      toast.error('Ошибка соединения с сервером')
      setBookingLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2">
            {step === 'details' && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setStep('teacher')
                  setSelectedSlot(null)
                }}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <div>
              <SheetTitle>Забронировать урок</SheetTitle>
              <SheetDescription>
                {step === 'teacher'
                  ? 'Выберите преподавателя'
                  : selectedTeacher?.name ?? ''}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 'teacher' && (
            <TeacherStep
              teachers={filteredTeachers}
              loading={teachersLoading}
              search={search}
              onSearchChange={setSearch}
              onSelect={(t) => {
                setSelectedTeacher(t)
                setStep('details')
              }}
            />
          )}

          {step === 'details' && selectedTeacher && (
            <DetailsStep
              teacher={selectedTeacher}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              duration={duration}
              onDurationChange={setDuration}
              slots={slots}
              slotsLoading={slotsLoading}
              selectedSlot={selectedSlot}
              onSlotSelect={setSelectedSlot}
              price={price}
            />
          )}
        </div>

        {step === 'details' && selectedSlot && (
          <div className="border-t p-4">
            <div className="mb-3 flex flex-col gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <UserCircle2 className="size-3.5" />
                  Преподаватель
                </span>
                <span className="font-medium">{selectedTeacher?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  Дата
                </span>
                <span className="font-medium">
                  {format(selectedDate, 'd MMMM', { locale: ru })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" />
                  Время
                </span>
                <span className="font-medium">
                  {formatTimeUTC(selectedSlot)} UTC · {duration} мин
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2 mt-1">
                <span className="text-muted-foreground">Стоимость</span>
                <span className="text-base font-semibold text-[#CC3A3A]">
                  {formatPrice(price)}
                </span>
              </div>
            </div>

            <Button
              className="w-full bg-[#CC3A3A] text-white hover:bg-[#CC3A3A]/90"
              size="lg"
              onClick={handleConfirm}
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Бронирование...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" />
                  Забронировать и оплатить
                </>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// --- Teacher step ---

interface TeacherStepProps {
  teachers: TeacherOption[]
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  onSelect: (t: TeacherOption) => void
}

function TeacherStep({
  teachers,
  loading,
  search,
  onSearchChange,
  onSelect,
}: TeacherStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по имени"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-[#CC3A3A]" />
        </div>
      ) : teachers.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Преподаватели не найдены
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {teachers.map((t) => (
            <button
              key={t.teacherProfileId}
              type="button"
              onClick={() => onSelect(t)}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-[#CC3A3A]/50 hover:bg-[#CC3A3A]/5"
            >
              <Avatar>
                {t.avatarUrl ? (
                  <AvatarImage src={t.avatarUrl} alt={t.name} />
                ) : null}
                <AvatarFallback>{getInitials(t.name)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="text-sm font-medium">{t.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {t.rating != null && (
                    <span className="flex items-center gap-0.5">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {t.rating.toFixed(1)}
                    </span>
                  )}
                  <span>
                    {formatPrice(Math.round(t.hourlyRate / 2))} / 30 мин
                  </span>
                </div>
              </div>
              <Badge variant="secondary">
                {formatPrice(t.hourlyRate)} / час
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Details step ---

interface DetailsStepProps {
  teacher: TeacherOption
  selectedDate: Date
  onDateChange: (d: Date) => void
  duration: Duration
  onDurationChange: (d: Duration) => void
  slots: TimeSlot[]
  slotsLoading: boolean
  selectedSlot: string | null
  onSlotSelect: (s: string) => void
  price: number
}

function DetailsStep({
  teacher,
  selectedDate,
  onDateChange,
  duration,
  onDurationChange,
  slots,
  slotsLoading,
  selectedSlot,
  onSlotSelect,
  price,
}: DetailsStepProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const availableCount = slots.filter((s) => s.available).length

  return (
    <div className="flex flex-col gap-5">
      {/* Teacher summary */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <Avatar>
          {teacher.avatarUrl ? (
            <AvatarImage src={teacher.avatarUrl} alt={teacher.name} />
          ) : null}
          <AvatarFallback>{getInitials(teacher.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm font-medium">{teacher.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatPrice(teacher.hourlyRate)} / час
          </p>
        </div>
      </div>

      {/* Duration */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Timer className="size-4 text-[#CC3A3A]" />
          Длительность
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([25, 50] as Duration[]).map((d) => {
            const isActive = duration === d
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDurationChange(d)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-[#CC3A3A] bg-[#CC3A3A]/10 text-[#CC3A3A] ring-1 ring-[#CC3A3A]'
                    : 'border-border bg-card hover:border-[#CC3A3A]/50'
                )}
              >
                {d} мин
              </button>
            )
          })}
        </div>
      </div>

      {/* Date */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <CalendarDays className="size-4 text-[#CC3A3A]" />
          Дата
        </p>
        <div className="rounded-lg border p-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && onDateChange(d)}
            disabled={(d) => d < today}
            locale={ru}
            className="mx-auto"
          />
        </div>
      </div>

      {/* Slots */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Clock className="size-4 text-[#CC3A3A]" />
            Время (UTC)
          </p>
          {!slotsLoading && slots.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Доступно {availableCount} из {slots.length}
            </span>
          )}
        </div>

        {slotsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Нет слотов на выбранную дату
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot.startTime
              return (
                <button
                  key={slot.startTime}
                  type="button"
                  disabled={!slot.available}
                  title={!slot.available ? 'Занято' : undefined}
                  onClick={() => onSlotSelect(slot.startTime)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-sm font-medium transition-colors',
                    slot.available &&
                      !isSelected &&
                      'border-border bg-card hover:border-[#CC3A3A]/50 hover:bg-[#CC3A3A]/5',
                    isSelected &&
                      'border-[#CC3A3A] bg-[#CC3A3A]/10 text-[#CC3A3A] ring-1 ring-[#CC3A3A]',
                    !slot.available &&
                      'cursor-not-allowed border-border/50 bg-muted/50 text-muted-foreground/50 line-through'
                  )}
                >
                  {formatTimeUTC(slot.startTime)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedSlot && (
        <div className="flex items-center justify-between rounded-lg border bg-[#CC3A3A]/5 p-3 text-sm">
          <span className="text-muted-foreground">Итого</span>
          <span className="text-base font-semibold text-[#CC3A3A]">
            {formatPrice(price)}
          </span>
        </div>
      )}
    </div>
  )
}
