import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ipv4InCidr, ipv6InCidr, ipInCidr } from "../cidr.ts"

describe("ipv4InCidr", () => {
  it("matches YooKassa IPv4 ranges", () => {
    assert.equal(ipv4InCidr("77.75.156.11", "77.75.156.11"), true)
    assert.equal(ipv4InCidr("77.75.154.200", "77.75.154.128/25"), true)
    assert.equal(ipv4InCidr("1.2.3.4", "77.75.154.128/25"), false)
  })
})

describe("ipv6InCidr", () => {
  it("matches YooKassa IPv6 /32", () => {
    assert.equal(ipv6InCidr("2a02:5180::1", "2a02:5180::/32"), true)
    assert.equal(ipv6InCidr("2a02:5181::1", "2a02:5180::/32"), false)
  })
})

describe("ipInCidr", () => {
  it("dispatches by address family", () => {
    assert.equal(ipInCidr("77.75.156.11", "77.75.156.11"), true)
    assert.equal(ipInCidr("2a02:5180::5", "2a02:5180::/32"), true)
    assert.equal(ipInCidr("77.75.156.11", "2a02:5180::/32"), false)
  })
})
