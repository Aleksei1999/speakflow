// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Trophy,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Settings,
  BookOpen,
  Award,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RoleGuard } from '@/components/auth/role-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

// ─── Types ───

type Achievement = {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  category: string
  threshold: number
  xp_reward: number
  created_at: string
}

type LevelTestQuestion = {
  id: string
  category: string
  difficulty: string
  question: string
  passage?: string
  options: string[]
  correctAnswer: number
  explanation?: string
}

type SiteSetting = {
  key: string
  value: string
  label: string
}

// ─── Achievements Tab ───

function AchievementsTab() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [formSlug, setFormSlug] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIcon, setFormIcon] = useState('trophy')
  const [formCategory, setFormCategory] = useState('lessons')
  const [formThreshold, setFormThreshold] = useState(1)
  const [formXpReward, setFormXpReward] = useState(100)
  const [saving, setSaving] = useState(false)

  const fetchAchievements = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('achievements')
      .select('*')
      .order('category')
      .order('threshold')

    setAchievements((data as Achievement[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAchievements()
  }, [fetchAchievements])

  const resetForm = () => {
    setFormSlug('')
    setFormTitle('')
    setFormDescription('')
    setFormIcon('trophy')
    setFormCategory('lessons')
    setFormThreshold(1)
    setFormXpReward(100)
    setEditingId(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (a: Achievement) => {
    setEditingId(a.id)
    setFormSlug(a.slug)
    setFormTitle(a.title)
    setFormDescription(a.description)
    setFormIcon(a.icon)
    setFormCategory(a.category)
    setFormThreshold(a.threshold)
    setFormXpReward(a.xp_reward)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      slug: formSlug,
      title: formTitle,
      description: formDescription,
      icon: formIcon,
      category: formCategory,
      threshold: formThreshold,
      xp_reward: formXpReward,
    }

    if (editingId) {
      await supabase
        .from('achievements')
        .update(payload)
        .eq('id', editingId)
    } else {
      await supabase.from('achievements').insert(payload)
    }

    setSaving(false)
    setDialogOpen(false)
    fetchAchievements()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить достижение? Это действие необратимо.')) return
    const supabase = createClient()
    await supabase.from('achievements').delete().eq('id', id)
    fetchAchievements()
  }

  const categoryLabels: Record<string, string> = {
    lessons: 'Уроки',
    streak: 'Серия',
    xp: 'Опыт',
    reviews: 'Отзывы',
    social: 'Социальное',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Достижения</h2>
        <Button
          onClick={openCreate}
          style={{ backgroundColor: '#722F37' }}
          className="text-white hover:opacity-90"
        >
          <Plus className="size-4" />
          Добавить достижение
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div
            className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
            style={{ color: '#722F37' }}
          />
        </div>
      ) : achievements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Нет достижений. Создайте первое!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{a.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold">{a.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {a.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(a)}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(a.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.description}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {categoryLabels[a.category] ?? a.category}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Порог: {a.threshold}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    +{a.xp_reward} XP
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Редактировать достижение' : 'Новое достижение'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="first_lesson"
              />
            </div>
            <div>
              <Label htmlFor="title">Название</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Первый урок"
              />
            </div>
            <div>
              <Label htmlFor="desc">Описание</Label>
              <Textarea
                id="desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Описание достижения..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="icon">Иконка (эмодзи)</Label>
                <Input
                  id="icon"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  placeholder="🏆"
                />
              </div>
              <div>
                <Label htmlFor="category">Категория</Label>
                <Select
                  value={formCategory}
                  onValueChange={setFormCategory}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lessons">Уроки</SelectItem>
                    <SelectItem value="streak">Серия</SelectItem>
                    <SelectItem value="xp">Опыт</SelectItem>
                    <SelectItem value="reviews">Отзывы</SelectItem>
                    <SelectItem value="social">Социальное</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="threshold">Порог</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  value={formThreshold}
                  onChange={(e) =>
                    setFormThreshold(parseInt(e.target.value) || 1)
                  }
                />
              </div>
              <div>
                <Label htmlFor="xp">Награда XP</Label>
                <Input
                  id="xp"
                  type="number"
                  min={0}
                  step={10}
                  value={formXpReward}
                  onChange={(e) =>
                    setFormXpReward(parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formSlug || !formTitle}
              style={{ backgroundColor: '#722F37' }}
              className="text-white hover:opacity-90"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Level Test Tab ───

function LevelTestTab() {
  // Level test questions are stored in src/lib/level-test-questions.ts
  // We display them for reference and allow editing via a simple UI
  const [questions, setQuestions] = useState<LevelTestQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editOptions, setEditOptions] = useState<string[]>([])
  const [editCorrect, setEditCorrect] = useState(0)
  const [editExplanation, setEditExplanation] = useState('')

  useEffect(() => {
    // Load questions from the module
    import('@/lib/level-test-questions').then((mod) => {
      setQuestions(
        mod.questions.map((q) => ({
          ...q,
          passage: q.passage,
          explanation: q.explanation,
        }))
      )
      setLoading(false)
    })
  }, [])

  const startEdit = (idx: number) => {
    const q = questions[idx]
    setEditingIdx(idx)
    setEditQuestion(q.question)
    setEditOptions([...q.options])
    setEditCorrect(q.correctAnswer)
    setEditExplanation(q.explanation ?? '')
  }

  const cancelEdit = () => {
    setEditingIdx(null)
  }

  const saveEdit = () => {
    if (editingIdx === null) return
    const updated = [...questions]
    updated[editingIdx] = {
      ...updated[editingIdx],
      question: editQuestion,
      options: editOptions,
      correctAnswer: editCorrect,
      explanation: editExplanation,
    }
    setQuestions(updated)
    setEditingIdx(null)
    // Note: In production, this would save to a DB table or config API
  }

  const difficultyColors: Record<string, string> = {
    A1: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
    A2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
    B1: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
    B2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30',
    C1: 'bg-red-100 text-red-700 dark:bg-red-900/30',
    C2: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30',
  }

  const categoryLabels: Record<string, string> = {
    grammar: 'Грамматика',
    vocabulary: 'Лексика',
    reading: 'Чтение',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Вопросы теста уровня</h2>
        <Badge variant="secondary">{questions.length} вопросов</Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div
            className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
            style={{ color: '#722F37' }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q, idx) => (
            <Card key={q.id}>
              <CardContent>
                {editingIdx === idx ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <Label>Вопрос</Label>
                      <Input
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                      />
                    </div>
                    {editOptions.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <Label className="w-20 shrink-0">
                          Вариант {oi + 1}
                        </Label>
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...editOptions]
                            newOpts[oi] = e.target.value
                            setEditOptions(newOpts)
                          }}
                          className="flex-1"
                        />
                        <input
                          type="radio"
                          name="correct"
                          checked={editCorrect === oi}
                          onChange={() => setEditCorrect(oi)}
                          className="accent-[#722F37]"
                        />
                      </div>
                    ))}
                    <div>
                      <Label>Объяснение</Label>
                      <Textarea
                        value={editExplanation}
                        onChange={(e) =>
                          setEditExplanation(e.target.value)
                        }
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        style={{ backgroundColor: '#722F37' }}
                        className="text-white hover:opacity-90"
                      >
                        <Save className="size-4" />
                        Сохранить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                      >
                        <X className="size-4" />
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={
                            difficultyColors[q.difficulty] ?? ''
                          }
                        >
                          {q.difficulty}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {categoryLabels[q.category] ?? q.category}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{q.question}</p>
                      {q.passage && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          {q.passage.slice(0, 120)}...
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {q.options.map((opt, oi) => (
                          <Badge
                            key={oi}
                            variant={
                              oi === q.correctAnswer
                                ? 'default'
                                : 'secondary'
                            }
                            className={
                              oi === q.correctAnswer
                                ? 'bg-[#722F37] text-white'
                                : ''
                            }
                          >
                            {opt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(idx)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Site Settings Tab ───

function SiteSettingsTab() {
  const [settings, setSettings] = useState<SiteSetting[]>([
    {
      key: 'platform_fee_percent',
      value: '15',
      label: 'Комиссия платформы (%)',
    },
    {
      key: 'default_lesson_duration',
      value: '50',
      label: 'Длительность урока по умолчанию (мин)',
    },
    {
      key: 'join_window_minutes',
      value: '5',
      label: 'Окно присоединения к уроку (мин)',
    },
  ])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Custom settings
  const [customKey, setCustomKey] = useState('')
  const [customValue, setCustomValue] = useState('')

  const handleChange = (key: string, value: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    )
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    // In production, this would save to a settings table in the DB
    // For now we simulate a save
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaving(false)
    setSaved(true)
  }

  const addCustomSetting = () => {
    if (!customKey.trim()) return
    setSettings((prev) => [
      ...prev,
      {
        key: customKey.trim(),
        value: customValue,
        label: customKey.trim(),
      },
    ])
    setCustomKey('')
    setCustomValue('')
    setSaved(false)
  }

  const removeSetting = (key: string) => {
    // Don't allow removing core settings
    const coreKeys = [
      'platform_fee_percent',
      'default_lesson_duration',
      'join_window_minutes',
    ]
    if (coreKeys.includes(key)) return
    setSettings((prev) => prev.filter((s) => s.key !== key))
    setSaved(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Настройки сайта</h2>
        <Button
          onClick={handleSave}
          disabled={saving || saved}
          style={{ backgroundColor: '#722F37' }}
          className="text-white hover:opacity-90"
        >
          <Save className="size-4" />
          {saving ? 'Сохранение...' : saved ? 'Сохранено' : 'Сохранить'}
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          {settings.map((s) => (
            <div key={s.key} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Label htmlFor={s.key} className="text-sm">
                  {s.label}
                </Label>
                <p className="text-xs text-muted-foreground font-mono">
                  {s.key}
                </p>
              </div>
              <Input
                id={s.key}
                value={s.value}
                onChange={(e) => handleChange(s.key, e.target.value)}
                className="w-32"
              />
              {![
                'platform_fee_percent',
                'default_lesson_duration',
                'join_window_minutes',
              ].includes(s.key) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeSetting(s.key)}
                  className="text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}

          {/* Add custom setting */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">
              Добавить параметр
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="customKey" className="text-xs">
                  Ключ
                </Label>
                <Input
                  id="customKey"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="max_students_per_class"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="customValue" className="text-xs">
                  Значение
                </Label>
                <Input
                  id="customValue"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="10"
                />
              </div>
              <Button
                variant="outline"
                onClick={addCustomSetting}
                disabled={!customKey.trim()}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Content Page ───

function AdminContentContent() {
  const [activeTab, setActiveTab] = useState('achievements')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Управление контентом
        </h1>
        <p className="text-sm text-muted-foreground">
          Достижения, тест уровня и настройки платформы
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="achievements">
            <Award className="size-4" />
            Достижения
          </TabsTrigger>
          <TabsTrigger value="level-test">
            <BookOpen className="size-4" />
            Тест уровня
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="size-4" />
            Настройки сайта
          </TabsTrigger>
        </TabsList>

        <TabsContent value="achievements">
          <AchievementsTab />
        </TabsContent>

        <TabsContent value="level-test">
          <LevelTestTab />
        </TabsContent>

        <TabsContent value="settings">
          <SiteSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AdminContentPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminContentContent />
    </RoleGuard>
  )
}
