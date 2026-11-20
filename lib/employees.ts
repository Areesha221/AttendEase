'use server'

// ============================================================
// Employee administration server actions (boss side) + the
// employee self-service password change.
//
// Every create / update / deactivate / delete / password change is
// written to the audit log, and the affected employee is notified
// where it makes sense. Only a signed-in boss can manage other
// employees — enforced here on the server, not just in the UI.
// ============================================================

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { get, newId, run, transaction } from '@/lib/db'
import { requireAdmin, requireHr, requireSession } from '@/lib/session'
import { toServerTime } from '@/lib/time'
import type { SessionPayload } from '@/lib/session-core'
import {
  validateEmployeeInput,
  validateNewPassword,
  type EmployeeFormState,
  type PasswordFormState,
} from '@/lib/employee-shared'

const HASH_ROUNDS = 10

async function audit(session: SessionPayload, action: string, entityId: string, details: string): Promise<void> {
  await run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, 'employee', ?, ?, ?)`,
    [newId('audit'), session.userId, session.name, action, entityId, details, toServerTime()],
  )
}

async function notify(userId: string, title: string, body: string, kind: string): Promise<void> {
  await run(
    `INSERT INTO notifications (id, user_id, title, body, kind, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [newId('notif'), userId, title, body, kind, toServerTime()],
  )
}

type EmployeeRef = {
  id: string
  user_id: string | null
  full_name: string
  employee_code: string
}

function revalidateEmployee(employeeId?: string): void {
  revalidatePath('/boss/employees')
  revalidatePath('/boss')
  if (employeeId) revalidatePath(`/boss/employees/${employeeId}`)
}

/**
 * True when the employee row belongs to a staff login (admin, HR or manager).
 * HR must not edit, deactivate or reset those records; only the admin may.
 */
export async function isStaffLinkedEmployee(employeeId: string): Promise<boolean> {
  const row = await get<{ role: string; access_role: string | null }>(
    `SELECT u.role, u.access_role
     FROM employees e JOIN users u ON u.id = e.user_id
     WHERE e.id = ?`,
    [employeeId],
  )
  if (!row) return false
  return row.role === 'boss' || (row.access_role !== null && row.access_role !== '')
}

/**
 * The staff role behind an employee row, if any. 'admin' means the owner
 * account, which is not an employee and stays hidden from HR.
 */
export async function getEmployeeAccountRole(employeeId: string): Promise<'admin' | 'hr' | 'manager' | null> {
  const row = await get<{ role: string; access_role: string | null }>(
    `SELECT u.role, u.access_role
     FROM employees e JOIN users u ON u.id = e.user_id
     WHERE e.id = ?`,
    [employeeId],
  )
  if (!row) return null
  if (row.role === 'boss') return 'admin'
  if (row.access_role === 'hr') return 'hr'
  if (row.access_role === 'manager') return 'manager'
  if (row.access_role === 'admin') return 'admin'
  return null
}

// ---------------- create ----------------

export async function createEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const session = await requireHr()

  const result = validateEmployeeInput(formData, { requirePassword: true })
  if ('fieldErrors' in result) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: result.fieldErrors }
  }
  const input = result.data

  const fieldErrors: Record<string, string> = {}
  if (await get<{ id: string }>('SELECT id FROM users WHERE lower(email) = ?', [input.email])) {
    fieldErrors.email = 'That email is already in use.'
  }
  if (await get<{ id: string }>('SELECT id FROM employees WHERE employee_code = ?', [input.employeeCode])) {
    fieldErrors.employee_code = 'That employee code is already in use.'
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const now = toServerTime()
  const userId = newId('usr')
  const employeeId = newId('emp')

  await transaction(async (tx) => {
    await tx.execute({
      sql: `INSERT INTO users (id, email, password_hash, role, is_active, created_at)
            VALUES (?, ?, ?, 'employee', ?, ?)`,
      args: [userId, input.email, bcrypt.hashSync(input.password, HASH_ROUNDS), input.status === 'active' ? 1 : 0, now],
    })
    await tx.execute({
      sql: `INSERT INTO employees (id, user_id, employee_code, full_name, cnic, phone, department, job_title,
              joining_date, photo, status, monthly_salary, annual_leave_allowance, carry_forward_leave,
              consent, consent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, 1, ?, ?)`,
      args: [
        employeeId,
        userId,
        input.employeeCode,
        input.fullName,
        input.cnic || null,
        input.phone || null,
        input.department || null,
        input.jobTitle || null,
        input.joiningDate || now.slice(0, 10),
        input.status,
        input.monthlySalary,
        input.annualLeaveAllowance,
        now,
        now,
      ],
    })
  })

  await audit(session, 'create', employeeId, `Added employee ${input.fullName} (${input.employeeCode})`)
  revalidateEmployee(employeeId)
  redirect(`/boss/employees/${employeeId}`)
}

