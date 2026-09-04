"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

const LS_KEYS = {
  mic: "speakflow.lesson.mic",
  speaker: "speakflow.lesson.speaker",
  camera: "speakflow.lesson.camera",
} as const

type Kind = keyof typeof LS_KEYS

interface Device {
  deviceId: string
  label: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect?: (kind: Kind, deviceId: string) => void
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1E1E1E" />
      <path
        d="M6 12.5l4 4 8-9"
        stroke="#FFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <path
        d="M2 2l16 16M18 2L2 18"
        stroke="#1E1E1E"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function fallbackLabel(kind: Kind, idx: number): string {
  const base = kind === "mic" ? "Микрофон" : kind === "speaker" ? "Динамик" : "Камера"
  return `${base} ${idx + 1}`
}

function readLs(kind: Kind): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(LS_KEYS[kind])
  } catch {
    return null
  }
}

function writeLs(kind: Kind, id: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LS_KEYS[kind], id)
  } catch {
    /* quota / private mode — молча игнорируем */
  }
}

export default function SettingsModal({ open, onClose, onSelect }: Props) {
  const [mics, setMics] = useState<Device[]>([])
  const [speakers, setSpeakers] = useState<Device[]>([])
  const [cameras, setCameras] = useState<Device[]>([])
  const [selected, setSelected] = useState<Record<Kind, string | null>>({
    mic: null,
    speaker: null,
    camera: null,
  })
  const [labelsBlank, setLabelsBlank] = useState(false)
  const [apiMissing, setApiMissing] = useState(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setSelected({
      mic: readLs("mic"),
      speaker: readLs("speaker"),
      camera: readLs("camera"),
    })
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : null
    if (!md?.enumerateDevices) {
      setApiMissing(true)
      return
    }
    setApiMissing(false)
    md.enumerateDevices()
      .then((all) => {
        if (!mounted.current) return
        const toDev = (d: MediaDeviceInfo, idx: number, kind: Kind): Device => ({
          deviceId: d.deviceId,
          label: d.label || fallbackLabel(kind, idx),
        })
        const audioIn = all.filter((d) => d.kind === "audioinput")
        const audioOut = all.filter((d) => d.kind === "audiooutput")
        const videoIn = all.filter((d) => d.kind === "videoinput")
        setMics(audioIn.map((d, i) => toDev(d, i, "mic")))
        setSpeakers(audioOut.map((d, i) => toDev(d, i, "speaker")))
        setCameras(videoIn.map((d, i) => toDev(d, i, "camera")))
        const allBlank = [...audioIn, ...audioOut, ...videoIn].every(
          (d) => !d.label,
        )
        setLabelsBlank(allBlank && (audioIn.length + audioOut.length + videoIn.length) > 0)
      })
      .catch(() => {
        if (!mounted.current) return
        setApiMissing(true)
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const pick = (kind: Kind, id: string) => {
    setSelected((s) => ({ ...s, [kind]: id }))
    writeLs(kind, id)
    onSelect?.(kind, id)
  }

  const groups = useMemo(
    () =>
      [
        { kind: "mic" as const, title: "Выберите микрофон", items: mics },
        { kind: "speaker" as const, title: "Выберите динамик", items: speakers },
        { kind: "camera" as const, title: "Выберите камеру", items: cameras },
      ],
    [mics, speakers, cameras],
  )

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="vc-settings-backdrop" onClick={onClose}>
      <div
        className="vc-settings"
        role="dialog"
        aria-modal="true"
        aria-label="Настройки устройств"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="vc-settings-close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
        {apiMissing && (
          <div className="vc-settings-hint">Браузер не поддерживает выбор устройств.</div>
        )}
        {labelsBlank && !apiMissing && (
          <div className="vc-settings-hint">
            Разрешите доступ к камере и микрофону, чтобы увидеть названия устройств.
          </div>
        )}
        {groups.map((g) => (
          <div key={g.kind} className="vc-settings-group">
            <div className="vc-settings-group-title">{g.title}</div>
            {g.items.length === 0 && !apiMissing && (
              <div className="vc-settings-empty">Устройства не найдены</div>
            )}
            {g.items.map((d) => {
              const active = selected[g.kind] === d.deviceId
              return (
                <button
                  key={d.deviceId || d.label}
                  type="button"
                  className={`vc-settings-option${active ? " vc-settings-option--selected" : ""}`}
                  onClick={() => pick(g.kind, d.deviceId)}
                >
                  <span>{d.label}</span>
                  {active && (
                    <span className="vc-settings-check">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
