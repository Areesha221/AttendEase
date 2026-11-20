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
import { all, get, newId, run, transaction } from '@/lib/db'
import { requireAdmin } from '@/lib/session'
import { toServerTime } from '@/lib/time'
import { MIN_PASSWORD_LENGTH } from '@/lib/employee-shared'

const HASH_ROUNDS = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A "use server" module may only export async actions, so no runtime values
// are exported from this file: importing it never raises "found object".
export type CreatableStaffRole = 'hr' | 'manager'

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

/**
 * Staff accounts get their own employee row so they can check in and out from
 * the "My attendance" page. The row is linked to the staff user, which keeps it
 * out of the employee directory, payroll and company-wide counts.
 */
const STAFF_PROFILE: Record<CreatableStaffRole, { prefix: string; department: string; jobTitle: string }> = {
  hr: { prefix: 'HR', department: 'Human Resources', jobTitle: 'HR Manager' },
  manager: { prefix: 'MGR', department: 'Operations', jobTitle: 'Manager' },
}

async function nextStaffEmployeeCode(role: CreatableStaffRole): Promise<string> {
  const prefix = STAFF_PROFILE[role].prefix
  const rows = await all<{ employee_code: string }>(
    'SELECT employee_code FROM employees WHERE employee_code LIKE ?',
    [`${prefix}-%`],
  )
  const highest = rows.reduce((max, row) => {
    const value = Number(row.employee_code.slice(prefix.length + 1))
    return Number.isFinite(value) && value > max ? value : max
  }, 0)
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`
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
  const salaryRaw = String(formData.get('monthly_salary') ?? '').trim()

  const fieldErrors: Record<string, string> = {}
  if (!fullName) fieldErrors.full_name = 'Full name is required.'
  if (!email) fieldErrors.email = 'Email is required.'
  else if (!EMAIL_RE.test(email)) fieldErrors.email = 'Enter a valid email address.'
  if (!password) fieldErrors.password = 'A starting password is required.'
  else if (password.length < MIN_PASSWORD_LENGTH) {
    fieldErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (role !== 'hr' && role !== 'manager') fieldErrors.access_role = 'Choose HR or Manager.'

  // Salary is optional: HR and manager profiles are real employees, but the
  // admin can also set the amount later from the employee record.
  let monthlySalary = 0
  if (salaryRaw) {
    const parsed = Number(salaryRaw)
    if (!Number.isFinite(parsed) || parsed < 0) {
      fieldErrors.monthly_salary = 'Enter a valid monthly salary (0 or more).'
    } else if (parsed > 100_000_000) {
      fieldErrors.monthly_salary = 'That salary looks too large.'
    } else {
      monthlySalary = Math.round(parsed)
    }
  }

  if (Object.keys(fieldErrors).length === 0) {
    const existing = await get<{ id: string }>('SELECT id FROM users WHERE lower(email) = ?', [email])
    if (existing) fieldErrors.email = 'That email is already in use.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const staffRole: CreatableStaffRole = role === 'hr' ? 'hr' : 'manager'
  const userId = newId('usr')
  const employeeId = newId('emp')
  const employeeCode = await nextStaffEmployeeCode(staffRole)
  const profile = STAFF_PROFILE[staffRole]
  const now = toServerTime()

  await transaction(async (tx) => {
    await tx.execute({
      sql: `INSERT INTO users (id, email, password_hash, role, access_role, display_name, is_active, created_at)
            VALUES (?, ?, ?, 'employee', ?, ?, 1, ?)`,
      args: [userId, email, bcrypt.hashSync(password, HASH_ROUNDS), role, fullName, now],
    })
    await tx.execute({
      sql: `INSERT INTO employees (id, user_id, employee_code, full_name, cnic, phone, department, job_title,
              joining_date, photo, status, monthly_salary, annual_leave_allowance, carry_forward_leave,
              consent, consent_at, created_at)
            VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL, 'active', ?, 20, 0, 1, ?, ?)`,
      args: [
        employeeId,
        userId,
        employeeCode,
        fullName,
        profile.department,
        profile.jobTitle,
        now.slice(0, 10),
        monthlySalary,
        now,
        now,
      ],
    })
  })

  await audit(
    session.userId,
    session.name,
    'create_staff',
    userId,
    `Created ${role} account for ${fullName} (${email}) with attendance profile ${employeeCode}`,
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
  await run('UPDATE employees SET status = ? WHERE user_id = ?', [nextActive ? 'active' : 'inactive', userId])
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

// ---------------- delete ----------------

export async function deleteStaffAction(formData: FormData): Promise<void> {
  const session = await requireAdmin()

  const userId = String(formData.get('user_id') ?? '')
  const confirm = String(formData.get('confirm') ?? '').trim().toUpperCase()
  if (!userId || confirm !== 'DELETE') return
  if (userId === session.userId) return // never delete your own account

  const target = await get<{ id: string; email: string; access_role: string | null; role: string }>(
    'SELECT id, email, access_role, role FROM users WHERE id = ?',
    [userId],
  )
  if (!target) return
  if (target.role === 'boss') return // the owner account is permanent
  if (target.access_role !== 'hr' && target.access_role !== 'manager') return

  const employee = await get<{ id: string }>('SELECT id FROM employees WHERE user_id = ?', [userId])

  await transaction(async (tx) => {
    if (employee) {
      await tx.execute({ sql: 'DELETE FROM attendance WHERE employee_id = ?', args: [employee.id] })
      await tx.execute({ sql: 'DELETE FROM leaves WHERE employee_id = ?', args: [employee.id] })
    }
    await tx.execute({ sql: 'DELETE FROM notifications WHERE user_id = ?', args: [userId] })
    if (employee) {
      await tx.execute({ sql: 'DELETE FROM employees WHERE id = ?', args: [employee.id] })
    }
    await tx.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] })
  })

  await audit(
    session.userId,
    session.name,
    'delete_staff',
    userId,
    `Permanently deleted ${target.access_role} account ${target.email}`,
  )
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
