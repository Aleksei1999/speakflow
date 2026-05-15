"use client"

// Красивая замена window.confirm() для destructive / важных действий.
// На мобиле нативные диалоги выглядят как системный alert и пробивают
// брендинг — этот компонент даёт единый UX: backdrop + карточка с двумя
// кнопками + a11y (aria-modal, Escape, focus trap через useModalA11y).
//
// API — controlled. В родителе держишь:
//   const [confirm, setConfirm] = useState<ConfirmOpts | null>(null)
// и рендеришь <ConfirmDialog open={!!confirm} {...confirm} ... />.
// Императивная обёртка useConfirm() сверху для удобства.

import { useCallback, useState } from "react"
import { useModalA11y } from "@/hooks/use-modal-a11y"

export type ConfirmOpts = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type Props = ConfirmOpts & {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

const STYLES = `
.cdlg-bd{position:fixed;inset:0;z-index:1000;background:rgba(10,10,10,.5);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:20px;animation:cdlg-fade .15s ease both}
.cdlg-bd .box{background:var(--surface,#fff);color:var(--text,#0A0A0A);border-radius:20px;padding:24px;max-width:380px;width:100%;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,.25);animation:cdlg-pop .18s cubic-bezier(.16,1,.3,1) both}
.cdlg-bd h3{font-size:17px;font-weight:800;letter-spacing:-.3px;margin:0;line-height:1.3}
.cdlg-bd p{font-size:14px;color:var(--muted,#8A8A86);line-height:1.5;margin:0}
.cdlg-bd .actions{display:flex;gap:10px;margin-top:6px}
.cdlg-bd .actions button{flex:1;padding:11px 14px;border-radius:12px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;border:0;transition:transform .1s ease,filter .15s ease}
.cdlg-bd .actions button:active{transform:scale(.97)}
.cdlg-bd .actions .cdlg-cancel{background:var(--bg,#F5F5F3);color:var(--text,#0A0A0A);border:1px solid var(--border,#EEEEEA)}
.cdlg-bd .actions .cdlg-cancel:hover{background:var(--surface-2,#FAFAF7)}
.cdlg-bd .actions .cdlg-ok{background:var(--black,#0A0A0A);color:#fff}
.cdlg-bd .actions .cdlg-ok:hover{filter:brightness(1.15)}
.cdlg-bd .actions .cdlg-ok.danger{background:var(--red,#B63F37)}
.cdlg-bd .actions .cdlg-ok.danger:hover{filter:brightness(.95)}
@keyframes cdlg-fade{from{opacity:0}to{opacity:1}}
@keyframes cdlg-pop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
@media(max-width:640px){
  .cdlg-bd{padding:16px;align-items:flex-end}
  .cdlg-bd .box{max-width:100%;border-radius:20px 20px 16px 16px;padding-bottom:max(24px,env(safe-area-inset-bottom))}
  .cdlg-bd .actions{flex-direction:column-reverse}
}
`

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useModalA11y(open, onCancel)
  if (!open) return null
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div
        className="cdlg-bd"
        role="presentation"
        onClick={(e) => {
          // Клик по backdrop'у (вне карточки) = cancel
          if (e.target === e.currentTarget) onCancel()
        }}
      >
        <div
          ref={ref}
          className="box"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cdlg-title"
          aria-describedby={message ? "cdlg-msg" : undefined}
        >
          <h3 id="cdlg-title">{title}</h3>
          {message && <p id="cdlg-msg">{message}</p>}
          <div className="actions">
            <button
              type="button"
              className="cdlg-cancel"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`cdlg-ok${danger ? " danger" : ""}`}
              onClick={onConfirm}
              autoFocus
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Imperative-стайл хук для замены window.confirm():
//   const { confirm, dialogProps } = useConfirm()
//   ...
//   const ok = await confirm({ title: "Удалить?", danger: true })
//   if (ok) { ... }
//   // в JSX:
//   <ConfirmDialog {...dialogProps} />
// ─────────────────────────────────────────────────────────────────────

type PendingState = {
  opts: ConfirmOpts
  resolve: (value: boolean) => void
} | null

export function useConfirm() {
  const [pending, setPending] = useState<PendingState>(null)

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ opts, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    pending?.resolve(true)
    setPending(null)
  }, [pending])

  const handleCancel = useCallback(() => {
    pending?.resolve(false)
    setPending(null)
  }, [pending])

  const dialogProps: Props = {
    open: !!pending,
    title: pending?.opts.title ?? "",
    message: pending?.opts.message,
    confirmLabel: pending?.opts.confirmLabel,
    cancelLabel: pending?.opts.cancelLabel,
    danger: pending?.opts.danger,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  }

  return { confirm, dialogProps }
}
