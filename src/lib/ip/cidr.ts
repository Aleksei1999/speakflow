/**
 * IPv4/IPv6 CIDR matching for webhook IP allowlists.
 */

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return null
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
}

export function ipv4InCidr(ip: string, cidr: string): boolean {
  const [subnet, bitsStr] = cidr.split("/")
  if (!subnet || !bitsStr) return ip === cidr

  const bits = parseInt(bitsStr, 10)
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false

  const ipLong = ipv4ToLong(ip)
  const subnetLong = ipv4ToLong(subnet)
  if (ipLong === null || subnetLong === null) return false

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipLong & mask) === (subnetLong & mask)
}

/** Expand :: in IPv6 address to 8 hextets. */
function expandIpv6(ip: string): string[] | null {
  const trimmed = ip.trim().toLowerCase()
  if (!trimmed.includes(":")) return null

  const [head, tail] = trimmed.split("::")
  const headParts = head ? head.split(":").filter(Boolean) : []
  const tailParts = tail ? tail.split(":").filter(Boolean) : []
  const missing = 8 - headParts.length - tailParts.length
  if (missing < 0) return null

  const full = [...headParts, ...Array(missing).fill("0"), ...tailParts]
  if (full.length !== 8) return null

  return full.map((h) => {
    const n = parseInt(h, 16)
    if (Number.isNaN(n) || n < 0 || n > 0xffff) return null
    return n.toString(16).padStart(4, "0")
  }) as string[]
}

function ipv6ToBigInt(ip: string): bigint | null {
  const parts = expandIpv6(ip)
  if (!parts || parts.some((p) => p === null)) return null

  let value = BigInt(0)
  for (const h of parts) {
    value = (value << BigInt(16)) + BigInt(parseInt(h, 16))
  }
  return value
}

export function ipv6InCidr(ip: string, cidr: string): boolean {
  const [subnet, bitsStr] = cidr.split("/")
  if (!subnet || !bitsStr) return expandIpv6(ip)?.join(":") === expandIpv6(subnet)?.join(":")

  const bits = parseInt(bitsStr, 10)
  if (Number.isNaN(bits) || bits < 0 || bits > 128) return false

  const ipValue = ipv6ToBigInt(ip)
  const subnetValue = ipv6ToBigInt(subnet)
  if (ipValue === null || subnetValue === null) return false

  if (bits === 0) return true
  const mask = ((BigInt(1) << BigInt(bits)) - BigInt(1)) << BigInt(128 - bits)
  return (ipValue & mask) === (subnetValue & mask)
}

export function ipInCidr(ip: string, cidr: string): boolean {
  if (cidr.includes(":")) {
    return ipv6InCidr(ip, cidr)
  }
  if (ip.includes(":")) {
    return false
  }
  return ipv4InCidr(ip, cidr)
}
