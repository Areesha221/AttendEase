'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { get, newId, run } from '@/lib/db'
import { createSession, deleteSession } from '@/lib/session'
import { SHOW_DEMO_ACCOUNTS } from '@/lib/demo-config'
import { toServerTime } from '@/lib/time'
import type { Role } from '@/lib/session-core'

export type LoginState = { error?: string; email?: string } | undefined

type UserRow = {
  id: string
  email: string
  password_hash: string
  role: Role
  is_active: number
}

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Please enter both your email and password.', email }
  }

  const user = get<UserRow>('SELECT id, email, password_hash, role, is_active FROM users WHERE lower(email) = ?', [email])

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return {
      error: `Invalid email or password.${SHOW_DEMO_ACCOUNTS ? ' Try a demo account below.' : ''}`,
      email,
    }
  }

  if (!user.is_active) {
    return { error: 'This account has been deactivated. Please contact the administrator.', email }
  }

  const employee = get<{ id: string; full_name: string; department: string | null }>(
    'SELECT id, full_name, department FROM employees WHERE user_id = ?',
    [user.id],
  )

  await createSession({
    userId: user.id,
    employeeId: employee?.id ?? '',
    role: user.role,
    name: employee?.full_name ?? 'Administrator',
    department: employee?.department ?? 'Management',
  })

  run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, 'login', 'users', ?, ?, ?)`,
    [newId('audit'), user.id, employee?.full_name ?? 'Administrator', user.id, `Signed in as ${user.role}`, toServerTime()],
  )

  redirect(user.role === 'boss' ? '/boss' : '/app')
}

export async function logoutAction(): Promise<void> {
  await deleteSession()
  redirect('/login')
}
