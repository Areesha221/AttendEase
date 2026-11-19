// ============================================================
// Cookie based session helpers (server-side only).
// ============================================================

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createToken,
  verifyToken,
  type SessionPayload,
  type Role,
} from '@/lib/session-core'

export async function createSession(payload: Omit<SessionPayload, 'exp'>): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, createToken(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function deleteSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/** Current session or null. Memoized per render pass. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies()
  return verifyToken(store.get(SESSION_COOKIE)?.value)
})

/** Any signed-in user, otherwise redirect to /login. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/** Staff area (admin, HR or manager). Employees go back to their own dashboard. */
export async function requireStaff(): Promise<SessionPayload> {
  const session = await requireSession()
  if (session.role === 'employee') redirect('/app')
  return session
}

/** Admin only — staff accounts, destructive actions and owner settings. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession()
  if (session.role !== 'admin') redirect(session.role === 'employee' ? '/app' : '/boss')
  return session
}

/** Admin or HR — employee records, attendance review, leave and the gate. */
export async function requireHr(): Promise<SessionPayload> {
  const session = await requireSession()
  if (session.role !== 'admin' && session.role !== 'hr') {
    redirect(session.role === 'employee' ? '/app' : '/boss')
  }
  return session
}

/** Admin or manager — company-wide reports and payroll. */
export async function requireReports(): Promise<SessionPayload> {
  const session = await requireSession()
  if (session.role !== 'admin' && session.role !== 'manager') {
    redirect(session.role === 'employee' ? '/app' : '/boss')
  }
  return session
}

/** Backwards-compatible alias: every staff role may open the boss area. */
export async function requireBoss(): Promise<SessionPayload> {
  return requireStaff()
}

/** Employee-only area. Staff accounts are bounced to the boss area. */
export async function requireEmployee(): Promise<SessionPayload> {
  const session = await requireSession()
  if (session.role !== 'employee') redirect('/boss')
  return session
}

export async function homePathFor(role: Role): Promise<string> {
  return role === 'employee' ? '/app' : '/boss'
}
