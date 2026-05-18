#!/usr/bin/env node
/**
 * Ensures every API route.ts declares an auth pattern or is on the public allowlist.
 * Run: node scripts/check-api-auth.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const API_ROOT = "src/app/api"

const AUTH_PATTERNS = [
  /\.auth\.getUser\s*\(/,
  /requireAdmin\s*\(/,
  /requireLessonParticipant\s*\(/,
  /requireLessonTeacherOrAdmin\s*\(/,
  /CRON_SECRET/,
  /INTERNAL_API_SECRET/,
  /TELEGRAM_WEBHOOK_SECRET/,
  /x-telegram-bot-api-secret-token/,
  /isAllowedIp\s*\(/,
  /isYooKassaAllowedIp\s*\(/,
  /YOOKASSA_ALLOWED/,
  /profile\.role\s*===\s*['"]admin['"]/,
  /protectPublic\s*\(/,
  /enforceRateLimit/,
]

/** Intentionally public or specially protected routes. */
const ALLOWLIST = new Set([
  "src/app/api/auth/callback/route.ts",
  "src/app/api/booking/slots/route.ts",
  "src/app/api/clubs/route.ts",
  "src/app/api/clubs/stats/route.ts",
  "src/app/api/clubs/[id]/route.ts",
  "src/app/api/courses/route.ts",
  "src/app/api/courses/[slug]/route.ts",
  "src/app/api/csp-report/route.ts",
  "src/app/api/leaderboard/route.ts",
  "src/app/api/level-test/route.ts",
  "src/app/api/level-test/submit/route.ts",
  "src/app/api/payments/webhook/route.ts",
  "src/app/api/referrals/verify/route.ts",
  "src/app/api/teach/apply/route.ts",
  "src/app/api/teachers/route.ts",
  "src/app/api/teachers/[id]/route.ts",
  "src/app/api/teachers/[id]/reviews/route.ts",
  "src/app/api/teachers/[id]/slots/route.ts",
  "src/app/api/trial-lesson/teachers/route.ts",
])

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      walk(full, files)
    } else if (name === "route.ts") {
      files.push(full)
    }
  }
  return files
}

const routes = walk(API_ROOT)
const failures = []

for (const file of routes) {
  const rel = relative(process.cwd(), file).replaceAll("\\", "/")
  if (ALLOWLIST.has(rel)) continue

  const content = readFileSync(file, "utf8")
  const hasAuth = AUTH_PATTERNS.some((re) => re.test(content))
  if (!hasAuth) {
    failures.push(rel)
  }
}

if (failures.length > 0) {
  console.error("API routes missing auth pattern (update route or allowlist):")
  for (const f of failures.sort()) {
    console.error(`  - ${f}`)
  }
  process.exit(1)
}

console.log(`OK: ${routes.length} route.ts files checked (${ALLOWLIST.size} allowlisted).`)
