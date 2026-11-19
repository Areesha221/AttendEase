// ============================================================
// CSV export of the attendance log (admin and manager).
// GET /api/reports/attendance?start=YYYY-MM-DD&end=YYYY-MM-DD&employee=all
// ============================================================

import { getSession } from '@/lib/session'
import { listAttendanceLog } from '@/lib/queries'

const isDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
    return new Response('Not authorized.', { status: 403 })
  }

  const url = new URL(request.url)
  const startParam = url.searchParams.get('start')
  const endParam = url.searchParams.get('end')
  const employee = url.searchParams.get('employee') ?? 'all'

  const today = new Date().toISOString().slice(0, 10)
  const start = isDate(startParam) ? startParam : `${today.slice(0, 7)}-01`
  const end = isDate(endParam) ? endParam : today

  const rows = await listAttendanceLog({ employeeId: employee, start, end, limit: 5000 })

  const header = [
    'work_date',
    'employee_code',
    'employee_name',
    'department',
    'type',
    'server_time',
    'device_time',
    'distance_m',
    'location_status',
    'sync_status',
    'verification',
    'review_status',
    'reviewed_by',
    'reviewed_at',
    'review_note',
    'reason',
  ]

  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.work_date,
        row.employee_code,
        row.employee_name,
        row.department ?? '',
        row.type,
        row.server_time,
        row.device_time ?? '',
        row.distance_m ?? '',
        row.location_status ?? '',
        row.sync_status,
        row.verification,
        row.review_status,
        row.reviewed_by ?? '',
        row.reviewed_at ?? '',
        row.review_note ?? '',
        row.reason ?? '',
      ]
        .map(csvCell)
        .join(','),
    )
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance_${start}_to_${end}.csv"`,
    },
  })
}
