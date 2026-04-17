'use client'

import { useMemo } from 'react'

interface JitsiRoomProps {
  domain: string
  roomName: string
  token: string
  displayName: string
  onConferenceLeft?: () => void
  onParticipantJoined?: (participant: { id: string; displayName: string }) => void
  onParticipantLeft?: (participant: { id: string }) => void
}

export function JitsiRoom({
  domain,
  roomName,
  token,
  displayName,
}: JitsiRoomProps) {
  const jitsiDomain = domain || 'meet.raw-english.com'

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      'userInfo.displayName': displayName,
    })

    // Config overrides
    const config = [
      'prejoinPageEnabled=false',
      'disableDeepLinking=true',
      'hideConferenceSubject=true',
      'disableInviteFunctions=true',
      'toolbarButtons=["camera","chat","desktop","fullscreen","hangup","microphone","raisehand","settings","tileview"]',
    ]

    const interfaceConfig = [
      'SHOW_JITSI_WATERMARK=false',
      'SHOW_WATERMARK_FOR_GUESTS=false',
      'MOBILE_APP_PROMO=false',
      'HIDE_INVITE_MORE_HEADER=true',
    ]

    let url = `https://${jitsiDomain}/${encodeURIComponent(roomName)}`
    url += `#config.${config.join('&config.')}`
    url += `&interfaceConfig.${interfaceConfig.join('&interfaceConfig.')}`
    url += `&${params.toString()}`

    if (token) {
      url += `&jwt=${token}`
    }

    return url
  }, [jitsiDomain, roomName, displayName, token])

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <iframe
        src={iframeSrc}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        allowFullScreen
      />
    </div>
  )
}
