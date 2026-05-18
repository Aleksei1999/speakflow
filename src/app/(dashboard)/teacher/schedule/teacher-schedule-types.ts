export type LessonRow = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  student_id: string | null
  price: number | null
}

export type StudentMapEntry = {
  full_name: string | null
  avatar_url: string | null
  initials: string
}

export type StudentOption = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

export type TimeRange = {
  start: string
  end: string
}

export type DayAvailability = {
  active: boolean
  ranges: TimeRange[]
}
