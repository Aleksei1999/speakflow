// @ts-nocheck
"use client"

import { useEffect, useState, useRef } from "react"
import {
  Save,
  Loader2,
  Upload,
  Camera,
  Bell,
  User,
  Award,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { teacherProfileSchema } from "@/lib/validations"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useUser } from "@/hooks/use-user"

const SPECIALIZATIONS = [
  { value: "general", label: "General English" },
  { value: "business", label: "Business English" },
  { value: "ielts", label: "IELTS" },
  { value: "toefl", label: "TOEFL" },
  { value: "kids", label: "Для детей" },
  { value: "conversation", label: "Разговорный" },
  { value: "grammar", label: "Грамматика" },
  { value: "pronunciation", label: "Произношение" },
]

const LANGUAGES = [
  { value: "russian", label: "Русский" },
  { value: "english", label: "Английский" },
  { value: "german", label: "Немецкий" },
  { value: "french", label: "Французский" },
  { value: "spanish", label: "Испанский" },
]

// Input schema (before zod transforms)
interface TeacherSettingsForm {
  bio: string
  specializations: string[]
  experienceYears: number
  hourlyRate: number
  trialRate: number
  languages: string[]
  education: string
  certificates: string[]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function TeacherSettingsPage() {
  const { user, profile } = useUser()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [emailNotif, setEmailNotif] = useState(true)
  const [telegramNotif, setTelegramNotif] = useState(false)
  const [certificateInput, setCertificateInput] = useState("")

  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<TeacherSettingsForm>({
    bio: "",
    specializations: [],
    experienceYears: 0,
    hourlyRate: 0,
    trialRate: 0,
    languages: ["russian"],
    education: "",
    certificates: [],
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load teacher profile data
  useEffect(() => {
    async function load() {
      if (!user) return
      const supabase = createClient()

      const { data: teacherProfile } = await supabase
        .from("teacher_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (teacherProfile) {
        setFormData({
          bio: teacherProfile.bio ?? "",
          specializations: teacherProfile.specializations ?? [],
          experienceYears: teacherProfile.experience_years ?? 0,
          hourlyRate: (teacherProfile.hourly_rate ?? 0) / 100,
          trialRate: (teacherProfile.trial_rate ?? 0) / 100,
          languages: teacherProfile.languages ?? ["russian"],
          education: teacherProfile.education ?? "",
          certificates: teacherProfile.certificates ?? [],
        })
      }

      setAvatarUrl(profile?.avatar_url ?? null)
      setIsLoading(false)
    }

    load()
  }, [user, profile])

  function toggleSpecialization(value: string) {
    setFormData((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(value)
        ? prev.specializations.filter((s) => s !== value)
        : [...prev.specializations, value],
    }))
  }

  function toggleLanguage(value: string) {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(value)
        ? prev.languages.filter((l) => l !== value)
        : [...prev.languages, value],
    }))
  }

  function addCertificate() {
    if (!certificateInput.trim()) return
    setFormData((prev) => ({
      ...prev,
      certificates: [...prev.certificates, certificateInput.trim()],
    }))
    setCertificateInput("")
  }

  function removeCertificate(index: number) {
    setFormData((prev) => ({
      ...prev,
      certificates: prev.certificates.filter((_, i) => i !== index),
    }))
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setIsUploadingAvatar(true)
    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop()
      const storagePath = `avatars/${user.id}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(storagePath, file, { cacheControl: "3600", upsert: true })

      if (uploadError) {
        toast.error("Ошибка загрузки аватара")
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(storagePath)

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id)

      setAvatarUrl(publicUrl)
      toast.success("Фото обновлено")
    } catch {
      toast.error("Не удалось загрузить фото")
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function handleSave() {
    if (!user) return

    // Validate
    const result = teacherProfileSchema.safeParse({
      bio: formData.bio || undefined,
      specializations: formData.specializations,
      experienceYears: formData.experienceYears,
      hourlyRate: formData.hourlyRate,
      trialRate: formData.trialRate || undefined,
      languages: formData.languages,
      education: formData.education || undefined,
      certificates: formData.certificates.length ? formData.certificates : undefined,
    })

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]?.toString()
        if (field) fieldErrors[field] = issue.message
      }
      setErrors(fieldErrors)
      toast.error("Проверьте заполнение формы")
      return
    }

    setErrors({})
    setIsSaving(true)

    try {
      const supabase = createClient()
      const transformed = result.data as {
        bio?: string
        specializations: string[]
        experienceYears: number
        hourlyRate: number
        trialRate?: number
        languages: string[]
        education?: string
        certificates?: string[]
      }

      const { error } = await supabase
        .from("teacher_profiles")
        .update({
          bio: transformed.bio ?? null,
          specializations: transformed.specializations,
          experience_years: transformed.experienceYears,
          hourly_rate: transformed.hourlyRate,
          trial_rate: transformed.trialRate ?? null,
          languages: transformed.languages,
          education: transformed.education ?? null,
          certificates: transformed.certificates ?? [],
        })
        .eq("user_id", user.id)

      if (error) {
        toast.error("Ошибка при сохранении профиля")
        return
      }

      toast.success("Профиль успешно обновлён")
    } catch {
      toast.error("Не удалось сохранить профиль")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки профиля</h1>
        <p className="text-sm text-muted-foreground">
          Управление профилем преподавателя
        </p>
      </div>

      {/* Avatar section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="size-4 text-[#722F37]" />
            Фото профиля
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar size="lg" className="size-20">
                {avatarUrl ? (
                  <AvatarImage
                    src={avatarUrl}
                    alt={profile?.full_name ?? "Аватар"}
                  />
                ) : null}
                <AvatarFallback className="text-lg">
                  {profile?.full_name
                    ? getInitials(profile.full_name)
                    : "?"}
                </AvatarFallback>
              </Avatar>
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 className="size-5 animate-spin text-white" />
                </div>
              )}
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                <Upload className="size-3.5" />
                Загрузить фото
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG до 2 МБ. Рекомендуемый размер 400x400 пикселей.
              </p>
              <input
                ref={avatarInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4 text-[#722F37]" />
            Профиль преподавателя
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bio */}
          <div className="space-y-1.5">
            <label htmlFor="bio" className="text-sm font-medium">
              О себе
            </label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, bio: e.target.value }))
              }
              placeholder="Расскажите о своём опыте преподавания..."
              className="min-h-[100px]"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {formData.bio.length}/1000 символов
            </p>
          </div>

          {/* Specializations */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Специализации</label>
            {errors.specializations && (
              <p className="text-xs text-destructive">
                {errors.specializations}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((spec) => {
                const isSelected = formData.specializations.includes(spec.value)
                return (
                  <button
                    key={spec.value}
                    type="button"
                    onClick={() => toggleSpecialization(spec.value)}
                    className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "border-[#722F37] bg-[#722F37]/10 text-[#722F37]"
                        : "border-border hover:bg-muted"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {spec.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Experience years */}
            <div className="space-y-1.5">
              <label htmlFor="experience" className="text-sm font-medium">
                Опыт преподавания (лет)
              </label>
              <Input
                id="experience"
                type="number"
                min={0}
                max={50}
                value={formData.experienceYears}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    experienceYears: parseInt(e.target.value) || 0,
                  }))
                }
              />
              {errors.experienceYears && (
                <p className="text-xs text-destructive">
                  {errors.experienceYears}
                </p>
              )}
            </div>

            {/* Hourly rate */}
            <div className="space-y-1.5">
              <label htmlFor="hourlyRate" className="text-sm font-medium">
                Стоимость урока (руб.)
              </label>
              <Input
                id="hourlyRate"
                type="number"
                min={100}
                step={50}
                value={formData.hourlyRate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    hourlyRate: parseInt(e.target.value) || 0,
                  }))
                }
              />
              {errors.hourlyRate && (
                <p className="text-xs text-destructive">
                  {errors.hourlyRate}
                </p>
              )}
            </div>

            {/* Trial rate */}
            <div className="space-y-1.5">
              <label htmlFor="trialRate" className="text-sm font-medium">
                Стоимость пробного урока (руб.)
              </label>
              <Input
                id="trialRate"
                type="number"
                min={0}
                step={50}
                value={formData.trialRate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    trialRate: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          {/* Languages */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Языки преподавания
            </label>
            {errors.languages && (
              <p className="text-xs text-destructive">{errors.languages}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => {
                const isSelected = formData.languages.includes(lang.value)
                return (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => toggleLanguage(lang.value)}
                    className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "border-[#722F37] bg-[#722F37]/10 text-[#722F37]"
                        : "border-border hover:bg-muted"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {lang.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Education */}
          <div className="space-y-1.5">
            <label htmlFor="education" className="text-sm font-medium">
              Образование
            </label>
            <Input
              id="education"
              value={formData.education}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, education: e.target.value }))
              }
              placeholder="Например: МГУ, филологический факультет"
            />
          </div>

          {/* Certificates */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Сертификаты</label>
            <div className="flex gap-2">
              <Input
                value={certificateInput}
                onChange={(e) => setCertificateInput(e.target.value)}
                placeholder="CELTA, TESOL, IELTS..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCertificate()
                  }
                }}
              />
              <Button variant="outline" onClick={addCertificate}>
                <Plus className="size-3.5" />
                Добавить
              </Button>
            </div>
            {formData.certificates.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {formData.certificates.map((cert, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <Award className="size-3" />
                    {cert}
                    <button
                      type="button"
                      onClick={() => removeCertificate(i)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={`Удалить ${cert}`}
                    >
                      x
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-[#722F37]" />
            Уведомления
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email-уведомления</p>
              <p className="text-xs text-muted-foreground">
                Получать уведомления о новых бронированиях на email
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={emailNotif}
              onClick={() => setEmailNotif(!emailNotif)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                emailNotif ? "bg-[#722F37]" : "bg-muted-foreground/20"
              }`}
            >
              <span
                className={`inline-block size-3.5 rounded-full bg-white transition-transform ${
                  emailNotif ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Telegram-уведомления</p>
              <p className="text-xs text-muted-foreground">
                Получать уведомления в Telegram-бот
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={telegramNotif}
              onClick={() => setTelegramNotif(!telegramNotif)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                telegramNotif ? "bg-[#722F37]" : "bg-muted-foreground/20"
              }`}
            >
              <span
                className={`inline-block size-3.5 rounded-full bg-white transition-transform ${
                  telegramNotif ? "translate-x-[18px]" : "translate-x-[3px]"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="lg"
          style={{ backgroundColor: "#722F37" }}
          className="text-white hover:opacity-90"
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Сохранить изменения
        </Button>
      </div>
    </div>
  )
}
