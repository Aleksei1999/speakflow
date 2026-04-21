// @ts-nocheck
// Claim the XP accumulated on the marketing landing.
// Landing-page XP is tracked client-side in localStorage until the user
// authenticates — this endpoint inserts an xp_events row so the dashboard
// reflects the same total.
//
// Insert requires admin privileges (see migration 014 RLS), so we use the
// service-role client to write on behalf of the authenticated student.
// Idempotent: users can only claim signup_bonus once — the server caps total
// landing XP ever credited per user at LANDING_XP_CAP.

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const LANDING_XP_CAP = 200
const LANDING_LEVEL_CAP = 8

const bodySchema = z.object({
  xp: z.number().int().min(1).max(LANDING_XP_CAP),
  level: z.number().int().min(0).max(LANDING_LEVEL_CAP).optional(),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Check how much landing XP has already been credited so we never exceed the cap.
  const { data: priorEvents, error: priorError } = await admin
    .from('xp_events')
    .select('amount')
    .eq('user_id', user.id)
    .eq('source_type', 'signup_bonus')

  if (priorError) {
    console.error('[claim-landing-xp] prior events query failed:', priorError)
    return NextResponse.json({ error: 'Не удалось проверить прогресс' }, { status: 500 })
  }

  const alreadyCredited = (priorEvents ?? []).reduce((acc, row) => acc + (row.amount ?? 0), 0)
  const remaining = LANDING_XP_CAP - alreadyCredited

  if (remaining <= 0) {
    return NextResponse.json({
      credited: 0,
      already_credited: alreadyCredited,
      cap: LANDING_XP_CAP,
      message: 'Лимит XP с лендинга уже начислен',
    })
  }

  const amountToCredit = Math.min(parsed.data.xp, remaining)

  const { error: insertError } = await admin.from('xp_events').insert({
    user_id: user.id,
    amount: amountToCredit,
    source_type: 'signup_bonus',
    description: `Landing XP (level ${parsed.data.level ?? 0})`,
    metadata: {
      landing_level: parsed.data.level ?? 0,
      requested_amount: parsed.data.xp,
    },
  })

  if (insertError) {
    console.error('[claim-landing-xp] insert failed:', insertError)
    return NextResponse.json({ error: 'Не удалось начислить XP' }, { status: 500 })
  }

  return NextResponse.json({
    credited: amountToCredit,
    already_credited: alreadyCredited,
    cap: LANDING_XP_CAP,
  })
}
