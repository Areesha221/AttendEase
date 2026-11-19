'use server'

// ============================================================
// Boss-side leave decisions (approve / reject).
// Every decision is written to the audit log and notifies the
// employee, so the paper trail is complete.
// ============================================================

import { revalidatePath } from 'next/cache'
import { get, newId, run } from '@/lib/db'
import { requireStaff } from '@/lib/session'
import { toServerTime } from '@/lib/time'

type LeaveRow = {
  id: string
  employee_id: string
  type: string
  start_date: string
  end_date: string
  days: number
  status: string
}

export async function decideLeaveAction(formData: FormData): Promise<void> {
  const session = await requireStaff()

  const leaveId = String(formData.get('leave_id') ?? '')
  const decision = String(formData.get('decision') ?? '')
  const comment = String(formData.get('comment') ?? '').trim()

  if (!leaveId || !['approve', 'reject'].includes(decision)) return

  const leave = await get<LeaveRow>(
    'SELECT id, employee_id, type, start_date, end_date, days, status FROM leaves WHERE id = ?',
    [leaveId],
  )
  if (!leave || !['pending', 'submitted'].includes(leave.status)) return

  const status = decision === 'approve' ? 'approved' : 'rejected'
  const now = toServerTime()

  await run(`UPDATE leaves SET status = ?, approver_id = ?, approved_at = ?, comment = ? WHERE id = ?`, [
    status,
    session.userId,
    now,
    comment || null,
    leaveId,
  ])

  await run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, 'leave', ?, ?, ?)`,
    [
      newId('audit'),
      session.userId,
      session.name,
      decision === 'approve' ? 'approve' : 'reject',
      leaveId,
      `${leave.type} leave ${leave.start_date} → ${leave.end_date} (${leave.days} day(s)) ${status}${comment ? ` — ${comment}` : ''}`,
      now,
    ],
  )

  const employee = await get<{ user_id: string | null; full_name: string }>(
    'SELECT user_id, full_name FROM employees WHERE id = ?',
    [leave.employee_id],
  )

  await run(
    `INSERT INTO notifications (id, user_id, title, body, kind, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [
      newId('notif'),
      employee?.user_id ?? null,
      `Leave ${status}`,
      `${leave.type} • ${leave.start_date} → ${leave.end_date} • ${leave.days} day(s)${comment ? ` — ${comment}` : ''}`,
      status === 'approved' ? 'success' : 'danger',
      now,
    ],
  )

  revalidatePath('/boss/leave')
  revalidatePath('/boss')
  revalidatePath('/boss/employees')
  revalidatePath(`/boss/employees/${leave.employee_id}`)
  revalidatePath('/app/leave')
  revalidatePath('/app/leave/balance')
  revalidatePath('/app')
}
