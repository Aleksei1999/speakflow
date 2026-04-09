import { redirect } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import {
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  File,
  Download,
  BookOpen,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface MaterialRow {
  id: string
  title: string
  file_url: string
  file_type: string
  created_at: string
  teacher_id: string
  lesson_id: string
  lessons: {
    scheduled_at: string
  } | null
  profiles: {
    full_name: string
  } | null
}

const fileTypeIcons: Record<string, React.ReactNode> = {
  pdf: <FileText className="size-5 text-red-500" />,
  doc: <FileText className="size-5 text-blue-500" />,
  docx: <FileText className="size-5 text-blue-500" />,
  txt: <FileText className="size-5 text-gray-500" />,
  png: <FileImage className="size-5 text-green-500" />,
  jpg: <FileImage className="size-5 text-green-500" />,
  jpeg: <FileImage className="size-5 text-green-500" />,
  gif: <FileImage className="size-5 text-green-500" />,
  mp3: <FileAudio className="size-5 text-purple-500" />,
  wav: <FileAudio className="size-5 text-purple-500" />,
  mp4: <FileVideo className="size-5 text-orange-500" />,
  webm: <FileVideo className="size-5 text-orange-500" />,
}

function getFileIcon(fileType: string): React.ReactNode {
  return fileTypeIcons[fileType.toLowerCase()] ?? (
    <File className="size-5 text-muted-foreground" />
  )
}

export default async function StudentMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ teacher?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let query = supabase
    .from("materials")
    .select(
      "id, title, file_url, file_type, created_at, teacher_id, lesson_id, lessons!materials_lesson_id_fkey(scheduled_at), profiles!materials_teacher_id_fkey(full_name)"
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })

  if (params.teacher) {
    query = query.eq("teacher_id", params.teacher)
  }

  const [materialsResult, teachersResult] = await Promise.all([
    query,
    supabase
      .from("materials")
      .select("teacher_id, profiles!materials_teacher_id_fkey(full_name)")
      .eq("student_id", user.id),
  ])

  const materials = (materialsResult.data ?? []) as unknown as MaterialRow[]

  // Deduplicate teachers
  const teacherMap = new Map<string, string>()
  for (const row of (teachersResult.data ?? []) as any[]) {
    if (row.teacher_id && row.profiles?.full_name) {
      teacherMap.set(row.teacher_id, row.profiles.full_name)
    }
  }
  const teachers = Array.from(teacherMap.entries())

  // Group by lesson date
  const grouped = new Map<string, MaterialRow[]>()
  for (const mat of materials) {
    const dateKey = mat.lessons?.scheduled_at
      ? format(new Date(mat.lessons.scheduled_at), "yyyy-MM-dd")
      : "no-date"
    if (!grouped.has(dateKey)) grouped.set(dateKey, [])
    grouped.get(dateKey)!.push(mat)
  }

  const sortedGroups = Array.from(grouped.entries()).sort((a, b) =>
    b[0].localeCompare(a[0])
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Материалы</h1>
        <p className="text-sm text-muted-foreground">
          Материалы от ваших преподавателей
        </p>
      </div>

      {/* Teacher filter */}
      {teachers.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <a href="/student/materials">
            <Badge
              variant={!params.teacher ? "default" : "outline"}
              className={
                !params.teacher
                  ? "bg-[#722F37] text-white cursor-pointer"
                  : "cursor-pointer"
              }
            >
              Все преподаватели
            </Badge>
          </a>
          {teachers.map(([id, name]) => (
            <a key={id} href={`/student/materials?teacher=${id}`}>
              <Badge
                variant={params.teacher === id ? "default" : "outline"}
                className={
                  params.teacher === id
                    ? "bg-[#722F37] text-white cursor-pointer"
                    : "cursor-pointer"
                }
              >
                {name}
              </Badge>
            </a>
          ))}
        </div>
      )}

      {/* Materials list */}
      {materials.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="mb-3 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Материалы появятся после первого урока
            </p>
          </CardContent>
        </Card>
      ) : (
        sortedGroups.map(([dateKey, mats]) => {
          const displayDate =
            dateKey === "no-date"
              ? "Без даты"
              : format(new Date(dateKey), "d MMMM yyyy", { locale: ru })

          return (
            <div key={dateKey} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Урок {displayDate}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mats.map((mat) => (
                  <Card key={mat.id} size="sm">
                    <CardContent className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {getFileIcon(mat.file_type)}
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <p className="truncate text-sm font-medium">
                          {mat.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(mat.profiles as any)?.full_name ?? "Преподаватель"}{" "}
                          <span className="uppercase text-muted-foreground/60">
                            .{mat.file_type}
                          </span>
                        </p>
                      </div>
                      <a
                        href={mat.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Button variant="ghost" size="icon-sm">
                          <Download className="size-4" />
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
