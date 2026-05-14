"use client"

// Запись аудио урока. Каждые ~20с делаем stop+start нового MediaRecorder
// чтобы каждый chunk был полноценным webm с заголовком — иначе Whisper
// читает только первый кусок.

import { useEffect, useRef, useState } from "react"

type Status = "idle" | "starting" | "recording" | "paused" | "stopping" | "stopped" | "error"

interface UseLessonRecorderArgs {
  lessonId: string
  isTeacher: boolean
  jitsiApi: any
  enabled?: boolean
  onStarted?: () => void
  /** Меняй значение, чтобы перезапустить запись (retry после отказа в mic). */
  retryToken?: number
}

interface UseLessonRecorderReturn {
  status: Status
  error: string | null
  recordingId: string | null
}

const CHUNK_DURATION_MS = 20_000
const STUDENT_POLL_INTERVAL_MS = 4_000
const STUDENT_POLL_TIMEOUT_MS = 5 * 60_000
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
  // Restart-pattern: интервал, который пинает текущий MediaRecorder
  // → stop() → onstop поднимает новый recorder и start().
  const restartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Флаг «после stop'а сразу создать новый recorder». Сбрасываем при
  // mute и при teardown, чтобы хвостовой stop был финальным.
  const autoRestartRef = useRef(false)
  // Экспонируем pause/resume для второго useEffect (mute-listener).
  // Внутри основного useEffect лежат closure'ы spawnRecorder etc.,
  // в этих ref'ах храним стабильные ссылки на них.
  const pauseRecordingRef = useRef<() => void>(() => {})
  const resumeRecordingRef = useRef<() => void>(() => {})

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
    autoRestartRef.current = false
    if (restartIntervalRef.current) {
      clearInterval(restartIntervalRef.current)
      restartIntervalRef.current = null
    }
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

    async function uploadOne(blob: Blob, recId: string): Promise<number> {
      // seq назначает сервер.
      const urlRes = await fetch("/api/lesson/recording/chunk-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          recordingId: recId,
          mimeType: mimeRef.current,
        }),
      })
      if (!urlRes.ok) {
        const t = await urlRes.text().catch(() => "")
        throw new Error(`chunk-url ${urlRes.status} ${t}`)
      }
      const { signedUrl, token, seq } = await urlRes.json()
      if (!signedUrl) throw new Error("no signedUrl")

      // 2. PUT в Storage. write-once: upsert:false на сервере →
      //    повторная загрузка по тому же URL упадёт.
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mimeRef.current,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: blob,
      })
      if (!putRes.ok) {
        const t = await putRes.text().catch(() => "")
        throw new Error(`storage PUT ${putRes.status} ${t}`)
      }
      totalBytesRef.current += blob.size
      return typeof seq === "number" ? seq : 0
    }

    async function drainQueue(recId: string) {
      if (uploadingRef.current) return
      uploadingRef.current = true
      try {
        while (queueRef.current.length > 0) {
          const blob = queueRef.current.shift()!
          try {
            const seq = await uploadOne(blob, recId)
            if (seq + 1 > seqRef.current) seqRef.current = seq + 1
            if (!startedFiredRef.current) {
              startedFiredRef.current = true
              onStarted?.()
            }
          } catch (e: any) {
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

      startedAtRef.current = Date.now()
      // Стартуем первый recorder + восстановим интервал рестарта.
      const ok = spawnRecorder(stream, recId)
      if (!ok) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      armRestartInterval()
      setStatus("recording")
    }

    /**
     * Создаёт новый MediaRecorder на текущем stream, навешивает
     * onstop (с restart-логикой) и сразу стартует без timeslice — мы
     * сами стопаем его по setInterval.
     *
     * Возвращает false при системной ошибке (recorder не создаётся —
     * редкость, но возможно если track отключился).
     */
    function spawnRecorder(stream: MediaStream, recId: string): boolean {
      let rec: MediaRecorder
      try {
        rec = new MediaRecorder(stream, { mimeType: mimeRef.current })
      } catch (e: any) {
        console.warn("[lesson-recorder] new MediaRecorder failed:", e?.message ?? e)
        setStatus("error")
        setError("Не удалось создать recorder")
        return false
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
      rec.onstop = () => {
        // После stop()'а MediaRecorder сначала эмитит dataavailable,
        // потом onstop — на этот момент финальный blob уже в очереди.
        // Если флаг autoRestart взведён, создаём следующий recorder
        // на том же stream. Иначе (mute/teardown) — ничего не делаем.
        if (!autoRestartRef.current) return
        const s = streamRef.current
        const rid = recordingIdRef.current
        if (!s || !rid) return
        // Если stream закрылся (track ended) — больше не рестартуем.
        const live = s.getAudioTracks().some((t) => t.readyState === "live")
        if (!live) return
        spawnRecorder(s, rid)
      }

      try {
        rec.start()
      } catch (e: any) {
        console.warn("[lesson-recorder] rec.start failed:", e?.message ?? e)
        return false
      }
      return true
    }

    function armRestartInterval() {
      if (restartIntervalRef.current) clearInterval(restartIntervalRef.current)
      autoRestartRef.current = true
      restartIntervalRef.current = setInterval(() => {
        const rec = recRef.current
        if (!rec || rec.state !== "recording") return
        try {
          rec.stop()
        } catch (e) {
          console.warn("[lesson-recorder] periodic stop failed:", e)
        }
      }, CHUNK_DURATION_MS)
    }

    function disarmRestartInterval() {
      autoRestartRef.current = false
      if (restartIntervalRef.current) {
        clearInterval(restartIntervalRef.current)
        restartIntervalRef.current = null
      }
    }

    // Экспонируем pause/resume для useEffect, который слушает mute.
    // На mute: глушим интервал и текущий recorder (хвост попадает
    // в очередь полноценным webm-файлом). На unmute: новый recorder
    // на том же stream + новый интервал.
    pauseRecordingRef.current = () => {
      const rec = recRef.current
      disarmRestartInterval()
      if (rec && rec.state === "recording") {
        try {
          rec.stop()
        } catch (e) {
          console.warn("[lesson-recorder] pause stop failed:", e)
        }
      }
      setStatus("paused")
    }
    resumeRecordingRef.current = () => {
      const s = streamRef.current
      const rid = recordingIdRef.current
      if (!s || !rid || teardownStartedRef.current) return
      const live = s.getAudioTracks().some((t) => t.readyState === "live")
      if (!live) return
      // Если предыдущий recorder ещё не доехал до inactive (редко, но
      // если mute→unmute щёлкнули быстрее, чем onstop вернулся),
      // autoRestart=false уже снят — onstop ничего не сделает; мы
      // безопасно создаём новый поверх него.
      const ok = spawnRecorder(s, rid)
      if (!ok) return
      armRestartInterval()
      setStatus("recording")
    }

    async function teardown() {
      if (teardownStartedRef.current) return
      teardownStartedRef.current = true
      setStatus("stopping")

      // Снимаем интервал и autoRestart-флаг ДО stop() — иначе onstop
      // обратно поднимет recorder и мы окажемся в гонке.
      disarmRestartInterval()

      const rec = recRef.current
      if (rec && rec.state !== "inactive") {
        await new Promise<void>((res) => {
          // Перезаписываем onstop — нам нужно дождаться именно
          // финального stop'а без auto-respawn'а. ondataavailable
          // (он эмитится первым) положит хвостовой blob в очередь.
          rec.onstop = () => res()
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

      // Доуплоадить хвост из очереди.
      const recId = recordingIdRef.current
      if (recId) {
        try {
          await drainQueue(recId)
        } catch {
          /* ignore */
        }

        // Финализирует только teacher; иначе студент закрыл бы чужую
        // запись. Если препод тоже ушёл грязно — sweep cron подберёт.
        if (isTeacher) {
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
      }

      setStatus("stopped")
    }

    void start()

    const onBeforeUnload = () => {
      // Браузер не дождётся async — снимаем autoRestart и стопаем
      // recorder. Teacher дополнительно шлёт sendBeacon на /finalize.
      autoRestartRef.current = false
      if (restartIntervalRef.current) {
        clearInterval(restartIntervalRef.current)
        restartIntervalRef.current = null
      }
      try {
        recRef.current?.stop()
      } catch {
        /* ignore */
      }

      const recId = recordingIdRef.current
      if (isTeacher && recId && typeof navigator !== "undefined" && navigator.sendBeacon) {
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
  //
  // Реализация: restart-pattern несовместим с MediaRecorder.pause() —
  // мы сами стопаем/пересоздаём recorder, поэтому MediaRecorder в
  // состоянии "paused" не существует. На mute → disarm interval +
  // stop текущего (хвост → очередь). На unmute → spawn новый recorder
  // + новый интервал. См. pauseRecordingRef/resumeRecordingRef внутри
  // основного useEffect.
  useEffect(() => {
    if (!jitsiApi) return
    const onMute = (data: any) => {
      try {
        if (data?.muted) {
          pauseRecordingRef.current()
        } else {
          resumeRecordingRef.current()
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
