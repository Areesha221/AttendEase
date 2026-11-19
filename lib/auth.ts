'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { get, newId, run } from '@/lib/db'
import { createSession, deleteSession } from '@/lib/session'
import { effectiveRole } from '@/lib/session-core'
import { toServerTime } from '@/lib/time'

export type LoginState = { error?: string; email?: string } | undefined

type UserRow = {
  id: string
  email: string
  password_hash: string
  role: string
  access_role: string | null
  display_name: string | null
  is_active: number
}

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Please enter both your email and password.', email }
  }

  const user = await get<UserRow>(
    'SELECT id, email, password_hash, role, access_role, display_name, is_active FROM users WHERE lower(email) = ?',
    [email],
  )

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return {
      error: 'Invalid email or password.',
      email,
    }
  }

  if (!user.is_active) {
    return { error: 'This account has been deactivated. Please contact the administrator.', email }
  }

  const employee = await get<{ id: string; full_name: string; department: string | null }>(
    'SELECT id, full_name, department FROM employees WHERE user_id = ?',
    [user.id],
  )

  const role = effectiveRole(user.role, user.access_role)
  const displayName =
    employee?.full_name ??
    user.display_name?.trim() ??
    user.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

  await createSession({
    userId: user.id,
    employeeId: employee?.id ?? '',
    role,
    name: displayName,
    department: employee?.department ?? (role === 'hr' ? 'Human Resources' : role === 'manager' ? 'Operations' : 'Management'),
  })

  await run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, 'login', 'users', ?, ?, ?)`,
    [newId('audit'), user.id, displayName, user.id, `Signed in as ${role}`, toServerTime()],
  )

  redirect(role === 'employee' ? '/app' : '/boss')
}

export async function logoutAction(): Promise<void> {
  await deleteSession()
  redirect('/login')
}
