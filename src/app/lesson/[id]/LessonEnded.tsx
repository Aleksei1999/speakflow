import Link from "next/link"

// Экран вместо комнаты, когда подключаться уже (или ещё) нельзя:
// урок завершён, не состоялся или ещё не открыт. Та же тёмная сцена, что у комнаты.

type Kind = "expired" | "no_show" | "waiting"

export default function LessonEnded({
  kind,
  scheduledAt,
  peerName,
  backHref,
  historyHref,
  openAtMs,
}: {
  kind: Kind
  scheduledAt: string
  peerName: string
  backHref: string
  historyHref: string
  openAtMs?: number
}) {
  const d = new Date(scheduledAt)
  const when = `${d.toLocaleDateString("ru", { day: "2-digit", month: "long" })}, ${d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}`
  const title = kind === "expired" ? "Урок завершён" : kind === "no_show" ? "Урок не состоялся" : "Комната ещё закрыта"
  const text =
    kind === "expired"
      ? `Занятие с ${peerName} (${when}) закончилось. Ревью появится в истории занятий.`
      : kind === "no_show"
        ? `Занятие с ${peerName} (${when}) не состоялось.`
        : `Занятие с ${peerName} начнётся ${when}. Комната откроется за 5 минут до начала${openAtMs ? `, в ${new Date(openAtMs).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}` : ""}.`

  return (
    <div className="lvr">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/lesson/lesson-room.css?v=20260911-ended" />
      <div className="lvr-canvas">
        <div className="lvr-topbar">
          <Link href="/" className="lvr-logo" aria-label="Raw English">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/raw2/logo-raw-word-white.svg" alt="Raw English" />
          </Link>
        </div>
        <div className="lvr-ended">
          <h1 className="lvr-ended-title">{title}</h1>
          <p className="lvr-ended-text">{text}</p>
          <div className="lvr-ended-actions">
            {kind === "expired" && <Link href={historyHref} className="lvr-ended-btn lvr-ended-btn--primary">История занятий</Link>}
            <Link href={backHref} className="lvr-ended-btn">В кабинет</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
