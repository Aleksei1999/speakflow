'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface JitsiRoomProps {
  domain: string
  roomName: string
  token: string
  displayName: string
  onConferenceLeft?: () => void
  onParticipantJoined?: (participant: { id: string; displayName: string }) => void
  onParticipantLeft?: (participant: { id: string }) => void
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (
      domain: string,
      options: Record<string, unknown>
    ) => JitsiMeetInstance
  }
}

interface JitsiMeetInstance {
  dispose: () => void
  executeCommand: (command: string, ...args: unknown[]) => void
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => void
  removeEventListener: (event: string, handler: (...args: unknown[]) => void) => void
  getNumberOfParticipants: () => number
}

export function JitsiRoom({
  domain,
  roomName,
  token,
  displayName,
  onConferenceLeft,
  onParticipantJoined,
  onParticipantLeft,
}: JitsiRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<JitsiMeetInstance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleConferenceLeft = useCallback(() => {
    onConferenceLeft?.()
  }, [onConferenceLeft])

  const handleParticipantJoined = useCallback(
    (participant: unknown) => {
      const p = participant as { id?: string; displayName?: string }
      if (p.id) {
        onParticipantJoined?.({ id: p.id, displayName: p.displayName ?? '' })
      }
    },
    [onParticipantJoined]
  )

  const handleParticipantLeft = useCallback(
    (participant: unknown) => {
      const p = participant as { id?: string }
      if (p.id) {
        onParticipantLeft?.({ id: p.id })
      }
    },
    [onParticipantLeft]
  )

  useEffect(() => {
    if (!domain || !roomName || !token) return

    let disposed = false

    async function loadJitsi() {
      // Загружаем скрипт Jitsi API, если он ещё не загружен
      if (!window.JitsiMeetExternalAPI) {
        try {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = `https://${domain}/external_api.js`
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Не удалось загрузить Jitsi'))
            document.head.appendChild(script)
          })
        } catch (err) {
          if (!disposed) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки')
            setIsLoading(false)
          }
          return
        }
      }

      if (disposed || !containerRef.current) return

      try {
        const api = new window.JitsiMeetExternalAPI(domain, {
          roomName,
          jwt: token,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            // Отключаем лобби -- управление доступом через JWT
            lobby: { enabled: false },
            // Безопасность: запрещаем гостей без JWT
            enableInsecureRoomNameWarning: false,
            prejoinPageEnabled: false,
            // Запись доступна для модератора
            fileRecordingsEnabled: true,
            localRecording: { enabled: true },
            // Качество
            resolution: 720,
            constraints: {
              video: { height: { ideal: 720, max: 720, min: 360 } },
            },
            // Интерфейс
            disableDeepLinking: true,
            hideConferenceSubject: true,
            hideConferenceTimer: false,
            disableInviteFunctions: true,
            // Тулбар
            toolbarButtons: [
              'camera',
              'chat',
              'desktop',
              'fullscreen',
              'hangup',
              'microphone',
              'participants-pane',
              'profile',
              'raisehand',
              'recording',
              'select-background',
              'settings',
              'tileview',
              'toggle-camera',
            ],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: '#1a1a2e',
            TOOLBAR_ALWAYS_VISIBLE: true,
            DISABLE_FOCUS_INDICATOR: true,
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true,
          },
          userInfo: {
            displayName,
          },
        })

        apiRef.current = api

        api.addEventListener('videoConferenceJoined', () => {
          if (!disposed) setIsLoading(false)
        })

        api.addEventListener('videoConferenceLeft', handleConferenceLeft)
        api.addEventListener('participantJoined', handleParticipantJoined)
        api.addEventListener('participantLeft', handleParticipantLeft)
      } catch (err) {
        if (!disposed) {
          setError('Не удалось инициализировать видеоконференцию')
          setIsLoading(false)
          console.error('[JitsiRoom] Init error:', err)
        }
      }
    }

    loadJitsi()

    return () => {
      disposed = true
      if (apiRef.current) {
        try {
          apiRef.current.dispose()
        } catch {
          // Игнорируем ошибки при очистке
        }
        apiRef.current = null
      }
    }
  }, [domain, roomName, token, displayName, handleConferenceLeft, handleParticipantJoined, handleParticipantLeft])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-red-500/10 p-4">
            <svg className="size-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-white">{error}</p>
          <p className="text-sm text-gray-400">Попробуйте обновить страницу</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
          <div className="flex flex-col items-center gap-4">
            <div className="size-10 animate-spin rounded-full border-4 border-gray-700 border-t-[#722F37]" />
            <p className="text-sm text-gray-400">Подключение к видеоконференции...</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
