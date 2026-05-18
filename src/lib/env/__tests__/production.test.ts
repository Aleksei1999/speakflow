import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { validateProductionEnv } from "../production.ts"

describe("validateProductionEnv", () => {
  let envSnapshot: NodeJS.ProcessEnv

  beforeEach(() => {
    envSnapshot = { ...process.env }
  })

  afterEach(() => {
    process.env = envSnapshot
  })

  it("no-op outside production", () => {
    process.env.NODE_ENV = "development"
    delete process.env.CRON_SECRET
    assert.doesNotThrow(() => validateProductionEnv())
  })

  it("runs without throw when production env complete", () => {
    process.env.NODE_ENV = "production"
    process.env.CRON_SECRET = "x"
    process.env.INTERNAL_API_SECRET = "x"
    process.env.TELEGRAM_WEBHOOK_SECRET = "x"
    process.env.RW_ROLE_COOKIE_SECRET = "x"
    assert.doesNotThrow(() => validateProductionEnv())
  })
})
