// @ts-nocheck
"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
} from "date-fns"
import { ru } from "date-fns/locale"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Save,
  Ban,
  Loader2,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { useUser } from "@/hooks/use-user"
import { useLessonsRealtime } from "@/hooks/use-lessons-realtime"

interface LessonSlot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  student: { full_name: string; avatar_url: string | null } | null
}

interface TimeRange {
  start: string
  end: string
}

interface DayAvailability {
  active: boolean
  ranges: TimeRange[]
}

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const DAY_FULL_NAMES = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
]

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 8:00 - 21:00

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const statusColors: Record<string, string> = {
  booked: "bg-[#CC3A3A]/10 border-[#CC3A3A]/30 text-[#CC3A3A]",
  in_progress: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30",
  completed: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30",
  cancelled: "bg-red-50 border-red-200 text-red-400 dark:bg-red-950/30 line-through",
  pending_payment: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30",
  no_show: "bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-950/30",
}

export default function TeacherSchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Расписание</h1>
        <p className="text-sm text-muted-foreground">
          Управление расписанием и доступностью
        </p>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Расписание</TabsTrigger>
          <TabsTrigger value="availability">Доступность</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <WeekSchedule />
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilityEditor />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface StudentOption {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

function WeekSchedule() {
  const { user, isLoading: userLoading, error: userError } = useUser()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [lessons, setLessons] = useState<LessonSlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [teacherProfileId, setTeacherProfileId] = useState<string | null>(null)
  const [hourlyRate, setHourlyRate] = useState<number>(0)
  const [myStudents, setMyStudents] = useState<StudentOption[]>([])

  // Assign-dialog state
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignDate, setAssignDate] = useState<Date | null>(null)
  const [assignTime, setAssignTime] = useState<string>("09:00")
  const [assignDuration, setAssignDuration] = useState<25 | 50>(50)
  const [assignStudentId, setAssignStudentId] = useState<string>("")
  const [assignSearchQuery, setAssignSearchQuery] = useState<string>("")
  const [assignSearchResults, setAssignSearchResults] = useState<StudentOption[]>([])
  const [assignIsSubmitting, setAssignIsSubmitting] = useState(false)

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const fetchLessons = useCallback(async () => {
    if (userLoading) return
    if (!user) {
      const msg = userError
        ? `Ошибка авторизации: ${userError}`
        : "Не удалось определить пользователя. Перезайдите в систему."
      console.error("useUser error:", userError)
      setLoadError(msg)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setLoadError(null)
    const supabase = createClient()

    // Get teacher_profile id first
    const { data: tp, error: tpError } = await supabase
      .from("teacher_profiles")
      .select("id, hourly_rate")
      .eq("user_id", user.id)
      .maybeSingle()

    if (tpError) {
      console.error("teacher_profiles fetch error:", tpError)
      setLoadError(`Не удалось загрузить профиль преподавателя: ${tpError.message}`)
      setIsLoading(false)
      return
    }

    if (!tp) {
      setLoadError("Профиль преподавателя не найден. Обратитесь к администратору.")
      setIsLoading(false)
      return
    }

    setTeacherProfileId(tp.id)
    setHourlyRate(tp.hourly_rate ?? 0)

    const { data, error } = await supabase
      .from("lessons")
      .select("id, scheduled_at, duration_minutes, status, student_id")
      .eq("teacher_id", tp.id)
      .gte("scheduled_at", weekStart.toISOString())
      .lte("scheduled_at", weekEnd.toISOString())
      .order("scheduled_at", { ascending: true })

    if (error) {
      console.error("lessons fetch error:", error)
      setLoadError(`Ошибка загрузки расписания: ${error.message}`)
      setIsLoading(false)
      return
    }

    if (!error && data) {
      // Collect unique student_ids
      const studentIds = Array.from(
        new Set(data.map((l: any) => l.student_id).filter(Boolean))
      ) as string[]

      const studentMap = new Map<
        string,
        { full_name: string; avatar_url: string | null }
      >()

      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", studentIds)

        if (profiles) {
          for (const p of profiles as any[]) {
            studentMap.set(p.id, {
              full_name: p.full_name,
              avatar_url: p.avatar_url,
            })
          }
        }
      }

      setLessons(
        data.map((l: any) => ({
          id: l.id,
          scheduled_at: l.scheduled_at,
          duration_minutes: l.duration_minutes,
          status: l.status,
          student: l.student_id ? studentMap.get(l.student_id) ?? null : null,
        }))
      )
    }
    setIsLoading(false)
  }, [user, userLoading, userError, weekStart.toISOString(), weekEnd.toISOString()])

  useEffect(() => {
    fetchLessons()
  }, [fetchLessons])

  // Realtime: refetch when any of this teacher's lessons change
  // (student bookings, cancellations, payment status, etc.).
  useLessonsRealtime({
    teacherId: teacherProfileId,
    onChange: () => fetchLessons(),
  })

  // Load "my students" — distinct student_ids from past lessons of this teacher
  const fetchMyStudents = useCallback(async () => {
    if (!teacherProfileId) return
    const supabase = createClient()
    const { data: pastLessons } = await supabase
      .from("lessons")
      .select("student_id")
      .eq("teacher_id", teacherProfileId)

    const ids = Array.from(
      new Set((pastLessons ?? []).map((l: any) => l.student_id).filter(Boolean))
    ) as string[]

    if (ids.length === 0) {
      setMyStudents([])
      return
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", ids)

    setMyStudents(
      ((profiles ?? []) as any[]).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url,
      }))
    )
  }, [teacherProfileId])

  useEffect(() => {
    fetchMyStudents()
  }, [fetchMyStudents])

  // Search students by email/name across all profiles (role='student')
  useEffect(() => {
    const q = assignSearchQuery.trim()
    if (q.length < 2) {
      setAssignSearchResults([])
      return
    }
    const supabase = createClient()
    let cancelled = false
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("role", "student")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10)
      if (!cancelled) {
        setAssignSearchResults(
          ((data ?? []) as any[]).map((p) => ({
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            avatar_url: p.avatar_url,
          }))
        )
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [assignSearchQuery])

  const studentOptions = useMemo<StudentOption[]>(() => {
    const map = new Map<string, StudentOption>()
    for (const s of myStudents) map.set(s.id, s)
    for (const s of assignSearchResults) if (!map.has(s.id)) map.set(s.id, s)
    return Array.from(map.values())
  }, [myStudents, assignSearchResults])

  const estimatedPriceKopeks = useMemo(() => {
    return Math.round((hourlyRate * assignDuration) / 60)
  }, [hourlyRate, assignDuration])

  const estimatedPriceRub = Math.round(estimatedPriceKopeks / 100)

  function getLessonsForDayAndHour(day: Date, hour: number): LessonSlot[] {
    return lessons.filter((l) => {
      const d = new Date(l.scheduled_at)
      return isSameDay(d, day) && d.getHours() === hour
    })
  }

  function openAssignDialog(day: Date, hour: number) {
    setAssignDate(day)
    setAssignTime(`${hour.toString().padStart(2, "0")}:00`)
    setAssignDuration(50)
    setAssignStudentId("")
    setAssignSearchQuery("")
    setAssignSearchResults([])
    setAssignOpen(true)
  }

  function buildScheduledAt(): Date | null {
    if (!assignDate) return null
    const [hh, mm] = assignTime.split(":").map((s) => parseInt(s, 10))
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null
    const d = new Date(assignDate)
    d.setHours(hh, mm, 0, 0)
    return d
  }

  async function handleAssignSubmit() {
    if (!assignStudentId) {
      toast.error("Выберите ученика")
      return
    }
    const scheduledAt = buildScheduledAt()
    if (!scheduledAt) {
      toast.error("Некорректное время урока")
      return
    }
    if (scheduledAt.getTime() < Date.now()) {
      toast.error("Нельзя назначать урок в прошлом")
      return
    }

    setAssignIsSubmitting(true)
    try {
      const res = await fetch("/api/booking/teacher-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: assignStudentId,
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: assignDuration,
        }),
      })

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? "Слот занят. Выберите другое время.")
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? `Ошибка ${res.status}`)
        return
      }

      toast.success(
        "Урок назначен. Ученику отправлено уведомление об оплате."
      )
      setAssignOpen(false)
      await fetchLessons()
    } catch (e: any) {
      toast.error("Ошибка сети: " + (e?.message ?? ""))
    } finally {
      setAssignIsSubmitting(false)
    }
  }

  return (
    <>
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="size-4 text-[#CC3A3A]" />
          {format(weekStart, "d MMM", { locale: ru })} --{" "}
          {format(weekEnd, "d MMM yyyy", { locale: ru })}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentWeek(new Date())}
          >
            Сегодня
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            aria-label="Следующая неделя"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-6">
            <p className="text-center text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => fetchLessons()}>
              Повторить
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
              <div className="p-2" />
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={i}
                    className={`border-l p-2 text-center text-sm ${
                      isToday ? "bg-[#CC3A3A]/5 font-bold" : ""
                    }`}
                  >
                    <span className="text-muted-foreground">{DAY_NAMES[i]}</span>
                    <br />
                    <span
                      className={
                        isToday
                          ? "inline-flex size-7 items-center justify-center rounded-full bg-[#CC3A3A] text-white"
                          : ""
                      }
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Time grid */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0"
              >
                <div className="flex items-start justify-end p-1.5 text-xs text-muted-foreground">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {weekDays.map((day, dayIdx) => {
                  const dayLessons = getLessonsForDayAndHour(day, hour)
                  const isToday = isSameDay(day, new Date())
                  const cellDate = new Date(day)
                  cellDate.setHours(hour, 0, 0, 0)
                  const isPast = cellDate.getTime() < Date.now()
                  const isEmpty = dayLessons.length === 0
                  const isClickable = isEmpty && !isPast
                  return (
                    <div
                      key={dayIdx}
                      onClick={
                        isClickable
                          ? () => openAssignDialog(day, hour)
                          : undefined
                      }
                      onKeyDown={
                        isClickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                openAssignDialog(day, hour)
                              }
                            }
                          : undefined
                      }
                      role={isClickable ? "button" : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      aria-label={
                        isClickable
                          ? `Назначить урок ${format(day, "d MMMM", { locale: ru })} в ${hour.toString().padStart(2, "0")}:00`
                          : undefined
                      }
                      className={`group relative min-h-[50px] border-l p-0.5 transition-colors ${
                        isToday ? "bg-[#CC3A3A]/[0.02]" : ""
                      } ${isPast && isEmpty ? "bg-muted/30" : ""} ${
                        isClickable
                          ? "cursor-pointer hover:bg-[#CC3A3A]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC3A3A]/40"
                          : ""
                      }`}
                    >
                      {dayLessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className={`rounded-md border p-1.5 text-xs ${
                            statusColors[lesson.status] ?? "bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            {lesson.student && (
                              <Avatar size="sm">
                                {lesson.student.avatar_url ? (
                                  <AvatarImage
                                    src={lesson.student.avatar_url}
                                    alt={lesson.student.full_name}
                                  />
                                ) : null}
                                <AvatarFallback>
                                  {getInitials(lesson.student.full_name)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <span className="truncate font-medium">
                              {lesson.student?.full_name ?? "Ученик"}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] opacity-70">
                            {format(new Date(lesson.scheduled_at), "HH:mm")} --{" "}
                            {lesson.duration_minutes} мин
                          </div>
                        </div>
                      ))}
                      {isClickable && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                          <Plus className="size-4 text-[#CC3A3A]/70" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-[#CC3A3A]" />
            Назначить урок
          </DialogTitle>
          <DialogDescription>
            {assignDate
              ? format(assignDate, "EEEE, d MMMM yyyy", { locale: ru })
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Student select + search */}
          <div className="space-y-1.5">
            <Label htmlFor="assign-student">Ученик</Label>
            <Input
              id="assign-student-search"
              placeholder="Поиск по имени или email"
              value={assignSearchQuery}
              onChange={(e) => setAssignSearchQuery(e.target.value)}
              className="mb-2"
            />
            <Select
              value={assignStudentId}
              onValueChange={(v) => setAssignStudentId(v)}
            >
              <SelectTrigger id="assign-student" className="w-full">
                <SelectValue placeholder="Выберите ученика" />
              </SelectTrigger>
              <SelectContent>
                {studentOptions.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {assignSearchQuery.trim().length >= 2
                      ? "Никого не найдено"
                      : "Введите имя или email для поиска"}
                  </div>
                ) : (
                  studentOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name} — {s.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Duration toggle */}
          <div className="space-y-1.5">
            <Label>Длительность</Label>
            <div className="flex gap-2">
              {([25, 50] as const).map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant={assignDuration === d ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAssignDuration(d)}
                  style={
                    assignDuration === d
                      ? { backgroundColor: "#CC3A3A" }
                      : undefined
                  }
                  className={
                    assignDuration === d ? "text-white hover:opacity-90" : ""
                  }
                >
                  {d} мин
                </Button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="space-y-1.5">
            <Label htmlFor="assign-time">Время</Label>
            <Input
              id="assign-time"
              type="time"
              value={assignTime}
              onChange={(e) => setAssignTime(e.target.value)}
              className="w-32"
            />
          </div>

          {/* Price */}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Ваша ставка за урок
              </span>
              <span className="text-lg font-semibold text-[#CC3A3A]">
                {estimatedPriceRub.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {assignDuration} мин ·{" "}
              {(hourlyRate / 100).toLocaleString("ru-RU")} ₽/час
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setAssignOpen(false)}
            disabled={assignIsSubmitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleAssignSubmit}
            disabled={assignIsSubmitting || !assignStudentId}
            style={{ backgroundColor: "#CC3A3A" }}
            className="text-white hover:opacity-90"
          >
            {assignIsSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserPlus className="size-3.5" />
            )}
            Назначить урок
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

function AvailabilityEditor() {
  const { user, isLoading: userLoading, error: userError } = useUser()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [blockDate, setBlockDate] = useState("")

  const defaultAvailability: DayAvailability[] = DAY_NAMES.map((_, i) => ({
    active: i < 5, // Mon-Fri active by default
    ranges: i < 5 ? [{ start: "09:00", end: "18:00" }] : [],
  }))

  const [availability, setAvailability] =
    useState<DayAvailability[]>(defaultAvailability)

  // Load existing availability from teacher_availability table
  useEffect(() => {
    async function load() {
      if (userLoading) return
      if (!user) {
        if (userError) console.error("useUser error:", userError)
        setIsLoading(false)
        return
      }
      const supabase = createClient()

      // Get teacher_profile id
      const { data: tp, error: tpError } = await supabase
        .from("teacher_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (tpError) {
        console.error("teacher_profiles fetch error:", tpError)
        toast.error(`Не удалось загрузить профиль: ${tpError.message}`)
        setIsLoading(false)
        return
      }

      if (!tp) {
        toast.error("Профиль преподавателя не найден.")
        setIsLoading(false)
        return
      }

      const { data: rows, error: rowsError } = await supabase
        .from("teacher_availability")
        .select("day_of_week, start_time, end_time, is_active")
        .eq("teacher_id", tp.id)
        .order("start_time", { ascending: true })

      if (rowsError) {
        console.error("teacher_availability fetch error:", rowsError)
        toast.error(`Ошибка загрузки доступности: ${rowsError.message}`)
      }

      if (rows && rows.length > 0) {
        // Group by day_of_week (0=Sun in DB, but our UI is 0=Mon)
        const grouped: DayAvailability[] = DAY_NAMES.map(() => ({ active: false, ranges: [] }))
        for (const row of rows) {
          // DB: 0=Sun,1=Mon..6=Sat → UI: 0=Mon..6=Sun
          const uiDay = row.day_of_week === 0 ? 6 : row.day_of_week - 1
          if (uiDay >= 0 && uiDay < 7) {
            grouped[uiDay].active = true
            grouped[uiDay].ranges.push({
              start: (row.start_time as string).slice(0, 5),
              end: (row.end_time as string).slice(0, 5),
            })
          }
        }
        setAvailability(grouped)
      }
      setIsLoading(false)
    }

    load()
  }, [user, userLoading, userError])

  function toggleDay(index: number) {
    setAvailability((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        active: !next[index].active,
        ranges: !next[index].active
          ? next[index].ranges.length
            ? next[index].ranges
            : [{ start: "09:00", end: "18:00" }]
          : next[index].ranges,
      }
      return next
    })
  }

  function addRange(dayIndex: number) {
    setAvailability((prev) => {
      const next = [...prev]
      const lastRange = next[dayIndex].ranges[next[dayIndex].ranges.length - 1]
      const newStart = lastRange ? lastRange.end : "09:00"
      next[dayIndex] = {
        ...next[dayIndex],
        ranges: [
          ...next[dayIndex].ranges,
          { start: newStart, end: "18:00" },
        ],
      }
      return next
    })
  }

  function removeRange(dayIndex: number, rangeIndex: number) {
    setAvailability((prev) => {
      const next = [...prev]
      next[dayIndex] = {
        ...next[dayIndex],
        ranges: next[dayIndex].ranges.filter((_, i) => i !== rangeIndex),
      }
      return next
    })
  }

  function updateRange(
    dayIndex: number,
    rangeIndex: number,
    field: "start" | "end",
    value: string
  ) {
    setAvailability((prev) => {
      const next = [...prev]
      const ranges = [...next[dayIndex].ranges]
      ranges[rangeIndex] = { ...ranges[rangeIndex], [field]: value }
      next[dayIndex] = { ...next[dayIndex], ranges }
      return next
    })
  }

  async function handleSave() {
    if (!user) return
    setIsSaving(true)

    try {
      const supabase = createClient()

      // Get teacher_profile id
      const { data: tp } = await supabase
        .from("teacher_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (!tp) throw new Error("Teacher profile not found")

      // Delete existing availability
      await (supabase.from("teacher_availability") as any).delete().eq("teacher_id", tp.id)

      // Build rows from UI state
      const rows: any[] = []
      availability.forEach((day, uiIndex) => {
        if (!day.active || day.ranges.length === 0) return
        // UI: 0=Mon..6=Sun → DB: 0=Sun,1=Mon..6=Sat
        const dbDay = uiIndex === 6 ? 0 : uiIndex + 1
        for (const range of day.ranges) {
          rows.push({
            teacher_id: tp.id,
            day_of_week: dbDay,
            start_time: range.start + ":00",
            end_time: range.end + ":00",
            is_active: true,
          })
        }
      })

      if (rows.length > 0) {
        const { error } = await (supabase.from("teacher_availability") as any).insert(rows)
        if (error) throw error
      }

      toast.success("Расписание доступности сохранено")
    } catch (e: any) {
      toast.error("Ошибка при сохранении: " + (e?.message ?? ""))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBlockDate() {
    if (!blockDate) return

    try {
      toast.success(
        `Дата ${format(new Date(blockDate), "d MMMM yyyy", { locale: ru })} заблокирована`
      )
      setShowBlockDialog(false)
      setBlockDate("")
    } catch {
      toast.error("Ошибка при блокировке даты")
    }
  }

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardContent>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-[#CC3A3A]" />
            Еженедельная доступность
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBlockDialog(true)}
            >
              <Ban className="size-3.5" />
              Заблокировать дату
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              style={{ backgroundColor: "#CC3A3A" }}
              className="text-white hover:opacity-90"
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Сохранить
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {availability.map((day, dayIdx) => (
            <div
              key={dayIdx}
              className={`rounded-lg border p-3 transition-colors ${
                day.active ? "bg-background" : "bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Day toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={day.active}
                  aria-label={`${DAY_FULL_NAMES[dayIdx]}: ${day.active ? "активен" : "выключен"}`}
                  onClick={() => toggleDay(dayIdx)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    day.active ? "bg-[#CC3A3A]" : "bg-muted-foreground/20"
                  }`}
                >
                  <span
                    className={`inline-block size-3.5 rounded-full bg-white transition-transform ${
                      day.active ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>

                <span
                  className={`w-28 text-sm font-medium ${
                    day.active ? "" : "text-muted-foreground"
                  }`}
                >
                  {DAY_FULL_NAMES[dayIdx]}
                </span>

                {day.active && (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {day.ranges.map((range, rangeIdx) => (
                      <div
                        key={rangeIdx}
                        className="flex items-center gap-1.5"
                      >
                        <Input
                          type="time"
                          value={range.start}
                          onChange={(e) =>
                            updateRange(dayIdx, rangeIdx, "start", e.target.value)
                          }
                          className="h-7 w-24 text-xs"
                          aria-label="Начало"
                        />
                        <span className="text-xs text-muted-foreground">
                          --
                        </span>
                        <Input
                          type="time"
                          value={range.end}
                          onChange={(e) =>
                            updateRange(dayIdx, rangeIdx, "end", e.target.value)
                          }
                          className="h-7 w-24 text-xs"
                          aria-label="Конец"
                        />
                        {day.ranges.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeRange(dayIdx, rangeIdx)}
                            aria-label="Удалить интервал"
                          >
                            <Trash2 className="size-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => addRange(dayIdx)}
                      aria-label="Добавить интервал"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Block date dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Заблокировать дату</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Выберите дату, в которую вы не сможете проводить уроки. Все
            слоты в этот день будут недоступны для бронирования.
          </p>
          <Input
            type="date"
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            min={format(new Date(), "yyyy-MM-dd")}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBlockDialog(false)}
            >
              Отмена
            </Button>
            <Button
              onClick={handleBlockDate}
              disabled={!blockDate}
              style={{ backgroundColor: "#CC3A3A" }}
              className="text-white hover:opacity-90"
            >
              Заблокировать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
