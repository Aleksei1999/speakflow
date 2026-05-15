'use client'

// MFA TOTP enrollment section.
//
// Used inside the settings page (Безопасность) for users who want — or
// must — set up a second factor. Required for admins when
// ENABLE_ADMIN_MFA_ENFORCE='1' (middleware redirects /admin/* until they
// finish enrollment); optional for everyone else for now.
//
// Flow:
//   1) "Включить" → supabase.auth.mfa.enroll({ factorType: 'totp' })
//      → returns factorId + a `totp.qr_code` data URL + plain `totp.secret`
//   2) User scans QR (or types secret) in their authenticator app
//   3) User types the 6-digit code → mfa.challengeAndVerify({ factorId, code })
//   4) On success — list verified factors with an "Отключить" button each.
//
// We deliberately keep this UI minimal and inline (no portals, no toasts of
// our own, no animations) so it works the same in /student/settings,
// /teacher/settings and /admin/settings — all three currently re-export
// the same page.
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
  const [factors, setFactors] = useState<Factor[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [enroll, setEnroll] = useState<EnrollState>({ phase: 'idle' })

  const loadFactors = useCallback(async () => {
    setLoadError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) {
        setLoadError(error.message || 'Не удалось загрузить факторы')
        return
      }
      // We only care about TOTP factors here. Verified ones are the
      // "active" set; unverified ones are stale enrollments that never
      // completed — surface them too so the user can clean up.
      const all = [...(data.totp ?? []), ...(data.all ?? [])]
      // Dedup by id in case both arrays returned the same factor.
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
      setLoadError(e instanceof Error ? e.message : 'Ошибка сети')
    }
  }, [])

  useEffect(() => {
    void loadFactors()
  }, [loadFactors])

  const startEnroll = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `TOTP · ${new Date().toLocaleDateString('ru-RU')}`,
    })
    if (error || !data) {
      // Common case: a previous enrollment attempt is still pending.
      // Supabase responds with 422 — refresh the list so the user can
      // unenroll the stale factor and retry.
      toast.error(error?.message || 'Не удалось начать настройку TOTP')
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
  }, [loadFactors])

  const cancelEnroll = useCallback(async () => {
    if (enroll.phase !== 'enrolling') return
    // Drop the pending unverified factor from auth.mfa_factors so it
    // doesn't pile up. Errors here are non-fatal — we still reset UI.
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
      setEnroll({ ...enroll, error: 'Введите 6 цифр' })
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
          ? 'Неверный код — проверь, что время на устройстве синхронизировано'
          : error.message || 'Не удалось подтвердить код',
      })
      return
    }
    setEnroll({ phase: 'idle' })
    toast.success('Двухфакторная аутентификация включена')
    void loadFactors()
  }, [enroll, loadFactors])

  const unenroll = useCallback(
    async (factorId: string) => {
      if (!confirm('Отключить двухфакторную аутентификацию?')) return
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) {
        toast.error(error.message || 'Не удалось отключить фактор')
        return
      }
      toast.success('Фактор отключён')
      void loadFactors()
    },
    [loadFactors],
  )

  const verified = (factors ?? []).filter((f) => f.status === 'verified')
  const unverified = (factors ?? []).filter((f) => f.status !== 'verified')

  return (
    <div className="s-card" id="sec-mfa">
      <div className="s-card-head">
        <h3>Двухфакторная аутентификация</h3>
        <p>
          Дополнительный код из приложения-аутентификатора при входе. Защищает
          аккаунт даже если пароль утёк.
        </p>
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
            Двухфакторная аутентификация обязательна для администраторов.
            Настрой TOTP, чтобы вернуться в админку.
          </div>
        )}

        {loadError && (
          <div className="s-field" style={{ color: 'var(--red)' }}>
            {loadError}
          </div>
        )}

        {factors === null ? (
          <div className="s-field" style={{ color: 'var(--muted)' }}>
            Загружаем…
          </div>
        ) : (
          <>
            {verified.map((f) => (
              <div className="s-field" key={f.id}>
                <div className="s-field-left">
                  <div className="s-field-label">
                    {f.friendly_name || 'TOTP-аутентификатор'}
                  </div>
                  <div className="s-field-desc">
                    Активен · приложение генерирует 6-значный код
                  </div>
                </div>
                <button
                  type="button"
                  className="s-btn s-btn--danger"
                  onClick={() => void unenroll(f.id)}
                >
                  Отключить
                </button>
              </div>
            ))}

            {/* Stale unverified factors — let the user clear them. */}
            {unverified.map((f) => (
              <div className="s-field" key={f.id}>
                <div className="s-field-left">
                  <div className="s-field-label">
                    {f.friendly_name || 'TOTP-аутентификатор'}
                  </div>
                  <div className="s-field-desc" style={{ color: 'var(--red)' }}>
                    Не подтверждён — удалите и попробуйте снова
                  </div>
                </div>
                <button
                  type="button"
                  className="s-btn s-btn--outline"
                  onClick={() => void unenroll(f.id)}
                >
                  Удалить
                </button>
              </div>
            ))}

            {enroll.phase === 'idle' && (
              <div className="s-field">
                <div className="s-field-left">
                  <div className="s-field-label">Подключить TOTP</div>
                  <div className="s-field-desc">
                    Google Authenticator, 1Password, Authy, Raivo — любое
                    приложение-аутентификатор
                  </div>
                </div>
                <button
                  type="button"
                  className="s-btn s-btn--red"
                  onClick={() => void startEnroll()}
                >
                  {verified.length > 0 ? 'Добавить ещё' : 'Включить'}
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
                  1. Открой приложение-аутентификатор<br />
                  2. Отсканируй QR-код или введи секрет вручную<br />
                  3. Введи 6-значный код, который покажет приложение
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <img
                    src={enroll.qrCodeDataUrl}
                    alt="QR-код для аутентификатора"
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
                      Секрет (на случай если QR не считывается):
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
                    placeholder="123456"
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
                    {enroll.busy ? 'Проверяем…' : 'Подтвердить'}
                  </button>
                  <button
                    type="button"
                    className="s-btn s-btn--outline"
                    onClick={() => void cancelEnroll()}
                    disabled={enroll.busy}
                  >
                    Отмена
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