// ---------------- update ----------------

export async function updateEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const session = await requireHr()

  const employeeId = String(formData.get('employee_id') ?? '')
  const employee = await get<{ id: string; user_id: string | null }>(
    'SELECT id, user_id FROM employees WHERE id = ?',
    [employeeId],
  )
  if (!employee) return { error: 'That employee could not be found.' }
  if (session.role !== 'admin' && (await isStaffLinkedEmployee(employeeId))) {
    return { error: 'This record belongs to a staff account. Only the administrator can edit it.' }
  }

  const result = validateEmployeeInput(formData, { requirePassword: false })
  if ('fieldErrors' in result) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: result.fieldErrors }
  }
  const input = result.data

  const fieldErrors: Record<string, string> = {}
  const emailOwner = await get<{ id: string }>('SELECT id FROM users WHERE lower(email) = ?', [input.email])
  if (emailOwner && emailOwner.id !== employee.user_id) fieldErrors.email = 'That email is already in use.'
  const codeOwner = await get<{ id: string }>('SELECT id FROM employees WHERE employee_code = ?', [input.employeeCode])
  if (codeOwner && codeOwner.id !== employeeId) {
    fieldErrors.employee_code = 'That employee code is already in use.'
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the highlighted fields.', fieldErrors }
  }

  await transaction(async (tx) => {
    await tx.execute({
      sql: `UPDATE employees
            SET employee_code = ?, full_name = ?, cnic = ?, phone = ?, department = ?, job_title = ?,
                joining_date = ?, status = ?, monthly_salary = ?, annual_leave_allowance = ?
            WHERE id = ?`,
      args: [
        input.employeeCode,
        input.fullName,
        input.cnic || null,
        input.phone || null,
        input.department || null,
        input.jobTitle || null,
        input.joiningDate || null,
        input.status,
        input.monthlySalary,
        input.annualLeaveAllowance,
        employeeId,
      ],
    })

    if (employee.user_id) {
      await tx.execute({
        sql: 'UPDATE users SET email = ?, is_active = ? WHERE id = ?',
        args: [input.email, input.status === 'active' ? 1 : 0, employee.user_id],
      })
      if (input.password) {
        await tx.execute({
          sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
          args: [bcrypt.hashSync(input.password, HASH_ROUNDS), employee.user_id],
        })
      }
    }
  })

  await audit(session, 'update', employeeId, `Updated employee ${input.fullName} (${input.employeeCode})`)
  revalidateEmployee(employeeId)
  redirect(`/boss/employees/${employeeId}`)
}

// ---------------- activate / deactivate ----------------

