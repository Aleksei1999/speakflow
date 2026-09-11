// GET /api/geo — публичный, без auth. Отдаёт ISO-3166 alpha-2 страну посетителя
// для автовыбора кода телефона: x-vercel-ip-country → регион из Accept-Language → null.
// Клиент (PhoneInput) сам докручивает фолбэк по timezone / navigator.language.

import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const ISO2 = /^[A-Z]{2}$/

function fromAcceptLanguage(header: string | null): string | null {
  if (!header) return null
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim() ?? ""
    const region = tag.split(/[-_]/)[1]?.toUpperCase() ?? ""
    if (ISO2.test(region)) return region
  }
  return null
}

export async function GET(request: NextRequest) {
  const vercel = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase() ?? ""
  const country = ISO2.test(vercel) && vercel !== "XX" ? vercel : fromAcceptLanguage(request.headers.get("accept-language"))
  return NextResponse.json({ country }, { headers: { "cache-control": "no-store" } })
}
