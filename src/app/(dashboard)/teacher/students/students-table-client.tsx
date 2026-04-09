"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import {
  Search,
  Users,
  ChevronDown,
  ChevronRight,
  Calendar,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface StudentLesson {
  id: string
  scheduled_at: string
  status: string
  duration_minutes: number
}

interface StudentRecord {
  student_id: string
  full_name: string
  avatar_url: string | null
  lessons_completed: number
  next_lesson_at: string | null
  english_level: string | null
  lessons: StudentLesson[]
}

interface StudentsTableClientProps {
  students: StudentRecord[]
}

const statusLabels: Record<string, string> = {
  pending_payment: "Ожидание оплаты",
  booked: "Забронирован",
  in_progress: "В процессе",
  completed: "Завершён",
  cancelled: "Отменён",
  no_show: "Пропущен",
}

const statusVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending_payment: "outline",
  booked: "default",
  in_progress: "secondary",
  completed: "secondary",
  cancelled: "destructive",
  no_show: "destructive",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function StudentsTableClient({ students }: StudentsTableClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = students.filter((s) =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (students.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 size-12 text-muted-foreground/30" />
            <h3 className="text-lg font-medium">У вас пока нет учеников</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Ученики появятся здесь после того, как они забронируют урок с вами
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Ученик</TableHead>
                <TableHead>Уроков пройдено</TableHead>
                <TableHead>Следующий урок</TableHead>
                <TableHead>Уровень</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Ничего не найдено
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((student) => {
                  const isExpanded = expandedId === student.student_id

                  return (
                    <StudentRow
                      key={student.student_id}
                      student={student}
                      isExpanded={isExpanded}
                      onToggle={() =>
                        setExpandedId(isExpanded ? null : student.student_id)
                      }
                    />
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function StudentRow({
  student,
  isExpanded,
  onToggle,
}: {
  student: StudentRecord
  isExpanded: boolean
  onToggle: () => void
}) {
  const recentLessons = student.lessons.slice(0, 5)

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggle()
          }
        }}
        aria-expanded={isExpanded}
      >
        <TableCell>
          <Button variant="ghost" size="icon-xs" tabIndex={-1}>
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </Button>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar size="default">
              {student.avatar_url ? (
                <AvatarImage
                  src={student.avatar_url}
                  alt={student.full_name}
                />
              ) : null}
              <AvatarFallback>{getInitials(student.full_name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{student.full_name}</span>
          </div>
        </TableCell>
        <TableCell>{student.lessons_completed}</TableCell>
        <TableCell>
          {student.next_lesson_at ? (
            <span className="text-sm">
              {format(new Date(student.next_lesson_at), "d MMM, HH:mm", {
                locale: ru,
              })}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">--</span>
          )}
        </TableCell>
        <TableCell>
          {student.english_level ? (
            <Badge variant="outline">{student.english_level}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">--</span>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded lesson history */}
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="p-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Calendar className="size-3.5 text-[#722F37]" />
                История уроков
              </h4>
              {recentLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет уроков</p>
              ) : (
                <div className="space-y-1.5">
                  {recentLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <span>
                        {format(
                          new Date(lesson.scheduled_at),
                          "d MMMM yyyy, HH:mm",
                          { locale: ru }
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {lesson.duration_minutes} мин
                        </span>
                        <Badge
                          variant={
                            statusVariants[lesson.status] ?? "outline"
                          }
                        >
                          {statusLabels[lesson.status] ?? lesson.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {student.lessons.length > 5 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Показано 5 из {student.lessons.length} уроков
                    </p>
                  )}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
