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

export type Role = 'admin' | 'hr' | 'manager' | 'employee'

export const STAFF_ROLES: Role[] = ['admin', 'hr', 'manager']

export function isStaffRole(role: Role): boolean {
  return role !== 'employee'
}

/** Turn the stored columns into one effective role (old cookies use "boss"). */
export function effectiveRole(storedRole: string | null | undefined, accessRole: string | null | undefined): Role {
  if (accessRole === 'admin' || accessRole === 'hr' || accessRole === 'manager') return accessRole
  return storedRole === 'boss' ? 'admin' : 'employee'
}

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
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      userId?: string
      employeeId?: string
      role?: string
      name?: string
      department?: string
      exp?: number
    }
    if (!parsed?.userId || !parsed?.exp) return null
    if (parsed.exp * 1000 < Date.now()) return null

    // Cookies issued before the role split used "boss"; treat them as admin.
    const role = parsed.role === 'boss' ? 'admin' : parsed.role
    if (role !== 'admin' && role !== 'hr' && role !== 'manager' && role !== 'employee') return null

    return {
      userId: parsed.userId,
      employeeId: parsed.employeeId ?? '',
      role,
      name: parsed.name ?? '',
      department: parsed.department ?? '',
      exp: parsed.exp,
    }
  } catch {
    return null
  }
}
