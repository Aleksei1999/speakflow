// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { invalidateProfile } from '@/lib/cache/invalidate'

// ---------------------------------------------------------------------------
// Defaults — kept in one place and mirrored in migration 025.
// If the row has NULL (shouldn't happen with NOT NULL defaults, but safety first)
// we fall back to these so the client always has a complete object.
// ---------------------------------------------------------------------------

const DEFAULT_NOTIFICATIONS = {
  lesson_reminders: true,
  daily_challenge: true,
  streak_warning: true,
  new_clubs: true,
  achievements: true,
  leaderboard: false,
  email_digest: true,
  marketing: false,
  channel: 'telegram' as 'telegram' | 'email' | 'push' | 'sms',
}

const DEFAULT_UI = {
  theme: 'light' as 'light' | 'dark' | 'auto',
  show_xp_bar: true,
  sounds: true,
  confetti: true,
}

const DEFAULT_VISIBILITY = {
  leaderboard_public: true,
  visible_to_teachers: true,
}

// ---------------------------------------------------------------------------
// GET /api/settings/me
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, email, first_name, last_name, full_name, avatar_url, phone, timezone, city, language, notification_prefs, ui_prefs, profile_visibility, subscription_tier, subscription_until, telegram_chat_id, telegram_username'
      )
      .eq('id', user.id)
      .maybeSingle()

    if (error || !data) {
      console.error('Ошибка загрузки настроек:', error)
      return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 })
    }

    // Detect connected providers. Google = OAuth identity. Telegram = custom
    // chat_id stored on the profile (linked via the bot webhook flow).
    const identities = (user as any).identities ?? []
    const connected = {
      google: identities.some((i: any) => i.provider === 'google'),
      telegram: !!(data as any).telegram_chat_id,
    }

    return NextResponse.json({
      account: {
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        phone: data.phone,
        timezone: data.timezone ?? 'Europe/Moscow',
        city: data.city,
        language: data.language ?? 'ru',
      },
      notifications: { ...DEFAULT_NOTIFICATIONS, ...(data.notification_prefs ?? {}) },
      ui: { ...DEFAULT_UI, ...(data.ui_prefs ?? {}) },
      visibility: { ...DEFAULT_VISIBILITY, ...(data.profile_visibility ?? {}) },
      subscription: {
        tier: data.subscription_tier ?? 'free',
        until: data.subscription_until,
      },
      connected,
    })
  } catch (err) {
    console.error('Непредвиденная ошибка в /api/settings/me GET:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/settings/me
// Accepts a partial object — any top-level section that's provided is merged
// into the current row. Unknown keys inside sections are rejected by zod.
// ---------------------------------------------------------------------------

const notificationsSchema = z
  .object({
    lesson_reminders: z.boolean().optional(),
    daily_challenge: z.boolean().optional(),
    streak_warning: z.boolean().optional(),
    new_clubs: z.boolean().optional(),
    achievements: z.boolean().optional(),
    leaderboard: z.boolean().optional(),
    email_digest: z.boolean().optional(),
    marketing: z.boolean().optional(),
    channel: z.enum(['telegram', 'email', 'push', 'sms']).optional(),
  })
  .strict()

const uiSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    show_xp_bar: z.boolean().optional(),
    sounds: z.boolean().optional(),
    confetti: z.boolean().optional(),
  })
  .strict()

const visibilitySchema = z
  .object({
    leaderboard_public: z.boolean().optional(),
    visible_to_teachers: z.boolean().optional(),
  })
  .strict()

const accountSchema = z
  .object({
    first_name: z.string().min(1).max(60).optional(),
    last_name: z.string().max(60).nullable().optional(),
    phone: z.string().max(60).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    timezone: z.string().max(60).optional(),
    language: z.enum(['ru', 'en']).optional(),
  })
  .strict()

const settingsPatchSchema = z
  .object({
    account: accountSchema.optional(),
    notifications: notificationsSchema.optional(),
    ui: uiSchema.optional(),
    visibility: visibilitySchema.optional(),
  })
  .strict()

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
    }

    const parsed = settingsPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' },
        { status: 400 }
      )
    }

    const { data: current, error: readErr } = await supabase
      .from('profiles')
      .select(
        'first_name, last_name, notification_prefs, ui_prefs, profile_visibility'
      )
      .eq('id', user.id)
      .maybeSingle()
    if (readErr || !current) {
      return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 })
    }

    const patch: Record<string, any> = {}
    const d = parsed.data

    if (d.account) {
      const a = d.account
      if (a.first_name !== undefined) patch.first_name = a.first_name
      if (a.last_name !== undefined) patch.last_name = a.last_name
      if (a.phone !== undefined) patch.phone = a.phone
      if (a.city !== undefined) patch.city = a.city
      if (a.timezone !== undefined) patch.timezone = a.timezone
      if (a.language !== undefined) patch.language = a.language

      if (a.first_name !== undefined || a.last_name !== undefined) {
        const fn = a.first_name ?? current.first_name ?? ''
        const ln = (a.last_name !== undefined ? a.last_name : current.last_name) ?? ''
        patch.full_name = [fn, ln].filter(Boolean).join(' ').trim() || null
      }
    }

    if (d.notifications) {
      patch.notification_prefs = {
        ...DEFAULT_NOTIFICATIONS,
        ...(current.notification_prefs ?? {}),
        ...d.notifications,
      }
    }
    if (d.ui) {
      patch.ui_prefs = {
        ...DEFAULT_UI,
        ...(current.ui_prefs ?? {}),
        ...d.ui,
      }
    }
    if (d.visibility) {
      patch.profile_visibility = {
        ...DEFAULT_VISIBILITY,
        ...(current.profile_visibility ?? {}),
        ...d.visibility,
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, updated: 0 })
    }

    const { error: updErr } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (updErr) {
      console.error('Ошибка обновления настроек:', updErr)
      return NextResponse.json({ error: 'Не удалось сохранить настройки' }, { status: 500 })
    }

    // Sidebar (DashboardShell) reads full_name/avatar_url/role via cache —
    // any setting save can mutate avatar_url (uploads) so evict.
    invalidateProfile(user.id)

    return NextResponse.json({ ok: true, updated: Object.keys(patch).length })
  } catch (err) {
    console.error('Непредвиденная ошибка в /api/settings/me PATCH:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
