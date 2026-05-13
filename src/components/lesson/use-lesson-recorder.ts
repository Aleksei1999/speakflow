"use client"
// Phase 1.2 — авто-запись урока в браузере.
//
// Что делает:
// 1. Получает getUserMedia({audio:true}) для текущей роли (teacher
//    или student). Браузер кеширует разрешение для origin, поэтому
//    prompt появляется максимум один раз на устройство.
// 2. Teacher вызывает POST /api/lesson/recording/init → получает
//    recordingId. Student опрашивает GET .../active каждые 4 сек
//    пока teacher не создаст запись.
// 3. MediaRecorder с timeslice ~20 сек шлёт blob'ы в очередь.
//    Uploader последовательно: chunk-url → PUT signedUrl.
// 4. При mute в Jitsi (audioMuteStatusChanged) — pause()/resume().
// 5. На unmount / beforeunload — stop(), доуплоадить хвост, POST
//    /finalize.
//
// Hook никогда не падает в UI: все ошибки уходят в state.error и в
// console.warn — урок важнее саммари.

import { useEffect, useRef, useState } from "react"

type Status = "idle" | "starting" | "recording" | "paused" | "stopping" | "stopped" | "error"

interface UseLessonRecorderArgs {
  lessonId: string
  isTeacher: boolean
  /** Jitsi External API инстанс — нужен только для подписки на mute */
  jitsiApi: any
  /** Можно полностью выключить (например в Storybook / preview) */
  enabled?: boolean
  /** Колбэк когда запись фактически стартовала (для toast'а) */
  onStarted?: () => void
  /**
   * Любое изменение этого значения форсит перезапуск hook'а
   * (новый getUserMedia, новый MediaRecorder). Используется когда
   * мы хотим повторить попытку получить mic после отказа.
   */
  retryToken?: number
}

interface UseLessonRecorderReturn {
  status: Status
  error: string | null
  recordingId: string | null
}

const TIMESLICE_MS = 20_000 // 20-сек куски — компромисс между латентностью upload'а и количеством запросов
const STUDENT_POLL_INTERVAL_MS = 4_000
const STUDENT_POLL_TIMEOUT_MS = 5 * 60_000 // ждём teacher'а до 5 минут — он может задержаться
const SUPPORTED_MIME = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
]

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null
  for (const m of SUPPORTED_MIME) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m
    } catch {
      /* ignore */
    }
  }
  return null
}

