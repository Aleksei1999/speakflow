import { ipInCidr } from "@/lib/ip/cidr"

/**
 * YooKassa webhook source IPs.
 * https://yookassa.ru/developers/using-api/webhooks#ip
 */
export const YOOKASSA_ALLOWED_IPS = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11",
  "77.75.156.35",
  "77.75.154.128/25",
  "2a02:5180::/32",
] as const

export function isYooKassaAllowedIp(ip: string): boolean {
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
