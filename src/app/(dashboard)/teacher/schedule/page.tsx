// @ts-nocheck
"use client"

import { useEffect, useState, useCallback } from "react"
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
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useUser } from "@/hooks/use-user"

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

function WeekSchedule() {
  const { user } = useUser()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [lessons, setLessons] = useState<LessonSlot[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const fetchLessons = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("lessons")
      .select(
        "id, scheduled_at, duration_minutes, status, student:profiles!lessons_student_id_fkey(full_name, avatar_url)"
      )
      .eq("teacher_id", user.id)
      .gte("scheduled_at", weekStart.toISOString())
      .lte("scheduled_at", weekEnd.toISOString())
      .order("scheduled_at", { ascending: true })

    if (!error && data) {
      setLessons(
        data.map((l) => ({
          id: l.id,
          scheduled_at: l.scheduled_at,
          duration_minutes: l.duration_minutes,
          status: l.status,
          student: l.student as { full_name: string; avatar_url: string | null } | null,
        }))
      )
    }
    setIsLoading(false)
  }, [user, weekStart.toISOString(), weekEnd.toISOString()])

  useEffect(() => {
    fetchLessons()
  }, [fetchLessons])

  function getLessonsForDayAndHour(day: Date, hour: number): LessonSlot[] {
    return lessons.filter((l) => {
      const d = new Date(l.scheduled_at)
      return isSameDay(d, day) && d.getHours() === hour
    })
  }

  return (
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
        {isLoading ? (
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
                  return (
                    <div
                      key={dayIdx}
                      className={`min-h-[50px] border-l p-0.5 ${
                        isToday ? "bg-[#CC3A3A]/[0.02]" : ""
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
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AvailabilityEditor() {
  const { user } = useUser()
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
      if (!user) return
      const supabase = createClient()

      // Get teacher_profile id
      const { data: tp } = await supabase
        .from("teacher_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (!tp) { setIsLoading(false); return }

      const { data: rows } = await supabase
        .from("teacher_availability")
        .select("day_of_week, start_time, end_time, is_active")
        .eq("teacher_id", tp.id)
        .order("start_time", { ascending: true })

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
  }, [user])

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
