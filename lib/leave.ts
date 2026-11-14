'use server'

// ============================================================
// Leave request server actions (employee side).
// ============================================================

import { revalidatePath } from 'next/cache'
import { get, newId, run } from '@/lib/db'
import { requireEmployee } from '@/lib/session'
import { getEmployeeByUserId, getHolidaysBetween, getSettings } from '@/lib/queries'
import { daysBetweenInclusive, eachDate, toServerTime, toWorkDate } from '@/lib/time'
import { leaveDaysExcludingWeekends } from '@/lib/rules'
import { LEAVE_TYPES, type LeaveFormState, type LeaveType } from '@/lib/leave-shared'

const isDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)

export async function createLeaveAction(_prev: LeaveFormState, formData: FormData): Promise<LeaveFormState> {
  const session = await requireEmployee()
  const employee = getEmployeeByUserId(session.userId)
  if (!employee) return { error: 'No employee profile is linked to this account.' }

  const type = String(formData.get('type') ?? '') as LeaveType
  const startDate = String(formData.get('start_date') ?? '').trim()
  const endDate = String(formData.get('end_date') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  const emergency = formData.get('emergency') === 'on' || type === 'emergency'

  if (!LEAVE_TYPES.includes(type)) return { error: 'Please choose a valid leave type.' }
  if (!isDate(startDate) || !isDate(endDate)) return { error: 'Please choose both a start and an end date.' }
  if (endDate < startDate) return { error: 'The end date cannot be before the start date.' }

  const today = toWorkDate()
  if (startDate < today) return { error: 'Leave cannot start in the past. Choose today or a future date.' }
  if (daysBetweenInclusive(startDate, endDate) > 60) return { error: 'A single request cannot exceed 60 days.' }

  const settings = getSettings()
  const holidaySet = new Set(getHolidaysBetween(startDate, endDate).map((row) => row.date))
  const dates = eachDate(startDate, endDate)
  const days = leaveDaysExcludingWeekends(dates, settings.weekend_days, holidaySet)
  if (days === 0) {
    return { error: 'Those dates fall entirely on weekends or public holidays.' }
  }

  const overlap = get<{ id: string }>(
    `SELECT id FROM leaves
     WHERE employee_id = ? AND status IN ('pending', 'submitted', 'approved')
       AND NOT (end_date < ? OR start_date > ?)`,
    [employee.id, startDate, endDate],
  )
  if (overlap) return { error: 'You already have a leave request covering those dates.' }

  if (type === 'annual') {
    const row = get<{ used: number }>(
      `SELECT COALESCE(SUM(days), 0) AS used FROM leaves
       WHERE employee_id = ? AND type = 'annual' AND status IN ('pending', 'submitted', 'approved')
         AND start_date LIKE ?`,
      [employee.id, `${today.slice(0, 4)}%`],
    )
    const remaining = employee.annual_leave_allowance + employee.carry_forward_leave - (row?.used ?? 0)
    if (days > remaining) {
      return { error: `Only ${Math.max(0, remaining)} annual day(s) remain. Reduce the range or pick another type.` }
    }
  }

  const now = toServerTime()
  const leaveId = newId('leave')
  run(
    `INSERT INTO leaves (id, employee_id, type, start_date, end_date, days, reason, emergency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
    [leaveId, employee.id, type, startDate, endDate, days, reason || null, emergency ? 1 : 0, now],
  )

  run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, 'create', 'leave', ?, ?, ?)`,
    [
      newId('audit'),
      session.userId,
      employee.full_name,
      leaveId,
      `${type} leave ${startDate} → ${endDate} (${days} day(s))${emergency ? ' — EMERGENCY' : ''}`,
      now,
    ],
  )

  run(
    `INSERT INTO notifications (id, user_id, title, body, kind, is_read, created_at)
     VALUES (?, NULL, ?, ?, ?, 0, ?)`,
    [
      newId('notif'),
      `${emergency ? 'Emergency leave' : 'Leave request'} from ${employee.full_name}`,
      `${type} • ${startDate} → ${endDate} • ${days} day(s)`,
      emergency ? 'warning' : 'info',
      now,
    ],
  )

  revalidatePath('/app/leave')
  revalidatePath('/app/leave/balance')
  revalidatePath('/app')

  return { success: `Request sent for approval — ${days} working day(s).` }
}

export async function cancelLeaveAction(formData: FormData): Promise<void> {
  const session = await requireEmployee()
  const employee = getEmployeeByUserId(session.userId)
  if (!employee) return

  const leaveId = String(formData.get('leave_id') ?? '')
  const row = get<{ id: string; status: string }>(
    'SELECT id, status FROM leaves WHERE id = ? AND employee_id = ?',
    [leaveId, employee.id],
  )
  if (!row || !['pending', 'submitted'].includes(row.status)) return

  const now = toServerTime()
  run(`UPDATE leaves SET status = 'cancelled', comment = ? WHERE id = ?`, ['Cancelled by employee', leaveId])
  run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, 'update', 'leave', ?, 'Cancelled by employee', ?)`,
    [newId('audit'), session.userId, employee.full_name, leaveId, now],
  )

  revalidatePath('/app/leave')
  revalidatePath('/app/leave/balance')
}
