// ---------------------------------------------------------------
// Audit logging helper.
//
// Writes go through the SECURITY DEFINER RPC `public.audit_log_event`
// (proxy → `audit.log_event`). Only service_role can call it, so we
// always use the admin Supabase client.
//
// Failure mode: NEVER block the calling endpoint. If the RPC errors,
// we console.warn and swallow — the original API response must succeed.
//
// Example usage:
//   import { logAuditEvent } from '@/lib/audit/log'
//   ...
//   await logAuditEvent(request, {
//     category: 'payment',
//     action: 'payment_created',
//     target_type: 'lessons',
//     target_id: lessonId,
//     payload: { amount_kopecks: lesson.price, currency: 'RUB' },
//   })
// ---------------------------------------------------------------

import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp } from '@/lib/api/rate-limit'

export type AuditCategory = 'auth' | 'admin' | 'payment' | 'data'

export type AuditEvent = {
  category: AuditCategory
  /** snake_case, ≤80 chars, e.g. 'signin', 'payment_created', 'webhook_payment_succeeded' */
  action: string
  /** Logical entity type ('lessons', 'payments', 'auth.users', 'profiles', ...) */
  target_type?: string | null
  /** Entity id stringified (uuid, bigint, slug — anything). */
  target_id?: string | null
  /** Arbitrary structured detail. */
  payload?: Record<string, unknown> | null
  /** Optional override for actor IP — defaults to getClientIp(req). */
  ip?: string | null
  /** Optional override for User-Agent — defaults to req header. */
  userAgent?: string | null
  /** Correlation id (Vercel x-vercel-id / Sentry trace / our own). */
  requestId?: string | null
}

/**
 * Logical max for inet column — IPv6 textual form is 39, plus zone id ~10.
 * Anything weirder we drop to null (avoid INSERT error from CHECK on inet).
 */
function safeInet(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (!v || v === 'unknown') return null
  // Best-effort: postgres `inet` accepts both IPv4 and IPv6. We don't
  // try to fully validate — if the cast fails server-side, the RPC will
  // error and we'll swallow it. But we drop empty/obvious junk early.
  if (v.length > 64) return null
  return v
}

function resolveRequestId(req: NextRequest | Request): string | null {
  // Vercel: x-vercel-id. Cloudflare: cf-ray. Internal: x-request-id.
  const h = (req as any).headers as Headers | undefined
  if (!h?.get) return null
  return (
    h.get('x-vercel-id') ??
    h.get('cf-ray') ??
    h.get('x-request-id') ??
    null
  )
}

/**
 * Fire-and-forget audit log write. Never throws.
 *
 * Returns the inserted row id on success, or null on any failure.
 */
export async function logAuditEvent(
  req: NextRequest | Request,
  evt: AuditEvent
): Promise<number | null> {
  try {
    // getClientIp expects NextRequest, but it only reads headers — works
    // with a vanilla Request too. Cast is intentional.
    const ip = safeInet(evt.ip ?? getClientIp(req as NextRequest))
    const ua =
      evt.userAgent ??
      (req.headers.get('user-agent')?.slice(0, 512) ?? null)
    const requestId = evt.requestId ?? resolveRequestId(req)

    const admin = createAdminClient()
    // Postgrest RPC: function lives in public, args lower-snake_case to
    // match SQL signature. supabase-js types likely don't know about this
    // custom RPC yet → cast.
    const { data, error } = await (admin.rpc as any)('audit_log_event', {
      p_category: evt.category,
      p_action: evt.action,
      p_target_type: evt.target_type ?? null,
      p_target_id: evt.target_id ?? null,
      p_payload: evt.payload ?? null,
      p_ip: ip,
      p_user_agent: ua,
      p_request_id: requestId,
    })

    if (error) {
      console.warn(
        `[audit] log failed (${evt.category}/${evt.action}):`,
        error.message
      )
      return null
    }
    return typeof data === 'number' ? data : null
  } catch (err) {
    console.warn(
      `[audit] log threw (${evt.category}/${evt.action}):`,
      (err as Error)?.message ?? err
    )
    return null
  }
}
