// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/onboarding/complete  → помечает текущего юзера как прошедшего тур.
// POST /api/onboarding/complete?reset=1 → сбрасывает (для дебага в /settings).
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const reset = url.searchParams.get('reset') === '1'

  const update = reset
    ? { onboarding_step: 'pending', onboarding_completed_at: null }
    : { onboarding_step: 'completed', onboarding_completed_at: new Date().toISOString() }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
