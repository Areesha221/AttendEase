// ============================================================
// Session token signing/verification (no external packages).
// Kept separate from lib/session.ts so that proxy.ts can verify
// tokens without importing next/headers.
// ============================================================

import crypto from 'node:crypto'

export const SESSION_COOKIE = 'attendance_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

// Demo fallback secret. In real deployment set SESSION_SECRET in .env.local
const SECRET = process.env.SESSION_SECRET ?? 'attend-ease-demo-secret-change-me'

export type Role = 'employee' | 'boss'

export type SessionPayload = {
  userId: string
  employeeId: string
  role: Role
  name: string
  department: string
  exp: number
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function createToken(payload: Omit<SessionPayload, 'exp'> & { exp?: number }): string {
  const full: SessionPayload = {
    ...payload,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  }
  const body = base64url(JSON.stringify(full))
  return `${body}.${sign(body)}`
}

export function verifyToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const expected = sign(body)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (!payload?.userId || !payload?.exp) return null
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