export async function setEmployeeStatusAction(formData: FormData): Promise<void> {
  const session = await requireHr()

  const employeeId = String(formData.get('employee_id') ?? '')
  const next = String(formData.get('status') ?? '')
  if (!['active', 'inactive'].includes(next)) return

  const employee = await get<EmployeeRef>(
    'SELECT id, user_id, full_name, employee_code FROM employees WHERE id = ?',
    [employeeId],
  )
  if (!employee) return
  if (employee.user_id === session.userId) return // never lock yourself out
  if (session.role !== 'admin' && (await isStaffLinkedEmployee(employeeId))) return

  await transaction(async (tx) => {
    await tx.execute({ sql: 'UPDATE employees SET status = ? WHERE id = ?', args: [next, employeeId] })
    if (employee.user_id) {
      await tx.execute({
        sql: 'UPDATE users SET is_active = ? WHERE id = ?',
        args: [next === 'active' ? 1 : 0, employee.user_id],
      })
    }
  })

  const activating = next === 'active'
  await audit(
    session,
    activating ? 'reactivate' : 'deactivate',
    employeeId,
    `${activating ? 'Reactivated' : 'Deactivated'} ${employee.full_name} (${employee.employee_code})`,
  )
  if (employee.user_id) {
    await notify(
      employee.user_id,
      activating ? 'Account reactivated' : 'Account deactivated',
      activating
        ? 'Your account is active again — you can sign in.'
        : 'Your account has been deactivated. Contact your administrator.',
      activating ? 'success' : 'warning',
    )
  }
  revalidateEmployee(employeeId)
}

// ---------------- hard delete ----------------

export async function deleteEmployeeAction(formData: FormData): Promise<void> {
  const session = await requireAdmin()

  const employeeId = String(formData.get('employee_id') ?? '')
  const confirm = String(formData.get('confirm') ?? '').trim().toUpperCase()
  if (confirm !== 'DELETE') return

  const employee = await get<EmployeeRef>(
    'SELECT id, user_id, full_name, employee_code FROM employees WHERE id = ?',
    [employeeId],
  )
  if (!employee) return
  if (employee.user_id === session.userId) return // never delete yourself

  await transaction(async (tx) => {
    await tx.execute({ sql: 'DELETE FROM attendance WHERE employee_id = ?', args: [employeeId] })
    await tx.execute({ sql: 'DELETE FROM leaves WHERE employee_id = ?', args: [employeeId] })
    if (employee.user_id) {
      await tx.execute({ sql: 'DELETE FROM notifications WHERE user_id = ?', args: [employee.user_id] })
    }
    await tx.execute({ sql: 'DELETE FROM employees WHERE id = ?', args: [employeeId] })
    if (employee.user_id) {
      await tx.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [employee.user_id] })
    }
  })

  await audit(
    session,
    'delete',
    employeeId,
    `Permanently deleted ${employee.full_name} (${employee.employee_code}) and all their records`,
  )
  revalidateEmployee()
  redirect('/boss/employees')
}

// ---------------- password: boss reset ----------------

export async function resetEmployeePasswordAction(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const session = await requireHr()

  const employeeId = String(formData.get('employee_id') ?? '')
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  const employee = await get<{ id: string; user_id: string | null; full_name: string }>(
    'SELECT id, user_id, full_name FROM employees WHERE id = ?',
    [employeeId],
  )
  if (!employee || !employee.user_id) return { error: 'This employee has no linked login account.' }
  if (session.role !== 'admin' && (await isStaffLinkedEmployee(employeeId))) {
    return { error: 'This record belongs to a staff account. Only the administrator can reset it.' }
  }

  const error = validateNewPassword(password, confirm)
  if (error) return { error }

  await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, HASH_ROUNDS), employee.user_id])
  await audit(session, 'update', employeeId, `Reset password for ${employee.full_name}`)
  await notify(employee.user_id, 'Password changed', 'An administrator reset your password. Use the new password to sign in.', 'warning')
  revalidateEmployee(employeeId)
  return { success: `Password updated for ${employee.full_name}.` }
}

// ---------------- password: self-service (employee or boss) ----------------

export async function changeOwnPasswordAction(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const session = await requireSession()

  const current = String(formData.get('current_password') ?? '')
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  const user = await get<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE id = ?',
    [session.userId],
  )
  if (!user) return { error: 'Your account could not be found.' }

  if (!bcrypt.compareSync(current, user.password_hash)) {
    return { error: 'Your current password is not correct.' }
  }

  const error = validateNewPassword(password, confirm)
  if (error) return { error }

  if (bcrypt.compareSync(password, user.password_hash)) {
    return { error: 'Choose a password different from your current one.' }
  }

  await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, HASH_ROUNDS), session.userId])
  await audit(session, 'update', session.employeeId || session.userId, 'Changed own password')
  return { success: 'Your password has been changed.' }
}
