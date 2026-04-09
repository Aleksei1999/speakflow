// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  CheckCircle,
  XCircle,
  Eye,
  Star,
  ChevronDown,
  ChevronUp,
  EyeOff,
  ShieldCheck,
  BookOpen,
  DollarSign,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RoleGuard } from '@/components/auth/role-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

type TeacherRow = {
  id: string
  user_id: string
  bio: string | null
  specializations: string[]
  experience_years: number
  hourly_rate: number
  trial_rate: number | null
  languages: string[]
  education: string | null
  certificates: string[]
  rating: number
  total_reviews: number
  total_lessons: number
  is_verified: boolean
  is_listed: boolean
  created_at: string
  profile: {
    full_name: string
    email: string
    avatar_url: string | null
    is_active: boolean
  } | null
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatCurrency(kopecks: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(kopecks / 100)
}

function renderStars(rating: number) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`size-3.5 ${
          i <= Math.round(rating)
            ? 'fill-amber-400 text-amber-400'
            : 'text-muted-foreground/30'
        }`}
      />
    )
  }
  return stars
}

function TeacherCard({
  teacher,
  onVerify,
  onReject,
  onToggleListed,
  showModeration,
}: {
  teacher: TeacherRow
  onVerify: (id: string) => void
  onReject: (id: string) => void
  onToggleListed: (id: string, listed: boolean) => void
  showModeration: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const name = teacher.profile?.full_name ?? 'Неизвестный'

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {/* Main info row */}
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            {teacher.profile?.avatar_url ? (
              <AvatarImage
                src={teacher.profile.avatar_url}
                alt={name}
              />
            ) : null}
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{name}</h3>
              {teacher.is_verified ? (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Верифицирован
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  На модерации
                </Badge>
              )}
              {!teacher.is_listed && teacher.is_verified && (
                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  Скрыт
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <div className="flex">{renderStars(teacher.rating)}</div>
                {teacher.rating.toFixed(1)} ({teacher.total_reviews})
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="size-3" />
                {teacher.total_lessons} уроков
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="size-3" />
                {formatCurrency(teacher.hourly_rate)}/час
              </span>
            </div>
            {teacher.specializations.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {teacher.specializations.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {showModeration && !teacher.is_verified && (
              <>
                <Button
                  size="sm"
                  onClick={() => onVerify(teacher.id)}
                  style={{ backgroundColor: '#CC3A3A' }}
                  className="text-white hover:opacity-90"
                >
                  <CheckCircle className="size-4" />
                  Одобрить
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onReject(teacher.id)}
                >
                  <XCircle className="size-4" />
                  Отклонить
                </Button>
              </>
            )}
            {teacher.is_verified && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onToggleListed(teacher.id, !teacher.is_listed)
                }
              >
                {teacher.is_listed ? (
                  <>
                    <EyeOff className="size-4" />
                    Снять
                  </>
                ) : (
                  <>
                    <Eye className="size-4" />
                    В каталог
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Email
              </p>
              <p className="text-sm">
                {teacher.profile?.email ?? '---'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Опыт
              </p>
              <p className="text-sm">
                {teacher.experience_years}{' '}
                {teacher.experience_years === 1
                  ? 'год'
                  : teacher.experience_years < 5
                    ? 'года'
                    : 'лет'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Языки
              </p>
              <p className="text-sm">
                {teacher.languages.join(', ') || '---'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Образование
              </p>
              <p className="text-sm">{teacher.education ?? '---'}</p>
            </div>
            {teacher.bio && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  О себе
                </p>
                <p className="text-sm">{teacher.bio}</p>
              </div>
            )}
            {teacher.certificates.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Сертификаты
                </p>
                <div className="flex flex-wrap gap-1">
                  {teacher.certificates.map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Пробный урок
              </p>
              <p className="text-sm">
                {teacher.trial_rate
                  ? formatCurrency(teacher.trial_rate)
                  : 'Не указан'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Дата регистрации
              </p>
              <p className="text-sm">
                {format(new Date(teacher.created_at), 'd MMMM yyyy', {
                  locale: ru,
                })}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AdminTeachersContent() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')

  const fetchTeachers = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('teacher_profiles')
      .select(
        '*, profile:profiles!teacher_profiles_user_id_fkey(full_name, email, avatar_url, is_active)'
      )
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTeachers(
        data.map((t: any) => ({
          ...t,
          profile: t.profile ?? null,
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTeachers()
  }, [fetchTeachers])

  const handleVerify = async (teacherId: string) => {
    const supabase = createClient()
    await supabase
      .from('teacher_profiles')
      .update({ is_verified: true, is_listed: true })
      .eq('id', teacherId)
    fetchTeachers()
  }

  const handleReject = async (teacherId: string) => {
    const supabase = createClient()
    // Remove from teacher_profiles (or mark inactive)
    const teacher = teachers.find((t) => t.id === teacherId)
    if (teacher) {
      await supabase
        .from('profiles')
        .update({ role: 'student' as const })
        .eq('id', teacher.user_id)
      await supabase
        .from('teacher_profiles')
        .delete()
        .eq('id', teacherId)
    }
    fetchTeachers()
  }

  const handleToggleListed = async (teacherId: string, listed: boolean) => {
    const supabase = createClient()
    await supabase
      .from('teacher_profiles')
      .update({ is_listed: listed })
      .eq('id', teacherId)
    fetchTeachers()
  }

  const activeTeachers = teachers.filter((t) => t.is_verified)
  const pendingTeachers = teachers.filter((t) => !t.is_verified)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Управление преподавателями
        </h1>
        <p className="text-sm text-muted-foreground">
          Верификация и управление преподавателями платформы
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">
            Активные ({activeTeachers.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            На модерации ({pendingTeachers.length})
            {pendingTeachers.length > 0 && (
              <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-[#CC3A3A] text-xs text-white">
                {pendingTeachers.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div
                className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
                style={{ color: '#CC3A3A' }}
              />
              <span className="ml-2 text-sm text-muted-foreground">
                Загрузка...
              </span>
            </div>
          ) : activeTeachers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShieldCheck className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Нет активных преподавателей
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {activeTeachers.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onVerify={handleVerify}
                  onReject={handleReject}
                  onToggleListed={handleToggleListed}
                  showModeration={false}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div
                className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
                style={{ color: '#CC3A3A' }}
              />
              <span className="ml-2 text-sm text-muted-foreground">
                Загрузка...
              </span>
            </div>
          ) : pendingTeachers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="mb-3 size-10 text-emerald-400" />
                <p className="text-sm text-muted-foreground">
                  Нет преподавателей на модерации
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Все заявки рассмотрены
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {pendingTeachers.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onVerify={handleVerify}
                  onReject={handleReject}
                  onToggleListed={handleToggleListed}
                  showModeration
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AdminTeachersPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminTeachersContent />
    </RoleGuard>
  )
}
