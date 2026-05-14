// TEMP — удалить после верификации Arcjet.
import { NextRequest, NextResponse } from "next/server"
import { protectPublic, validateEmailField } from "@/lib/api/arcjet"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const hasKey = !!process.env.ARCJET_KEY
  const verdict = await protectPublic(req)
  const emailCheck = await validateEmailField("trash@10minutemail.com")

  return NextResponse.json({
    env: {
      hasArcjetKey: hasKey,
      vercelEnv: process.env.VERCEL_ENV,
    },
    protectPublic: verdict
      ? { blocked: true, status: verdict.status }
      : { blocked: false, note: "passed (либо bot allowed как preview/monitor, либо ключ отсутствует и fail-open)" },
    validateEmail_disposable: emailCheck,
  })
}
