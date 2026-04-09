"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import {
  Upload,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  File,
  Trash2,
  Loader2,
  FolderOpen,
  Plus,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useUser } from "@/hooks/use-user"

interface MaterialItem {
  id: string
  title: string
  description: string | null
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  lesson_id: string | null
  is_public: boolean
  created_at: string
}

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  jpg: FileImage,
  jpeg: FileImage,
  png: FileImage,
  gif: FileImage,
  webp: FileImage,
  mp4: FileVideo,
  mov: FileVideo,
  avi: FileVideo,
  mp3: FileAudio,
  wav: FileAudio,
  ogg: FileAudio,
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  return FILE_ICONS[ext] ?? File
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export default function TeacherMaterialsPage() {
  const { user } = useUser()
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [filter, setFilter] = useState<"all" | "lessons" | "general">("all")
  const [isDragging, setIsDragging] = useState(false)

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadDescription, setUploadDescription] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLessonId, setUploadLessonId] = useState("")
  const [uploadPublic, setUploadPublic] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const fetchMaterials = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const supabase = createClient()

    // List files from Supabase Storage
    const { data: files, error } = await supabase.storage
      .from("materials")
      .list(`${user.id}/`, { limit: 100, sortBy: { column: "created_at", order: "desc" } })

    if (files && !error) {
      const items: MaterialItem[] = files
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => ({
          id: f.id ?? f.name,
          title: f.name.replace(/\.[^.]+$/, "").replace(/_/g, " "),
          description: null,
          file_name: f.name,
          file_size: f.metadata?.size ?? 0,
          file_type: f.metadata?.mimetype ?? "application/octet-stream",
          storage_path: `${user.id}/${f.name}`,
          lesson_id: null,
          is_public: false,
          created_at: f.created_at ?? new Date().toISOString(),
        }))
      setMaterials(items)
    }
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  async function handleUpload() {
    if (!user || !uploadFile) return
    setIsUploading(true)

    try {
      const supabase = createClient()
      const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${user.id}/${Date.now()}_${safeName}`

      const { error } = await supabase.storage
        .from("materials")
        .upload(storagePath, uploadFile, {
          cacheControl: "3600",
          upsert: false,
        })

      if (error) {
        toast.error(`Ошибка загрузки: ${error.message}`)
        return
      }

      toast.success("Файл успешно загружен")
      resetUploadForm()
      setShowUploadDialog(false)
      fetchMaterials()
    } catch {
      toast.error("Не удалось загрузить файл")
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete(material: MaterialItem) {
    if (!user) return
    const supabase = createClient()

    const { error } = await supabase.storage
      .from("materials")
      .remove([material.storage_path])

    if (error) {
      toast.error("Ошибка при удалении файла")
      return
    }

    toast.success("Файл удалён")
    setMaterials((prev) => prev.filter((m) => m.id !== material.id))
  }

  function resetUploadForm() {
    setUploadTitle("")
    setUploadDescription("")
    setUploadFile(null)
    setUploadLessonId("")
    setUploadPublic(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setUploadFile(file)
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^.]+$/, "").replace(/_/g, " "))
      }
      setShowUploadDialog(true)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^.]+$/, "").replace(/_/g, " "))
      }
      setShowUploadDialog(true)
    }
  }

  const filteredMaterials = materials.filter((m) => {
    if (filter === "lessons") return !!m.lesson_id
    if (filter === "general") return !m.lesson_id
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Материалы</h1>
          <p className="text-sm text-muted-foreground">
            Загрузка и управление учебными материалами
          </p>
        </div>
        <Button
          onClick={() => setShowUploadDialog(true)}
          style={{ backgroundColor: "#722F37" }}
          className="text-white hover:opacity-90"
        >
          <Plus className="size-4" />
          Загрузить
        </Button>
      </div>

      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-[#722F37] bg-[#722F37]/5"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        }`}
        role="button"
        tabIndex={0}
        aria-label="Зона загрузки файлов"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
      >
        <Upload
          className={`mb-2 size-8 ${
            isDragging ? "text-[#722F37]" : "text-muted-foreground/50"
          }`}
        />
        <p className="text-sm font-medium">
          Перетащите файл сюда или нажмите для выбора
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, DOC, изображения, аудио, видео -- до 50 МБ
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.mp3,.wav,.pptx,.xlsx"
        />
      </div>

      {/* Filter tabs */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as typeof filter)}
      >
        <TabsList>
          <TabsTrigger value="all">Все</TabsTrigger>
          <TabsTrigger value="lessons">По урокам</TabsTrigger>
          <TabsTrigger value="general">Общие</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Materials list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredMaterials.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="mb-3 size-12 text-muted-foreground/30" />
              <h3 className="text-lg font-medium">Нет материалов</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Загрузите учебные материалы для ваших учеников
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredMaterials.map((material) => {
            const IconComp = getFileIcon(material.file_name)
            return (
              <Card key={material.id} size="sm">
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <IconComp className="size-4 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {material.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(material.file_size)} --{" "}
                      {format(new Date(material.created_at), "d MMM yyyy", {
                        locale: ru,
                      })}
                    </p>
                  </div>

                  {material.lesson_id && (
                    <Badge variant="outline" className="shrink-0">
                      Урок
                    </Badge>
                  )}

                  {material.is_public && (
                    <Badge variant="secondary" className="shrink-0">
                      Публичный
                    </Badge>
                  )}

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(material)}
                    aria-label={`Удалить ${material.title}`}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog
        open={showUploadDialog}
        onOpenChange={(open) => {
          setShowUploadDialog(open)
          if (!open) resetUploadForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Загрузить материал</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* File picker */}
            {uploadFile ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-sm">
                <File className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{uploadFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(uploadFile.size)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setUploadFile(null)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/40"
                role="button"
                tabIndex={0}
              >
                <Upload className="mr-2 size-4" />
                Выбрать файл
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="upload-title" className="text-sm font-medium">
                Название
              </label>
              <Input
                id="upload-title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Название материала"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="upload-desc" className="text-sm font-medium">
                Описание
              </label>
              <Textarea
                id="upload-desc"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Краткое описание..."
                className="min-h-[60px]"
              />
            </div>

            {/* Lesson select */}
            <div className="space-y-1.5">
              <label htmlFor="upload-lesson" className="text-sm font-medium">
                Привязать к уроку (необязательно)
              </label>
              <Input
                id="upload-lesson"
                value={uploadLessonId}
                onChange={(e) => setUploadLessonId(e.target.value)}
                placeholder="ID урока"
              />
            </div>

            {/* Public toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={uploadPublic}
                aria-label="Публичный доступ"
                onClick={() => setUploadPublic(!uploadPublic)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  uploadPublic ? "bg-[#722F37]" : "bg-muted-foreground/20"
                }`}
              >
                <span
                  className={`inline-block size-3.5 rounded-full bg-white transition-transform ${
                    uploadPublic
                      ? "translate-x-[18px]"
                      : "translate-x-[3px]"
                  }`}
                />
              </button>
              <span className="text-sm">Доступен всем ученикам</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false)
                resetUploadForm()
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || !uploadTitle || isUploading}
              style={{ backgroundColor: "#722F37" }}
              className="text-white hover:opacity-90"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              Загрузить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
