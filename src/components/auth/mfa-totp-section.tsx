'use client'

// MFA TOTP enrollment section.
//
// Used inside the settings page (Security) for users who want — or
// must — set up a second factor. Required for admins when
// ENABLE_ADMIN_MFA_ENFORCE='1' (middleware redirects /admin/* until they
// finish enrollment); optional for everyone else for now.
//
// Strings live in messages/{ru,en}.json under
// `dashboard.student.settings.mfa.*` via next-intl.
//
// SECURITY NOTES:
//   - We never display the TOTP secret in plaintext beyond the moment
//     enrollment is active. As soon as the user verifies (or cancels), the
//     secret + QR are dropped from React state.
//   - We do NOT log factorId, secret, QR, code anywhere — not to console,
//     not to Sentry. The Supabase SDK call already handles transport.
//   - Unenroll is gated by Supabase's own checks (re-auth in last N min for
//     AAL2 sessions, etc.) — we just surface the SDK error if any.

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

type Factor = {
  id: string
  friendly_name: string | null
  factor_type: string
  status: string
}

type EnrollState =
  | { phase: 'idle' }
  | {
      phase: 'enrolling'
      factorId: string
      qrCodeDataUrl: string
      secret: string
      code: string
      busy: boolean
      error: string | null
    }

export function MfaTotpSection({
  /**
   * When true, the section gets a small red banner explaining MFA is
   * REQUIRED. Mirrors the `?mfa=required` query flag set by middleware
   * after a soft-redirect.
   */
  required = false,
}: {
  required?: boolean
}) {
  const t = useTranslations('dashboard.student.settings.mfa')
  const locale = useLocale()
  const [factors, setFactors] = useState<Factor[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [enroll, setEnroll] = useState<EnrollState>({ phase: 'idle' })

  const loadFactors = useCallback(async () => {
    setLoadError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) {
        setLoadError(error.message || t('loadFactorsFail'))
        return
      }
      const all = [...(data.totp ?? []), ...(data.all ?? [])]
      const byId = new Map<string, Factor>()
      for (const f of all) {
        if (f.factor_type !== 'totp') continue
        byId.set(f.id, {
          id: f.id,
          friendly_name: f.friendly_name ?? null,
          factor_type: f.factor_type,
          status: f.status,
        })
      }
      setFactors([...byId.values()])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('networkError'))
    }
  }, [t])

  useEffect(() => {
    void loadFactors()
  }, [loadFactors])

  const startEnroll = useCallback(async () => {
    const supabase = createClient()
    const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU'
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `${t('friendlyNamePrefix')} · ${new Date().toLocaleDateString(dateLocale)}`,
    })
    if (error || !data) {
      toast.error(error?.message || t('enrollStartFail'))
      await loadFactors()
      return
    }
    setEnroll({
      phase: 'enrolling',
      factorId: data.id,
      qrCodeDataUrl: data.totp.qr_code,
      secret: data.totp.secret,
      code: '',
      busy: false,
      error: null,
    })
  }, [loadFactors, locale, t])

  const cancelEnroll = useCallback(async () => {
    if (enroll.phase !== 'enrolling') return
    try {
      const supabase = createClient()
      await supabase.auth.mfa.unenroll({ factorId: enroll.factorId })
    } catch {
      /* no-op */
    }
    setEnroll({ phase: 'idle' })
    void loadFactors()
  }, [enroll, loadFactors])

  const submitCode = useCallback(async () => {
    if (enroll.phase !== 'enrolling') return
    const code = enroll.code.trim()
    if (!/^\d{6}$/.test(code)) {
      setEnroll({ ...enroll, error: t('errorSixDigits') })
      return
    }
    setEnroll({ ...enroll, busy: true, error: null })
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enroll.factorId,
      code,
    })
    if (error) {
      setEnroll({
        ...enroll,
        busy: false,
        error: error.message?.includes('Invalid')
          ? t('errorInvalidCode')
          : error.message || t('errorVerifyFail'),
      })
      return
    }
    setEnroll({ phase: 'idle' })
    toast.success(t('enrolledOk'))
    void loadFactors()
  }, [enroll, loadFactors, t])

  const unenroll = useCallback(
    async (factorId: string) => {
      if (!confirm(t('confirmUnenroll'))) return
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) {
        toast.error(error.message || t('unenrollFail'))
        return
      }
      toast.success(t('factorDisabled'))
      void loadFactors()
    },
    [loadFactors, t],
  )

  const verified = (factors ?? []).filter((f) => f.status === 'verified')
  const unverified = (factors ?? []).filter((f) => f.status !== 'verified')

  return (
    <div className="s-card" id="sec-mfa">
      <div className="s-card-head">
        <h3>{t('title')}</h3>
        <p>{t('subtitle')}</p>
      </div>
      <div className="s-card-body">
        {required && verified.length === 0 && (
          <div
            role="alert"
            style={{
              marginTop: 6,
              marginBottom: 4,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
              background: 'color-mix(in srgb, var(--red) 6%, transparent)',
              color: 'var(--red)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t('requiredBanner')}
          </div>
        )}

        {loadError && (
          <div className="s-field" style={{ color: 'var(--red)' }}>
            {loadError}
          </div>
        )}

        {factors === null ? (
          <div className="s-field" style={{ color: 'var(--muted)' }}>
            {t('loading')}
          </div>
        ) : (
          <>
            {verified.map((f) => (
              <div className="s-field" key={f.id}>
                <div className="s-field-left">
                  <div className="s-field-label">
                    {f.friendly_name || t('defaultName')}
                  </div>
                  <div className="s-field-desc">{t('activeDesc')}</div>
                </div>
                <button
                  type="button"
                  className="s-btn s-btn--danger"
                  onClick={() => void unenroll(f.id)}
                >
                  {t('disable')}
                </button>
              </div>
            ))}

            {/* Stale unverified factors — let the user clear them. */}
            {unverified.map((f) => (
              <div className="s-field" key={f.id}>
                <div className="s-field-left">
                  <div className="s-field-label">
                    {f.friendly_name || t('defaultName')}
                  </div>
                  <div className="s-field-desc" style={{ color: 'var(--red)' }}>
                    {t('unverifiedDesc')}
                  </div>
                </div>
                <button
                  type="button"
                  className="s-btn s-btn--outline"
                  onClick={() => void unenroll(f.id)}
                >
                  {t('remove')}
                </button>
              </div>
            ))}

            {enroll.phase === 'idle' && (
              <div className="s-field">
                <div className="s-field-left">
                  <div className="s-field-label">{t('connectTitle')}</div>
                  <div className="s-field-desc">{t('connectDesc')}</div>
                </div>
                <button
                  type="button"
                  className="s-btn s-btn--red"
                  onClick={() => void startEnroll()}
                >
                  {verified.length > 0 ? t('addMore') : t('enable')}
                </button>
              </div>
            )}

            {enroll.phase === 'enrolling' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  padding: '14px 0',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {t('step1')}<br />
                  {t('step2')}<br />
                  {t('step3')}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <img
                    src={enroll.qrCodeDataUrl}
                    alt={t('qrAlt')}
                    width={180}
                    height={180}
                    style={{
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: '#fff',
                      padding: 6,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                      {t('secretHint')}
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: 13,
                        wordBreak: 'break-all',
                        padding: 10,
                        borderRadius: 8,
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        userSelect: 'all',
                      }}
                    >
                      {enroll.secret}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    className="s-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t('codePlaceholder')}
                    maxLength={6}
                    value={enroll.code}
                    onChange={(e) =>
                      setEnroll({
                        ...enroll,
                        code: e.target.value.replace(/\D/g, '').slice(0, 6),
                        error: null,
                      })
                    }
                    style={{ width: 140, letterSpacing: 4, fontSize: 18, textAlign: 'center' }}
                    disabled={enroll.busy}
                  />
                  <button
                    type="button"
                    className="s-btn s-btn--save"
                    onClick={() => void submitCode()}
                    disabled={enroll.busy || enroll.code.length !== 6}
                  >
                    {enroll.busy ? t('verifying') : t('verify')}
                  </button>
                  <button
                    type="button"
                    className="s-btn s-btn--outline"
                    onClick={() => void cancelEnroll()}
                    disabled={enroll.busy}
                  >
                    {t('cancel')}
                  </button>
                </div>
                {enroll.error && (
                  <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>
                    {enroll.error}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
