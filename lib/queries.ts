// ============================================================
// Database queries used by the employee and boss screens.
// Server-side only.
// ============================================================

import { all, get } from '@/lib/db'
import {
  eachDate,
  isWeekend,
  shiftDate,
  startOfMonth,
  endOfMonth,
  toWorkDate,
  minutesOf,
  formatDateHuman,
} from '@/lib/time'
import {
  computePayroll,
  evaluateDay,
  summarizeMonth,
  type AttendanceEvent,
  type DayEvaluation,
  type DayStatus,
  type MonthSummary,
  type PayrollBreakdown,
} from '@/lib/rules'
import type { CaptureSignal } from '@/lib/fraud'

export type Settings = {
  id: number
  office_name: string
  office_lat: number
  office_lng: number
  radius_m: number
  work_start: string
  work_end: string
  grace_minutes: number
  required_hours: number
  weekend_days: string
  work_days_per_month: number
  late_penalty: number
  absence_deduction_days: number
  unpaid_leave_deduction_days: number
  perfect_attendance_bonus: number
  no_late_bonus: number
  photo_retention_days: number
  audit_retention_days: number
  require_approval_for_deductions: number
  require_gate_code: number
  updated_at: string
}

export type Employee = {
  id: string
  user_id: string | null
  employee_code: string
  full_name: string
  cnic: string | null
  phone: string | null
  department: string | null
  job_title: string | null
  joining_date: string | null
  photo: string | null
  status: 'active' | 'inactive'
  monthly_salary: number
  annual_leave_allowance: number
  carry_forward_leave: number
  consent: number
  consent_at: string | null
}

export type LeaveRow = {
  id: string
  employee_id: string
  employee_name?: string
  employee_code?: string
  department?: string | null
  photo?: string | null
  type: string
  start_date: string
  end_date: string
  days: number
  reason: string | null
  emergency: number
  status: string
  approver_id: string | null
  approver_name?: string | null
  approved_at: string | null
  comment: string | null
  created_at: string
}

export type HolidayRow = { id: string; date: string; name: string }

export type NotificationRow = {
  id: string
  title: string
  body: string | null
  kind: string
  is_read: number
  created_at: string
}

export type AuditRow = {
  id: string
  actor_name: string | null
  action: string
  entity: string
  entity_id: string | null
  details: string | null
  created_at: string
}

export type DirectoryRow = Employee & {
  todayStatus: DayStatus
  lastCheckIn: string | null
  lastCheckOut: string | null
  onLeaveToday: boolean
  lateDaysThisMonth: number
  absentDaysThisMonth: number
}

export type LeaveBalance = {
  entitlement: number
  carryForward: number
  annualUsed: number
  annualPending: number
  annualRemaining: number
  sickUsed: number
  casualUsed: number
  unpaidUsed: number
  emergencyUsed: number
}

export type PayrollView = {
  summary: MonthSummary
  payroll: PayrollBreakdown
  unpaidLeaveDays: number
  monthStart: string
  monthEnd: string
}

// ---------------- settings ----------------

export async function getSettings(): Promise<Settings> {
  const row = await get<Settings>('SELECT * FROM settings WHERE id = 1')
  if (!row) throw new Error('Settings row missing. Run: npm run seed (local) or migrate the database.')
  return row
}

// ---------------- employees ----------------

export async function getEmployeeById(id: string): Promise<Employee | undefined> {
  return get<Employee>('SELECT * FROM employees WHERE id = ?', [id])
}

export async function getEmployeeByUserId(userId: string): Promise<Employee | undefined> {
  return get<Employee>('SELECT * FROM employees WHERE user_id = ?', [userId])
}

export async function getUserById(id: string): Promise<{ id: string; email: string; role: string } | undefined> {
  return get<{ id: string; email: string; role: string }>('SELECT id, email, role FROM users WHERE id = ?', [id])
}

