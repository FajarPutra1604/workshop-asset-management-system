import { randomUUID } from 'node:crypto'

// Asset code untuk QR: 24-char hex (cukup unik & anti-tebak)
export function generateAssetCode() {
  return randomUUID().replace(/-/g, '').slice(0, 24).toUpperCase()
}
