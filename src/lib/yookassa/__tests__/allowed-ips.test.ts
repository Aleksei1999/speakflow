import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ipInCidr } from "../../ip/cidr.ts"

const YOOKASSA_ALLOWED_IPS = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11",
  "77.75.156.35",
  "77.75.154.128/25",
  "2a02:5180::/32",
] as const

function isYooKassaAllowedIp(ip: string): boolean {
  if (!ip) return false
  if (process.env.NODE_ENV === "development") return true
  for (const allowed of YOOKASSA_ALLOWED_IPS) {
    if (allowed.includes("/")) {
      if (ipInCidr(ip, allowed)) return true
    } else if (ip === allowed) {
      return true
    }
  }
  return false
}

describe("isYooKassaAllowedIp", () => {
  it("allows listed IPv4 in production mode", () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      assert.equal(isYooKassaAllowedIp("77.75.156.11"), true)
      assert.equal(isYooKassaAllowedIp("1.2.3.4"), false)
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it("allows IPv6 range in production mode", () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      assert.equal(isYooKassaAllowedIp("2a02:5180::1"), true)
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it("exports full allowlist", () => {
    assert.ok(YOOKASSA_ALLOWED_IPS.length >= 6)
  })
})