export function useLessonRecorder({
  lessonId,
  isTeacher,
  jitsiApi,
  enabled = true,
  onStarted,
  retryToken = 0,
}: UseLessonRecorderArgs): UseLessonRecorderReturn {
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [recordingId, setRecordingId] = useState<string | null>(null)

  // refs — стейт-машина должна переживать ре-рендеры, не сбрасываясь
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const queueRef = useRef<Blob[]>([])
  const seqRef = useRef(0)
  const uploadingRef = useRef(false)
  const totalBytesRef = useRef(0)
  const startedAtRef = useRef<number>(0)
  const mimeRef = useRef<string>("")
  const recordingIdRef = useRef<string | null>(null)
  const teardownStartedRef = useRef(false)
  const startedFiredRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return

    let cancelled = false

    // Reset state-machine на каждый run (особенно важно при retry —
    // teardownStartedRef мог остаться true от прошлой попытки и
    // блокировал бы новый start).
    teardownStartedRef.current = false
    startedFiredRef.current = false
    uploadingRef.current = false
    queueRef.current = []
    seqRef.current = 0
    totalBytesRef.current = 0
    recordingIdRef.current = null
    setRecordingId(null)

    const mime = pickMimeType()
    if (!mime) {
      console.warn("[lesson-recorder] браузер не поддерживает MediaRecorder — запись пропущена")
      setStatus("error")
      setError("Браузер не поддерживает запись")
      return
    }
    mimeRef.current = mime

    async function resolveRecordingId(): Promise<string | null> {
      if (isTeacher) {
        try {
          const r = await fetch("/api/lesson/recording/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessonId }),
          })
          if (!r.ok) {
            console.warn("[lesson-recorder] init failed:", r.status, await r.text().catch(() => ""))
            return null
          }
          const j = await r.json()
          return j.recordingId ?? null
        } catch (e) {
          console.warn("[lesson-recorder] init exception:", e)
          return null
        }
      }

      // student: polling
      const startedAt = Date.now()
      while (!cancelled && Date.now() - startedAt < STUDENT_POLL_TIMEOUT_MS) {
        try {
          const r = await fetch(`/api/lesson/recording/active?lessonId=${lessonId}`, {
            cache: "no-store",
          })
          if (r.ok) {
            const j = await r.json()
            if (j?.active && j.recordingId) return j.recordingId as string
          }
        } catch {
          /* транзиентно, продолжаем */
        }
        await new Promise((res) => setTimeout(res, STUDENT_POLL_INTERVAL_MS))
      }
      return null
    }

    async function uploadOne(blob: Blob, seq: number, recId: string) {
      // 1. signed URL
      const urlRes = await fetch("/api/lesson/recording/chunk-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          recordingId: recId,
          seq,
          mimeType: mimeRef.current,
        }),
      })
      if (!urlRes.ok) {
        const t = await urlRes.text().catch(() => "")
        throw new Error(`chunk-url ${urlRes.status} ${t}`)
      }
      const { signedUrl, token } = await urlRes.json()
      if (!signedUrl) throw new Error("no signedUrl")

      // 2. PUT в Storage. Supabase signed upload URL ожидает либо
      //    Authorization: Bearer <token>, либо x-upsert.
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mimeRef.current,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "x-upsert": "true",
        },
        body: blob,
      })
      if (!putRes.ok) {
        const t = await putRes.text().catch(() => "")
        throw new Error(`storage PUT ${putRes.status} ${t}`)
      }
      totalBytesRef.current += blob.size
    }

    async function drainQueue(recId: string) {
      if (uploadingRef.current) return
      uploadingRef.current = true
      try {
        while (queueRef.current.length > 0) {
          const blob = queueRef.current.shift()!
          const seq = seqRef.current++
          try {
            await uploadOne(blob, seq, recId)
            if (!startedFiredRef.current) {
              startedFiredRef.current = true
              onStarted?.()
            }
          } catch (e: any) {
            // Чанк потерян — лучше идти дальше, чем заблокировать
            // recorder. На финальной фазе саммари мы простим дырки.
            console.warn("[lesson-recorder] chunk upload failed:", e?.message ?? e)
          }
        }
      } finally {
        uploadingRef.current = false
      }
    }

    async function start() {
      setStatus("starting")
      setError(null)

      // mic. Браузер запросит permission ОДИН раз для этого origin'а.
      // Echo cancellation / noise suppression — стандарт для Web RTC.
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        })
      } catch (e: any) {
        console.warn("[lesson-recorder] getUserMedia denied/failed:", e?.message ?? e)
        setStatus("error")
        // Конкретизируем причину — UI это покажет учителю, ничего
        // молча не глотаем.
        const name = e?.name ?? ""
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("Браузер заблокировал микрофон. Разреши доступ в адресной строке и обнови страницу.")
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("Микрофон не найден. Подключи микрофон и обнови страницу.")
        } else if (name === "NotReadableError") {
          setError("Микрофон занят другим приложением. Закрой Zoom/Skype и обнови страницу.")
        } else {
          setError("Не удалось получить доступ к микрофону")
        }
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream

      const recId = await resolveRecordingId()
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      if (!recId) {
        console.warn("[lesson-recorder] не получили recordingId — запись пропущена")
        setStatus("error")
        setError("Не удалось инициировать запись")
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      recordingIdRef.current = recId
      setRecordingId(recId)

      let rec: MediaRecorder
      try {
        rec = new MediaRecorder(stream, { mimeType: mimeRef.current })
      } catch (e: any) {
        console.warn("[lesson-recorder] new MediaRecorder failed:", e?.message ?? e)
        setStatus("error")
        setError("Не удалось создать recorder")
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      recRef.current = rec

      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          queueRef.current.push(ev.data)
          void drainQueue(recId)
        }
      }
      rec.onerror = (ev: any) => {
        console.warn("[lesson-recorder] recorder error:", ev?.error ?? ev)
      }

      startedAtRef.current = Date.now()
      rec.start(TIMESLICE_MS)
      setStatus("recording")
    }

    async function teardown() {
      if (teardownStartedRef.current) return
      teardownStartedRef.current = true
      setStatus("stopping")

      const rec = recRef.current
      if (rec && rec.state !== "inactive") {
        await new Promise<void>((res) => {
          const prev = rec.onstop
          rec.onstop = (ev) => {
            try {
              if (typeof prev === "function") (prev as any).call(rec, ev)
            } catch {
              /* ignore */
            }
            res()
          }
          try {
            rec.stop()
          } catch {
            res()
          }
        })
      }

      streamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {
          /* ignore */
        }
      })

      // Доуплоадить хвост из очереди (последний chunk и любые задержавшиеся)
      const recId = recordingIdRef.current
      if (recId) {
        try {
          await drainQueue(recId)
        } catch {
          /* ignore */
        }

        // Finalize. Если не получилось — оставляем status='recording',
        // другой участник или ручной cleanup закроют.
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        )
        try {
          await fetch("/api/lesson/recording/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lessonId,
              recordingId: recId,
              durationSec,
              totalBytes: totalBytesRef.current,
              chunksCount: Math.max(1, seqRef.current),
            }),
          })
        } catch (e) {
          console.warn("[lesson-recorder] finalize failed:", e)
        }
      }

      setStatus("stopped")
    }

    void start()

    const onBeforeUnload = () => {
      // Sync-friendly teardown — браузер не подождёт async, но stop()
      // даст MediaRecorder'у выдать последний dataavailable и закрыть
      // tracks. Главное — sendBeacon на /finalize, чтобы row не висла
      // в 'recording' навсегда. Cron-sweep это страхует, но beacon
      // закрывает урок мгновенно.
      try {
        recRef.current?.stop()
      } catch {
        /* ignore */
      }

      const recId = recordingIdRef.current
      if (recId && typeof navigator !== "undefined" && navigator.sendBeacon) {
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        )
        const body = JSON.stringify({
          lessonId,
          recordingId: recId,
          durationSec,
          totalBytes: totalBytesRef.current,
          chunksCount: Math.max(1, seqRef.current),
        })
        try {
          // Blob с явным content-type — иначе sendBeacon шлёт как
          // text/plain и наш z.object на сервере падает.
          const blob = new Blob([body], { type: "application/json" })
          navigator.sendBeacon("/api/lesson/recording/finalize", blob)
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)

    return () => {
      cancelled = true
      window.removeEventListener("beforeunload", onBeforeUnload)
      void teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, isTeacher, enabled, retryToken])

  // Pause / resume при mute в Jitsi. Без подписки запись бы шла даже
  // когда юзер «выключил микрофон» в UI Jitsi — а это нарушает его
  // expectation.
  useEffect(() => {
    if (!jitsiApi) return
    const onMute = (data: any) => {
      const rec = recRef.current
      if (!rec) return
      try {
        if (data?.muted && rec.state === "recording") {
          rec.pause()
          setStatus("paused")
        } else if (!data?.muted && rec.state === "paused") {
          rec.resume()
          setStatus("recording")
        }
      } catch (e) {
        console.warn("[lesson-recorder] pause/resume failed:", e)
      }
    }
    try {
      jitsiApi.addListener?.("audioMuteStatusChanged", onMute)
    } catch {
      /* ignore */
    }
    return () => {
      try {
        jitsiApi.removeListener?.("audioMuteStatusChanged", onMute)
      } catch {
        /* ignore */
      }
    }
  }, [jitsiApi])

  return { status, error, recordingId }
}