export async function listEmployees(options: { search?: string; department?: string; includeInactive?: boolean } = {}): Promise<Employee[]> {
  // The owner/admin account is not an employee and never appears in the
  // employee directory, payroll, absence counts or reports. HR and manager
  // accounts are real staff employees, so their profiles are included.
  const clauses: string[] = [
    `(u.role IS NULL OR (u.role <> 'boss' AND COALESCE(u.access_role, '') <> 'admin'))`,
  ]
  const params: (string | number)[] = []

  if (!options.includeInactive) clauses.push(`e.status = 'active'`)
  if (options.department && options.department !== 'all') {
    clauses.push('e.department = ?')
    params.push(options.department)
  }
  if (options.search) {
    clauses.push('(e.full_name LIKE ? OR e.employee_code LIKE ? OR e.phone LIKE ? OR e.cnic LIKE ? OR e.department LIKE ?)')
    const like = `%${options.search}%`
    params.push(like, like, like, like, like)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return all<Employee>(
    `SELECT e.* FROM employees e
     LEFT JOIN users u ON u.id = e.user_id
     ${where}
     ORDER BY e.employee_code`,
    params,
  )
}

/**
 * Active employees who are not the owner account. Team lists (absent, still
 * working, late ranking) must never include the owner's own record, but HR
 * and manager profiles are real employees and stay in these lists.
 */
export async function listTeamEmployees(): Promise<Employee[]> {
  return all<Employee>(
    `SELECT e.* FROM employees e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.status = 'active'
       AND (u.role IS NULL OR (u.role <> 'boss' AND COALESCE(u.access_role, '') <> 'admin'))
     ORDER BY e.employee_code`,
  )
}

export async function listDepartments(): Promise<string[]> {
  return (
    await all<{ department: string }>(
      `SELECT DISTINCT department FROM employees WHERE department IS NOT NULL ORDER BY department`,
    )
  ).map((row) => row.department)
}

/** Suggest the next free employee code, e.g. EMP-1005 (uses the highest number in use). */
export async function nextEmployeeCode(): Promise<string> {
  const rows = await all<{ employee_code: string }>(`SELECT employee_code FROM employees`)
  let highest = 1000
  for (const row of rows) {
    const match = row.employee_code.match(/(\d+)\s*$/)
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  return `EMP-${highest + 1}`
}

export async function employeeCount(): Promise<{ total: number; active: number; inactive: number }> {
  const row = await get<{ total: number; active: number; inactive: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive
     FROM employees`,
  )
  return { total: row?.total ?? 0, active: row?.active ?? 0, inactive: row?.inactive ?? 0 }
}

// ---------------- attendance ----------------

export async function getEventsBetween(employeeId: string, start: string, end: string): Promise<AttendanceEvent[]> {
  return all<AttendanceEvent>(
    `SELECT * FROM attendance WHERE employee_id = ? AND work_date BETWEEN ? AND ? ORDER BY server_time`,
    [employeeId, start, end],
  )
}

export async function getEventsForDate(employeeId: string, workDate: string): Promise<AttendanceEvent[]> {
  return all<AttendanceEvent>(
    `SELECT * FROM attendance WHERE employee_id = ? AND work_date = ? ORDER BY server_time`,
    [employeeId, workDate],
  )
}

export async function getLastEvent(employeeId: string): Promise<AttendanceEvent | undefined> {
  return get<AttendanceEvent>(
    'SELECT * FROM attendance WHERE employee_id = ? ORDER BY server_time DESC LIMIT 1',
    [employeeId],
  )
}

export async function countPendingSync(employeeId?: string): Promise<number> {
  const row = employeeId
    ? await get<{ count: number }>(`SELECT COUNT(*) AS count FROM attendance WHERE sync_status = 'pending' AND employee_id = ?`, [employeeId])
    : await get<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM attendance a
         JOIN employees e ON e.id = a.employee_id
         LEFT JOIN users u ON u.id = e.user_id
         WHERE a.sync_status = 'pending'
           AND (u.role IS NULL OR (u.role <> 'boss' AND COALESCE(u.access_role, '') <> 'admin'))`,
      )
  return row?.count ?? 0
}

export async function getHolidaysBetween(start: string, end: string): Promise<HolidayRow[]> {
  return all<HolidayRow>('SELECT * FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date', [start, end])
}

export async function getAllHolidays(): Promise<HolidayRow[]> {
  return all<HolidayRow>('SELECT * FROM holidays ORDER BY date')
}

/** Set of dates on which the employee has approved leave. */
export async function getApprovedLeaveDates(employeeId: string, start: string, end: string): Promise<Set<string>> {
  const rows = await all<{ start_date: string; end_date: string }>(
    `SELECT start_date, end_date FROM leaves
     WHERE employee_id = ? AND status = 'approved'
       AND NOT (end_date < ? OR start_date > ?)`,
    [employeeId, start, end],
  )
  const dates = new Set<string>()
  for (const row of rows) {
    const from = row.start_date < start ? start : row.start_date
    const to = row.end_date > end ? end : row.end_date
    for (const date of eachDate(from, to)) dates.add(date)
  }
  return dates
}

export async function getApprovedLeaveDatesForAll(start: string, end: string): Promise<Map<string, Set<string>>> {
  const rows = await all<{ employee_id: string; start_date: string; end_date: string }>(
    `SELECT employee_id, start_date, end_date FROM leaves
     WHERE status = 'approved' AND NOT (end_date < ? OR start_date > ?)`,
    [start, end],
  )
  const map = new Map<string, Set<string>>()
  for (const row of rows) {
    const from = row.start_date < start ? start : row.start_date
    const to = row.end_date > end ? end : row.end_date
    const set = map.get(row.employee_id) ?? new Set<string>()
    for (const date of eachDate(from, to)) set.add(date)
    map.set(row.employee_id, set)
  }
  return map
}

/** Day-by-day evaluation for one employee between two dates. */
export async function getDayEvaluations(
  employeeId: string,
  start: string,
  end: string,
  options: { settings?: Settings; events?: AttendanceEvent[]; leaveDates?: Set<string> } = {},
): Promise<DayEvaluation[]> {
  const settings = options.settings ?? (await getSettings())
  const events = options.events ?? (await getEventsBetween(employeeId, start, end))
  const leaveDates = options.leaveDates ?? (await getApprovedLeaveDates(employeeId, start, end))
  const holidaySet = new Set((await getHolidaysBetween(start, end)).map((row) => row.date))
  const employee = await getEmployeeById(employeeId)
  const joiningDate = employee?.joining_date ?? null
  const today = toWorkDate()

  return eachDate(start, end).map((date) =>
    evaluateDay({
      workDate: date,
      events: events.filter((event) => event.work_date === date),
      onLeave: leaveDates.has(date),
      isHoliday: holidaySet.has(date),
      isWeekend: isWeekend(date, settings.weekend_days),
      isFuture: date > today,
      isBeforeJoining: Boolean(joiningDate && date < joiningDate),
      policy: settings,
    }),
  )
}

export async function getMonthEvaluations(employeeId: string, monthAnchor: string = toWorkDate()): Promise<{
  days: DayEvaluation[]
  summary: MonthSummary
  monthStart: string
  monthEnd: string
}> {
  const settings = await getSettings()
  const monthStart = startOfMonth(monthAnchor)
  const monthEnd = endOfMonth(monthAnchor)
  const days = await getDayEvaluations(employeeId, monthStart, monthEnd, { settings })
  return { days, summary: summarizeMonth(days), monthStart, monthEnd }
}

export async function getPayrollView(employeeId: string, monthAnchor: string = toWorkDate()): Promise<PayrollView | null> {
  const employee = await getEmployeeById(employeeId)
  if (!employee) return null

  const settings = await getSettings()
  const { summary, monthStart, monthEnd } = await getMonthEvaluations(employeeId, monthAnchor)

  const unpaidRow = await get<{ days: number }>(
    `SELECT COALESCE(SUM(days), 0) AS days FROM leaves
     WHERE employee_id = ? AND status = 'approved' AND type = 'unpaid'
       AND NOT (end_date < ? OR start_date > ?)`,
    [employeeId, monthStart, monthEnd],
  )
  const unpaidLeaveDays = unpaidRow?.days ?? 0

  const perfectBonus =
    summary.lateDays === 0 && summary.absentDays === 0 && summary.presentDays > 0
      ? settings.perfect_attendance_bonus
      : 0
  const noLateBonus = summary.lateDays === 0 && summary.presentDays > 0 ? settings.no_late_bonus : 0

  const payroll = computePayroll({
    monthlySalary: employee.monthly_salary,
    workDaysPerMonth: settings.work_days_per_month,
    lateCount: summary.lateDays,
    latePenalty: settings.late_penalty,
    absentDays: summary.absentDays,
    absenceDeductionDays: settings.absence_deduction_days,
    unpaidLeaveDays,
    unpaidLeaveDeductionDays: settings.unpaid_leave_deduction_days,
    bonusAmount: Math.max(perfectBonus, noLateBonus),
  })

  return { summary, payroll, unpaidLeaveDays, monthStart, monthEnd }
}

// ---------------- leave ----------------

export async function listLeaves(options: { employeeId?: string; status?: string; limit?: number } = {}): Promise<LeaveRow[]> {
  const clauses: string[] = []
  const params: (string | number)[] = []

  if (options.employeeId) {
    clauses.push('l.employee_id = ?')
    params.push(options.employeeId)
  }
  if (options.status && options.status !== 'all') {
    if (options.status === 'pending') {
      clauses.push(`l.status IN ('pending', 'submitted')`)
    } else {
      clauses.push('l.status = ?')
      params.push(options.status)
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = options.limit ?? 200

  return all<LeaveRow>(
    `SELECT l.*, e.full_name AS employee_name, e.employee_code, e.department, e.photo,
            a.full_name AS approver_name
     FROM leaves l
     JOIN employees e ON e.id = l.employee_id
     LEFT JOIN employees a ON a.id = l.approver_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT ${limit}`,
    params,
  )
}

export async function getLeaveBalance(employeeId: string, year: string = toWorkDate().slice(0, 4)): Promise<LeaveBalance> {
  const employee = await getEmployeeById(employeeId)
  const rows = await all<{ type: string; status: string; days: number }>(
    `SELECT type, status, days FROM leaves
     WHERE employee_id = ? AND start_date LIKE ?`,
    [employeeId, `${year}%`],
  )

  const sum = (type: string, statuses: string[]) =>
    rows.filter((row) => row.type === type && statuses.includes(row.status)).reduce((total, row) => total + row.days, 0)

  const entitlement = employee?.annual_leave_allowance ?? 0
  const carryForward = employee?.carry_forward_leave ?? 0
  const annualUsed = sum('annual', ['approved'])
  const annualPending = sum('annual', ['pending', 'submitted'])

  return {
    entitlement,
    carryForward,
    annualUsed,
    annualPending,
    annualRemaining: Math.max(0, entitlement + carryForward - annualUsed - annualPending),
    sickUsed: sum('sick', ['approved']),
    casualUsed: sum('casual', ['approved']),
    unpaidUsed: sum('unpaid', ['approved']),
    emergencyUsed: sum('emergency', ['approved']),
  }
}

export async function countLeavesOnDate(workDate: string): Promise<number> {
  const row = await get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM leaves
     WHERE status = 'approved' AND start_date <= ? AND end_date >= ?`,
    [workDate, workDate],
  )
  return row?.count ?? 0
}

// ---------------- notifications & audit ----------------

export async function listNotifications(
  userId: string,
  limit = 10,
  options: { includeBroadcasts?: boolean } = {},
): Promise<NotificationRow[]> {
  // Broadcast rows (user_id IS NULL) are company/administrator notices — e.g.
  // "X recorded 2 attendance events". They must only be shown to the boss,
  // never to every employee's own inbox.
  const where = options.includeBroadcasts ? '(user_id IS NULL OR user_id = ?)' : 'user_id = ?'
  return all<NotificationRow>(
    `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT ${limit}`,
    [userId],
  )
}

export async function countUnreadNotifications(
  userId: string,
  options: { includeBroadcasts?: boolean } = {},
): Promise<number> {
  const where = options.includeBroadcasts ? '(user_id IS NULL OR user_id = ?)' : 'user_id = ?'
  const row = await get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM notifications WHERE ${where} AND is_read = 0`,
    [userId],
  )
  return row?.count ?? 0
}

export async function listAuditLogs(limit = 25): Promise<AuditRow[]> {
  return all<AuditRow>(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ${limit}`)
}

// ---------------- boss dashboard ----------------

export type BossOverview = {
  totalEmployees: number
  activeEmployees: number
  presentToday: number
  checkedInNow: number
  notCheckedOut: number
  absentToday: number
  onLeaveToday: number
  lateToday: number
  pendingLeaves: number
  attendancePercentage: number
  totalLateDeduction: number
  totalApprovedBonuses: number
  pendingSyncEvents: number
  departmentTrends: { department: string; employees: number; percentage: number; late: number }[]
  workDate: string
}

export async function getBossOverview(workDate: string = toWorkDate()): Promise<BossOverview> {
  const settings = await getSettings()
  const employees = await listEmployees()
  const monthStart = startOfMonth(workDate)
  const monthEnd = endOfMonth(workDate)
  const leaveMap = await getApprovedLeaveDatesForAll(monthStart, monthEnd)
  const holidaySet = new Set((await getHolidaysBetween(monthStart, monthEnd)).map((row) => row.date))
  const weekend = isWeekend(workDate, settings.weekend_days)
  const holidayToday = holidaySet.has(workDate)

  const todayEvents = (await all<AttendanceEvent>(`SELECT * FROM attendance WHERE work_date = ?`, [workDate])).filter(
    (event) => event.review_status !== 'rejected',
  )
  const graceLimit = minutesOf(settings.work_start) + settings.grace_minutes

  let presentToday = 0
  let notCheckedOut = 0
  let lateToday = 0
  let absentToday = 0
  let onLeaveToday = 0

  const trends = new Map<string, { employees: number; present: number; late: number }>()
  let lateTotal = 0
  let bonusTotal = 0
  let percentageSum = 0

  for (const employee of employees) {
    const joinedToday = !employee.joining_date || workDate >= employee.joining_date

    if (joinedToday) {
      const department = employee.department ?? 'Unassigned'
      const trend = trends.get(department) ?? { employees: 0, present: 0, late: 0 }
      trend.employees += 1

      const employeeEvents = todayEvents.filter((event) => event.employee_id === employee.id)
      const checkIn = employeeEvents.find((event) => event.type === 'check_in')
      const checkOut = employeeEvents.find((event) => event.type === 'check_out')
      const onLeave = leaveMap.get(employee.id)?.has(workDate) ?? false

      if (onLeave) onLeaveToday += 1
      if (checkIn) {
        presentToday += 1
        trend.present += 1
        if (checkIn.server_time && minutesOf(checkIn.server_time.slice(11, 16)) > graceLimit) {
          lateToday += 1
          trend.late += 1
        }
        if (!checkOut) notCheckedOut += 1
      } else if (!onLeave && !weekend && !holidayToday) {
        absentToday += 1
      }

      trends.set(department, trend)
    }

    const { summary } = await getMonthEvaluations(employee.id, workDate)
    percentageSum += summary.attendancePercentage
    lateTotal += summary.lateDays * settings.late_penalty
    if (summary.lateDays === 0 && summary.absentDays === 0 && summary.presentDays > 0) {
      bonusTotal += settings.perfect_attendance_bonus
    }
  }

  const pendingRow = await get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM leaves WHERE status IN ('pending', 'submitted')`,
  )

  return {
    totalEmployees: employees.length,
    activeEmployees: employees.filter((employee) => employee.status === 'active').length,
    presentToday,
    checkedInNow: presentToday - notCheckedOut,
    notCheckedOut,
    absentToday,
    onLeaveToday,
    lateToday,
    pendingLeaves: pendingRow?.count ?? 0,
    attendancePercentage: employees.length ? Math.round(percentageSum / employees.length) : 0,
    totalLateDeduction: Math.round(lateTotal),
    totalApprovedBonuses: Math.round(bonusTotal),
    pendingSyncEvents: await countPendingSync(),
    departmentTrends: [...trends.entries()].map(([department, value]) => ({
      department,
      employees: value.employees,
      percentage: value.employees ? Math.round((value.present / value.employees) * 100) : 0,
      late: value.late,
    })),
    workDate,
  }
}

/** Employee directory with today's live status (boss Employees screen). */
export async function getEmployeeDirectory(
  options: { search?: string; department?: string; includeInactive?: boolean } = {},
): Promise<DirectoryRow[]> {
  const settings = await getSettings()
  const employees = await listEmployees(options)
  const workDate = toWorkDate()
  const monthStart = startOfMonth(workDate)
  const monthEnd = endOfMonth(workDate)
  const leaveMap = await getApprovedLeaveDatesForAll(monthStart, monthEnd)
  const holidaySet = new Set((await getHolidaysBetween(monthStart, monthEnd)).map((row) => row.date))
  const weekend = isWeekend(workDate, settings.weekend_days)
  const holidayToday = holidaySet.has(workDate)

  return Promise.all(
    employees.map(async (employee) => {
      const todayEvents = (await getEventsForDate(employee.id, workDate)).filter(
        (event) => event.review_status !== 'rejected',
      )
      const onLeaveToday = leaveMap.get(employee.id)?.has(workDate) ?? false
      const { days } = await getMonthEvaluations(employee.id, workDate)
      const today = days.find((day) => day.workDate === workDate)

      return {
        ...employee,
        todayStatus: today?.status ?? (weekend ? 'weekend' : holidayToday ? 'holiday' : 'absent'),
        lastCheckIn: todayEvents.find((event) => event.type === 'check_in')?.server_time ?? null,
        lastCheckOut: todayEvents.find((event) => event.type === 'check_out')?.server_time ?? null,
        onLeaveToday,
        lateDaysThisMonth: days.filter((day) => day.status === 'late').length,
        absentDaysThisMonth: days.filter((day) => day.status === 'absent').length,
      }
    }),
  )
}

/** Attendance log rows for the boss attendance table. */
export async function listAttendanceLog(options: {
  employeeId?: string
  start: string
  end: string
  limit?: number
}): Promise<(AttendanceEvent & { employee_name: string; employee_code: string; department: string | null })[]> {
  const clauses = ['a.work_date BETWEEN ? AND ?']
  const params: (string | number)[] = [options.start, options.end]

  if (options.employeeId && options.employeeId !== 'all') {
    clauses.push('a.employee_id = ?')
    params.push(options.employeeId)
  }

  return all(
    `SELECT a.*, e.full_name AS employee_name, e.employee_code, e.department
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN users u ON u.id = e.user_id
     WHERE ${clauses.join(' AND ')}
       AND (u.role IS NULL OR (u.role <> 'boss' AND COALESCE(u.access_role, '') <> 'admin'))
     ORDER BY a.server_time DESC
     LIMIT ${options.limit ?? 300}`,
    params,
  )
}

/** Distinct dates in the last N days that have at least one attendance event. */
export function recentAttendanceDates(days = 30): string[] {
  const today = toWorkDate()
  return eachDate(shiftDate(today, -(days - 1)), today).reverse()
}

/** Distinct months (YYYY-MM) that have attendance rows, newest first, always including this month. */
export async function listAttendanceMonths(employeeId: string): Promise<string[]> {
  const rows = await all<{ month: string }>(
    `SELECT DISTINCT substr(work_date, 1, 7) AS month FROM attendance WHERE employee_id = ? ORDER BY month DESC`,
    [employeeId],
  )
  const months = rows.map((row) => row.month)
  const current = toWorkDate().slice(0, 7)
  if (!months.includes(current)) months.unshift(current)
  return months
}

/** Every leave request for one employee in a calendar year, newest first. */
export async function listEmployeeLeaves(employeeId: string, year: string = toWorkDate().slice(0, 4)): Promise<LeaveRow[]> {
  return all<LeaveRow>(
    `SELECT l.*, e.full_name AS employee_name, e.employee_code, e.department, e.photo
     FROM leaves l
     JOIN employees e ON e.id = l.employee_id
     WHERE l.employee_id = ? AND (l.start_date LIKE ? OR l.end_date LIKE ?)
     ORDER BY l.start_date DESC`,
    [employeeId, `${year}%`, `${year}%`],
  )
}

// ---------------- boss reports & charts ----------------

export type LiveEvent = AttendanceEvent & {
  employee_name: string
  employee_code: string
  department: string | null
  job_title: string | null
}

/** Every attendance event for a single day with the employee attached (live monitor). */
export async function listDayAttendance(workDate: string = toWorkDate()): Promise<LiveEvent[]> {
  return all<LiveEvent>(
    `SELECT a.*, e.full_name AS employee_name, e.employee_code, e.department, e.job_title
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN users u ON u.id = e.user_id
     WHERE a.work_date = ?
       AND (u.role IS NULL OR (u.role <> 'boss' AND COALESCE(u.access_role, '') <> 'admin'))
     ORDER BY a.server_time DESC`,
    [workDate],
  )
}

/** Every event still waiting for a boss decision, across all dates (newest first). */
export async function listReviewQueue(limit = 100): Promise<LiveEvent[]> {
  return all<LiveEvent>(
    `SELECT a.*, e.full_name AS employee_name, e.employee_code, e.department, e.job_title
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN users u ON u.id = e.user_id
     WHERE a.review_status = 'pending'
       AND (u.role IS NULL OR (u.role <> 'boss' AND COALESCE(u.access_role, '') <> 'admin'))
     ORDER BY a.work_date DESC, a.server_time DESC
     LIMIT ${limit}`,
  )
}

/**
 * Earlier captures for one employee, newest first. Used by the anti-fraud
 * checks (duplicate selfie hash, impossible travel). Only the few columns the
 * checks need are selected so a selfie is never loaded just to compare it.
 */
export async function listCaptureSignals(
  employeeId: string,
  upToServerTime: string,
  limit = 25,
): Promise<CaptureSignal[]> {
  return all<CaptureSignal>(
    `SELECT event_id, type, work_date, server_time, latitude, longitude, photo_hash, photo_sha
     FROM attendance
     WHERE employee_id = ?
       AND server_time <= ?
       AND review_status <> 'rejected'
     ORDER BY server_time DESC
     LIMIT ${limit}`,
    [employeeId, upToServerTime],
  )
}

export type TrendPoint = { date: string; label: string; present: number; late: number; absent: number }

/**
 * Company-wide present / late / absent counts for each working day of a month,
 * from the first day up to today. Future days are excluded.
 */
export async function getMonthlyTrend(monthAnchor: string = toWorkDate()): Promise<TrendPoint[]> {
  const settings = await getSettings()
  const employees = await listEmployees()
  const monthStart = startOfMonth(monthAnchor)
  const monthEnd = endOfMonth(monthAnchor)
  const today = toWorkDate()
  const leaveMap = await getApprovedLeaveDatesForAll(monthStart, monthEnd)
  const holidaySet = new Set((await getHolidaysBetween(monthStart, monthEnd)).map((row) => row.date))
  const graceLimit = minutesOf(settings.work_start) + settings.grace_minutes

  const events = (
    await all<AttendanceEvent>(`SELECT * FROM attendance WHERE work_date BETWEEN ? AND ?`, [monthStart, monthEnd])
  ).filter((event) => event.review_status !== 'rejected')
  const byEmployeeDate = new Map<string, AttendanceEvent[]>()
  for (const event of events) {
    const key = `${event.employee_id}|${event.work_date}`
    const list = byEmployeeDate.get(key) ?? []
    list.push(event)
    byEmployeeDate.set(key, list)
  }

  return eachDate(monthStart, monthEnd)
    .filter((date) => date <= today && !isWeekend(date, settings.weekend_days) && !holidaySet.has(date))
    .map((date) => {
      let present = 0
      let late = 0
      let absent = 0
      for (const employee of employees) {
        // Attendance / absence only counts from the employee's joining date.
        if (employee.joining_date && date < employee.joining_date) continue
        const onLeave = leaveMap.get(employee.id)?.has(date) ?? false
        const dayEvents = byEmployeeDate.get(`${employee.id}|${date}`) ?? []
        const checkIn = dayEvents.find((event) => event.type === 'check_in')
        if (checkIn) {
          present += 1
          if (minutesOf(checkIn.server_time.slice(11, 16)) > graceLimit) late += 1
        } else if (!onLeave) {
          absent += 1
        }
      }
      return { date, label: formatDateHuman(date).slice(0, 6), present, late, absent }
    })
}

export type CompanyStatusTotals = { onTime: number; late: number; absent: number; leave: number; present: number }

/** Month-to-date status totals summed across every employee (for the status chart). */
export async function getCompanyStatusTotals(monthAnchor: string = toWorkDate()): Promise<CompanyStatusTotals> {
  const totals: CompanyStatusTotals = { onTime: 0, late: 0, absent: 0, leave: 0, present: 0 }
  for (const employee of await listEmployees()) {
    const { summary } = await getMonthEvaluations(employee.id, monthAnchor)
    totals.onTime += summary.onTimeDays
    totals.late += summary.lateDays
    totals.absent += summary.absentDays
    totals.leave += summary.leaveDays
    totals.present += summary.presentDays
  }
  return totals
}

/** Count of attendance events that failed location verification within a range. */
export async function countFlaggedEvents(start: string, end: string): Promise<number> {
  const row = await get<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN users u ON u.id = e.user_id
     WHERE a.verification = 'flagged'
       AND a.work_date BETWEEN ? AND ?
       AND (u.role IS NULL OR (u.role <> 'boss' AND COALESCE(u.access_role, '') <> 'admin'))`,
    [start, end],
  )
  return row?.count ?? 0
}

/** Month-to-date payroll totals across all active employees (for the reports summary). */
export async function getPayrollTotals(monthAnchor: string = toWorkDate()): Promise<{
  lateDeductions: number
  absenceDeductions: number
  bonuses: number
  totalNet: number
}> {
  let lateDeductions = 0
  let absenceDeductions = 0
  let bonuses = 0
  let totalNet = 0
  for (const employee of await listEmployees()) {
    const view = await getPayrollView(employee.id, monthAnchor)
    if (!view) continue
    lateDeductions += view.payroll.lateTotal
    absenceDeductions += view.payroll.absenceTotal + view.payroll.unpaidLeaveTotal
    bonuses += view.payroll.bonusAmount
    totalNet += view.payroll.estimatedNet
  }
  return {
    lateDeductions: Math.round(lateDeductions),
    absenceDeductions: Math.round(absenceDeductions),
    bonuses: Math.round(bonuses),
    totalNet: Math.round(totalNet),
  }
}
