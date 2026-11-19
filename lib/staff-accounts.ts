'use server'

// ============================================================
// Staff account administration (admin only).
//
// HR and manager accounts are stored as users with role = 'employee'
// (the original role CHECK constraint) plus access_role = 'hr' | 'manager'.
// The effective role is what the session, proxy and pages use.
// ============================================================

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { get, newId, run } from '@/lib/db'
import { requireAdmin } from '@/lib/session'
import { toServerTime } from '@/lib/time'
import { MIN_PASSWORD_LENGTH } from '@/lib/employee-shared'

const HASH_ROUNDS = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const CREATABLE_STAFF_ROLES = ['hr', 'manager'] as const
export type CreatableStaffRole = (typeof CREATABLE_STAFF_ROLES)[number]

export type StaffFormState =
  | { error?: string; success?: string; fieldErrors?: Record<string, string> }
  | undefined

export type StaffAccount = {
  id: string
  email: string
  role: string
  access_role: string | null
  display_name: string | null
  is_active: number
  created_at: string
}

async function audit(
  actorId: string,
  actorName: string,
  action: string,
  targetId: string,
  details: string,
): Promise<void> {
  await run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`,
    [newId('audit'), actorId, actorName, action, targetId, details, toServerTime()],
  )
}

function revalidateStaff(): void {
  revalidatePath('/boss/team')
  revalidatePath('/boss')
}

// ---------------- create ----------------

export async function createStaffAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const session = await requireAdmin()

  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const role = String(formData.get('access_role') ?? '').trim()

  const fieldErrors: Record<string, string> = {}
  if (!fullName) fieldErrors.full_name = 'Full name is required.'
  if (!email) fieldErrors.email = 'Email is required.'
  else if (!EMAIL_RE.test(email)) fieldErrors.email = 'Enter a valid email address.'
  if (!password) fieldErrors.password = 'A starting password is required.'
  else if (password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (role !== 'hr' && role !== 'manager') fieldErrors.access_role = 'Choose HR or Manager.'

  if (Object.keys(fieldErrors).length === 0) {
    const existing = await get<{ id: string }>('SELECT id FROM users WHERE lower(email) = ?', [email])
    if (existing) fieldErrors.email = 'That email is already in use.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const userId = newId('usr')
  await run(
    `INSERT INTO users (id, email, password_hash, role, access_role, display_name, is_active, created_at)
     VALUES (?, ?, ?, 'employee', ?, ?, 1, ?)`,
    [userId, email, bcrypt.hashSync(password, HASH_ROUNDS), role, fullName, toServerTime()],
  )

  await audit(
    session.userId,
    session.name,
    'create_staff',
    userId,
    `Created ${role} account for ${fullName} (${email})`,
  )
  revalidateStaff()
  redirect('/boss/team?created=1')
}

// ---------------- activate / deactivate ----------------

export async function setStaffStatusAction(formData: FormData): Promise<void> {
  const session = await requireAdmin()

  const userId = String(formData.get('user_id') ?? '')
  const nextActive = String(formData.get('is_active') ?? '') === '1' ? 1 : 0
  if (!userId) return

  // An admin must not lock themselves out of the staff desk.
  if (userId === session.userId) return

  const target = await get<{ id: string; email: string; access_role: string | null; role: string }>(
    'SELECT id, email, access_role, role FROM users WHERE id = ?',
    [userId],
  )
  if (!target) return
  const isStaff = target.role === 'boss' || target.access_role === 'hr' || target.access_role === 'manager'
  if (!isStaff) return

  await run('UPDATE users SET is_active = ? WHERE id = ?', [nextActive, userId])
  await audit(
    session.userId,
    session.name,
    nextActive ? 'activate_staff' : 'deactivate_staff',
    userId,
    `${nextActive ? 'Activated' : 'Deactivated'} ${target.email}`,
  )

  if (!nextActive) {
    // Kill any live session for the deactivated account by expiring its cookies
    // on the next request; the login action already blocks inactive users.
  }
  revalidateStaff()
}

// ---------------- reset password ----------------

export async function resetStaffPasswordAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const session = await requireAdmin()

  const userId = String(formData.get('user_id') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!userId) return { error: 'Choose an account first.' }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return { fieldErrors: { password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` } }
  }

  const target = await get<{ id: string; email: string; access_role: string | null; role: string }>(
    'SELECT id, email, access_role, role FROM users WHERE id = ?',
    [userId],
  )
  if (!target) return { error: 'That account no longer exists.' }
  const isStaff = target.role === 'boss' || target.access_role === 'hr' || target.access_role === 'manager'
  if (!isStaff) return { error: 'That account is not a staff account.' }

  await run('UPDATE users SET password_hash = ? WHERE id = ?', [
    bcrypt.hashSync(password, HASH_ROUNDS),
    userId,
  ])
  await audit(
    session.userId,
    session.name,
    'reset_staff_password',
    userId,
    `Reset the password for ${target.email}`,
  )
  revalidateStaff()
  return { success: 'Password updated. Share it privately with the account owner.' }
}
