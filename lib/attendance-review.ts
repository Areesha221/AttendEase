'use server'

// ============================================================
// Boss-side review of flagged attendance events.
//
// An event is "flagged" when the selfie was captured outside the
// office geo-fence (or the device reported no location). The boss
// can approve it (the employee really was there) or reject it
// (the event should not count). Every decision is written to the
// audit log and the employee is notified.
// ============================================================

import { revalidatePath } from 'next/cache'
import { get, newId, run } from '@/lib/db'
import { requireBoss } from '@/lib/session'
import { toServerTime } from '@/lib/time'

type ReviewableEvent = {
  id: string
  employee_id: string
  employee_name: string
  employee_code: string
  user_id: string | null
  type: string
  work_date: string
  server_time: string
  verification: string
  location_status: string | null
  sync_status: string
  review_status: string
}

export async function decideAttendanceReviewAction(formData: FormData): Promise<void> {
  const session = await requireBoss()

  const eventId = String(formData.get('event_id') ?? '')
  const decision = String(formData.get('decision') ?? '')
  const note = String(formData.get('note') ?? '').trim()

  if (!eventId || !['approve', 'reject'].includes(decision)) return

  const event = get<ReviewableEvent>(
    `SELECT a.id, a.employee_id, a.type, a.work_date, a.server_time, a.verification,
            a.location_status, a.sync_status, a.review_status,
            e.full_name AS employee_name, e.employee_code, e.user_id
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
      WHERE a.id = ?`,
    [eventId],
  )
  if (!event) return

  // Anything the system put in the review queue is reviewable (flagged,
  // outside-office, late offline sync — or already decided).
  const needsReview =
    event.review_status !== 'not_required' ||
    event.verification === 'flagged' ||
    event.location_status === 'outside' ||
    event.sync_status === 'pending'
  if (!needsReview) return

  const status = decision === 'approve' ? 'approved' : 'rejected'
  const now = toServerTime()

  run(`UPDATE attendance SET review_status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`, [
    status,
    note || null,
    session.name,
    now,
    eventId,
  ])

  run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, 'attendance', ?, ?, ?)`,
    [
      newId('audit'),
      session.userId,
      session.name,
      decision === 'approve' ? 'approve' : 'reject',
      eventId,
      `${event.type === 'check_in' ? 'Check-in' : 'Check-out'} ${event.work_date} ${event.server_time.slice(11, 16)} ` +
        `for ${event.employee_name} (${event.employee_code}) ${status}` +
        (event.location_status ? ` — location ${event.location_status}` : '') +
        (event.sync_status === 'pending' ? ' — offline event' : '') +
        (note ? ` — ${note}` : ''),
      now,
    ],
  )

  run(
    `INSERT INTO notifications (id, user_id, title, body, kind, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [
      newId('notif'),
      event.user_id,
      `Attendance ${status}`,
      `${event.type === 'check_in' ? 'Check-in' : 'Check-out'} on ${event.work_date} at ` +
        `${event.server_time.slice(11, 16)} was ${status} by the administrator.` +
        (event.sync_status === 'pending' ? ' (Offline event)' : '') +
        (note ? ` Note: ${note}` : ''),
      status === 'approved' ? 'success' : 'danger',
      now,
    ],
  )

  revalidatePath('/boss/attendance')
  revalidatePath('/boss')
  revalidatePath('/boss/reports')
  revalidatePath('/boss/employees')
  revalidatePath(`/boss/employees/${event.employee_id}`)
  revalidatePath('/app')
  revalidatePath('/app/attendance')
}
