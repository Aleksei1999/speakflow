// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateLinkingCode } from "@/lib/telegram/bot"

export const dynamic = "force-dynamic"

let cachedBotUsername: string | null = null

async function fetchBotUsername(): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername
  const fromEnv = process.env.TELEGRAM_BOT_USERNAME
  if (fromEnv) {
    cachedBotUsername = fromEnv.replace(/^@/, "")
    return cachedBotUsername
  }
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: "no-store",
    })
    const json: any = await res.json()
    if (json?.ok && json.result?.username) {
      cachedBotUsername = json.result.username
      return cachedBotUsername
    }
  } catch (err) {
    console.error("[telegram/link] getMe failed:", err)
  }
  return null
}

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const code = await generateLinkingCode(user.id)
    const username = await fetchBotUsername()
    const deepLink = username
      ? `https://t.me/${username}?start=${code}`
      : null
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    return NextResponse.json({
      code,
      deepLink,
      botUsername: username,
      expiresAt,
    })
  } catch (err: any) {
    console.error("POST /api/telegram/link/start error:", err)
    return NextResponse.json(
      { error: err?.message || "Не удалось сгенерировать код" },
      { status: 500 }
    )
  }
}
