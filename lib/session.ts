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

/** Boss-only area. Employees get bounced to their own dashboard. */
export async function requireBoss(): Promise<SessionPayload> {
  const session = await requireSession()
  if (session.role !== 'boss') redirect('/app')
  return session
}

/** Employee-only area. Bosses get bounced to the boss dashboard. */
export async function requireEmployee(): Promise<SessionPayload> {
  const session = await requireSession()
  if (session.role !== 'employee') redirect('/boss')
  return session
}

export async function homePathFor(role: Role): Promise<string> {
  return role === 'boss' ? '/boss' : '/app'
}
