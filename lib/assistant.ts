// ============================================================
// Rule-based attendance assistant (boss only).
//
// There is no external AI service here. The boss types a normal English
// question; we match keywords to one known intent and answer it with the
// same database queries the dashboard already uses. That keeps the answers
// deterministic, cheap and easy to audit — and it can never change a record.
// ============================================================

import {
  countFlaggedEvents,
  countPendingSync,
  employeeCount,
  getCompanyStatusTotals,
  getDayEvaluations,
  getEmployeeDirectory,
  getLeaveBalance,
  getMonthEvaluations,
  getPayrollTotals,
  getPayrollView,
  getSettings,
  listDayAttendance,
  listDepartments,
  listEmployeeLeaves,
  listEmployees,
  listLeaves,
  listNotifications,
  listReviewQueue,
  listTeamEmployees,
  type Employee,
  type LiveEvent,
} from '@/lib/queries'
import { formatPkr } from '@/lib/rules'
import { formatDateHuman, formatStamp12, minutesOf, monthLabel, shiftDate, startOfMonth, toWorkDate } from '@/lib/time'

// ---------------- answer shape (safe to send to the browser) ----------------

export type AssistantTable = { columns: string[]; rows: string[][] }
export type AssistantLink = { label: string; href: string }

export type AssistantAnswer = {
  /** Stable id of the matched rule; useful for tests and debugging. */
  intent: string
  title: string
  summary: string
  bullets?: string[]
  table?: AssistantTable
  links?: AssistantLink[]
  suggestions?: string[]
}

const BASE_SUGGESTIONS = [
  'What needs my review?',
  'Who is late today?',
  'Who is absent today?',
  'Who checked out today?',
  'Who has not checked out?',
  'Yesterday at a glance',
  'Top late employees this month',
  'Payroll this month',
  'Office work hours',
]

/** Example questions for the empty chat and the "I did not understand" reply. */
export function buildSuggestions(employees: Employee[] = []): string[] {
  const list = [...BASE_SUGGESTIONS]
  const sample = employees[0]
  if (sample) {
    list.push(`Summary for ${sample.full_name} this month`)
    list.push(`Leave balance of ${sample.full_name}`)
  }
  return list
}

// ---------------- text helpers ----------------

/** Lowercase, apostrophes and punctuation become spaces, so "who's" == "whos". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasAny(question: string, phrases: string[]): boolean {
  return phrases.some((phrase) => question.includes(phrase))
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

function shiftMonth(workDate: string, delta: number): string {
  const [year, month] = workDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7)
}

/** "this month" (default), "last month", or a month name such as "October". */
function resolveMonth(question: string, workDate: string): { anchor: string; label: string } {
  if (/\blast month\b/.test(question)) {
    const anchor = shiftMonth(workDate, -1)
    return { anchor, label: monthLabel(anchor) }
  }

  const index = MONTH_NAMES.findIndex((name) => new RegExp(`\\b${name}\\b`).test(question))
  if (index >= 0) {
    const yearMatch = question.match(/\b(20\d{2})\b/)
    const currentYear = Number(workDate.slice(0, 4))
    const currentMonth = Number(workDate.slice(5, 7))
    let year = yearMatch ? Number(yearMatch[1]) : currentYear
    // "December" said in November almost always means last December.
    if (!yearMatch && index + 1 > currentMonth) year -= 1
    const anchor = `${year}-${String(index + 1).padStart(2, '0')}-01`
    return { anchor, label: monthLabel(anchor) }
  }

  return { anchor: workDate, label: monthLabel(workDate) }
}

type EmployeeMatch =
  | { kind: 'one'; employee: Employee }
  | { kind: 'many'; candidates: Employee[] }
  | { kind: 'none' }

/** Match a full name, employee code, or a unique first/last name token. */
function findEmployee(question: string, employees: Employee[]): EmployeeMatch {
  const full = employees.filter((employee) => question.includes(normalize(employee.full_name)))
  if (full.length === 1) return { kind: 'one', employee: full[0] }
  if (full.length > 1) return { kind: 'many', candidates: full }

  const code = employees.filter((employee) => question.includes(employee.employee_code.toLowerCase()))
  if (code.length === 1) return { kind: 'one', employee: code[0] }
  if (code.length > 1) return { kind: 'many', candidates: code }

  const tokens = new Set(question.split(' '))
  const byToken = employees.filter((employee) =>
    normalize(employee.full_name)
      .split(' ')
      .some((part) => part.length >= 3 && tokens.has(part)),
  )
  if (byToken.length === 1) return { kind: 'one', employee: byToken[0] }
  if (byToken.length > 1) return { kind: 'many', candidates: byToken }
  return { kind: 'none' }
}

function parseThreshold(question: string): number | null {
  const match = question.match(/\b(?:more than|over|at least|minimum|min)\s+(\d{1,2})\b/)
  return match ? Number(match[1]) : null
}

function parseTop(question: string): number | null {
  const match = question.match(/\btop\s+(\d{1,2})\b/)
  const value = match ? Number(match[1]) : 0
  return value > 0 ? Math.min(value, 25) : null
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

// ---------------- individual answers ----------------

function helpAnswer(): AssistantAnswer {
  return {
    intent: 'help',
    title: 'What I can answer',
    summary:
      'I read the same attendance database as your dashboard and reply in plain English. I am read-only: I never edit, approve or delete anything.',
    bullets: [
      'Today or yesterday — who is late, absent, on leave, checked out, still clocked in, or a full day summary.',
      'This month — late and absence rankings, overtime, perfect attendance and the payroll estimate.',
      'To-do — attendance waiting for review, leave requests, duplicate selfies and impossible travel.',
      'People — one employee’s month summary, leave balance or leave history.',
      'Policy — work hours, office radius, penalties, bonuses and the entrance gate code.',
    ],
    suggestions: buildSuggestions(),
  }
}

function promptAnswer(): AssistantAnswer {
  return {
    intent: 'empty',
    title: 'Ask me an attendance question',
    summary: 'Type a question in English, for example “Who is late today?”.',
    suggestions: buildSuggestions(),
  }
}

async function gateAnswer(): Promise<AssistantAnswer> {
  const settings = await getSettings()
  const required = settings.require_gate_code === 1
  return {
    intent: 'gate',
    title: `Entrance gate code is ${required ? 'required' : 'optional'}`,
    summary: required
      ? 'Every check-in and check-out must carry the current 6-digit code from the entrance screen. A missing, wrong or expired code still saves the record, but it is flagged for your review.'
      : 'The rotating QR screen is available, but codes are not enforced. You can turn them on from the gate page whenever the entrance screen is in place.',
    bullets: [
      'The code changes every 30 seconds and is checked against the server clock.',
      'The previous code stays valid for one extra step (~30 s) to cover scanning and submitting.',
      'The office is set to a ' + settings.radius_m + ' m radius around ' + settings.office_name + '.',
    ],
    links: [{ label: 'Open the entrance gate screen', href: '/boss/gate' }],
  }
}

async function notificationsAnswer(userId: string): Promise<AssistantAnswer> {
  const notifications = await listNotifications(userId, 5, { includeBroadcasts: true })
  return {
    intent: 'notifications',
    title: 'Latest notifications',
    summary:
      notifications.length === 0
        ? 'There are no notifications right now.'
        : `You have ${notifications.length} recent notification${notifications.length === 1 ? '' : 's'}, newest first.`,
    bullets: notifications.map((row) => `${row.title} — ${row.body ?? 'No details.'}`),
  }
}

async function employeeCountAnswer(): Promise<AssistantAnswer> {
  const counts = await employeeCount()
  const departments = await listDepartments()
  return {
    intent: 'employee_count',
    title: 'Employee count',
    summary: `You have ${counts.total} employee${counts.total === 1 ? '' : 's'}: ${counts.active} active and ${counts.inactive} inactive.`,
    bullets: [
      departments.length > 0 ? `Departments: ${departments.join(', ')}.` : 'No departments have been set yet.',
    ],
    links: [{ label: 'Open the employee directory', href: '/boss/employees' }],
  }
}

async function onLeaveTodayAnswer(workDate: string, label = 'today'): Promise<AssistantAnswer> {
  const leaves = (await listLeaves({ status: 'approved', limit: 100 })).filter(
    (leave) => leave.start_date <= workDate && leave.end_date >= workDate,
  )
  return {
    intent: label === 'today' ? 'on_leave_today' : 'on_leave_day',
    title: `On leave ${label} (${formatDateHuman(workDate)})`,
    summary:
      leaves.length === 0
        ? `No one is on approved leave ${label}.`
        : `${leaves.length} employee${leaves.length === 1 ? ' is' : 's are'} on approved leave ${label}.`,
    table:
      leaves.length > 0
        ? {
            columns: ['Employee', 'Type', 'From', 'To', 'Days'],
            rows: leaves.map((leave) => [
              `${leave.employee_name ?? 'Unknown'} (${leave.employee_code ?? '—'})`,
              titleCase(leave.type),
              formatDateHuman(leave.start_date),
              formatDateHuman(leave.end_date),
              String(leave.days),
            ]),
          }
        : undefined,
    links: [{ label: 'Open leave management', href: '/boss/leave' }],
  }
}

async function pendingLeavesAnswer(): Promise<AssistantAnswer> {
  const leaves = await listLeaves({ status: 'pending', limit: 100 })
  return {
    intent: 'pending_leaves',
    title: 'Leave requests waiting for you',
    summary:
      leaves.length === 0
        ? 'Nothing is waiting. Every leave request has been decided.'
        : `${leaves.length} leave request${leaves.length === 1 ? ' is' : 's are'} waiting for a decision.`,
    table:
      leaves.length > 0
        ? {
            columns: ['Employee', 'Type', 'From', 'To', 'Days'],
            rows: leaves.map((leave) => [
              `${leave.employee_name ?? 'Unknown'} (${leave.employee_code ?? '—'})`,
              titleCase(leave.type) + (leave.emergency ? ' · emergency' : ''),
              formatDateHuman(leave.start_date),
              formatDateHuman(leave.end_date),
              String(leave.days),
            ]),
          }
        : undefined,
    links: [{ label: 'Review leave requests', href: '/boss/leave' }],
  }
}

async function pendingReviewsAnswer(): Promise<AssistantAnswer> {
  const queue = await listReviewQueue(50)
  const oldest = queue.length > 0 ? queue[queue.length - 1].work_date : null
  return {
    intent: 'pending_reviews',
    title: 'Attendance waiting for review',
    summary:
      queue.length === 0
        ? 'The review queue is empty. Nothing needs your approval.'
        : `${queue.length} attendance event${queue.length === 1 ? '' : 's'} still need a decision${
            oldest ? `, the oldest from ${formatDateHuman(oldest)}` : ''
          }.`,
    table:
      queue.length > 0
        ? {
            columns: ['Date', 'Employee', 'Type', 'Reason'],
            rows: queue.slice(0, 20).map((event) => [
              formatDateHuman(event.work_date),
              `${event.employee_name} (${event.employee_code})`,
              event.type === 'check_in' ? 'Check-in' : 'Check-out',
              summarizeReason(event),
            ]),
          }
        : undefined,
    links: [{ label: 'Open the review queue', href: '/boss/attendance?filter=review&scope=all' }],
  }
}

function summarizeReason(event: LiveEvent): string {
  const gate = event.gate_status === 'missing' ? 'Gate code missing' : event.gate_status === 'invalid' ? 'Gate code invalid' : null
  const parts: string[] = []
  if (event.location_status === 'outside') parts.push('Outside office radius')
  else if (event.location_status === 'unavailable') parts.push('Location unavailable')
  if (event.accuracy_m !== null && event.accuracy_m > 150) parts.push('Weak GPS accuracy')
  if (event.fraud_flags?.includes('duplicate_selfie')) parts.push('Duplicate selfie')
  if (event.fraud_flags?.includes('impossible_travel')) parts.push('Impossible travel')
  if (gate) parts.push(gate)
  return parts.length > 0 ? parts.join(' · ') : event.reason ?? 'Flagged for review'
}

async function notCheckedOutAnswer(): Promise<AssistantAnswer> {
  const [directory, team] = await Promise.all([getEmployeeDirectory(), listTeamEmployees()])
  const teamIds = new Set(team.map((employee) => employee.id))
  const rows = directory.filter((row) => teamIds.has(row.id) && row.lastCheckIn && !row.lastCheckOut)
  return {
    intent: 'not_checked_out',
    title: 'Still working (no check-out yet)',
    summary:
      rows.length === 0
        ? 'Everyone who checked in today has also checked out.'
        : `${rows.length} employee${rows.length === 1 ? ' is' : 's are'} still clocked in.`,
    table:
      rows.length > 0
        ? {
            columns: ['Employee', 'Department', 'Checked in'],
            rows: rows.map((row) => [
              `${row.full_name} (${row.employee_code})`,
              row.department ?? 'Unassigned',
              formatStamp12(row.lastCheckIn),
            ]),
          }
        : undefined,
    links: [{ label: 'Open the live attendance monitor', href: '/boss/attendance' }],
  }
}

/** "today" by default, or the previous working date when the question says "yesterday". */
function resolveDay(question: string, workDate: string): { date: string; label: string } {
  if (/\byesterday\b/.test(question)) {
    return { date: shiftDate(workDate, -1), label: 'yesterday' }
  }
  return { date: workDate, label: 'today' }
}

async function absentOnDateAnswer(workDate: string, label: string): Promise<AssistantAnswer> {
  const [team, settings] = await Promise.all([listTeamEmployees(), getSettings()])
  const evaluations = await Promise.all(
    team.map((employee) => getDayEvaluations(employee.id, workDate, workDate, { settings })),
  )
  const rows = team.filter((_, index) => evaluations[index][0]?.status === 'absent')

  return {
    intent: label === 'today' ? 'absent_today' : 'absent_day',
    title: `Absent ${label} (${formatDateHuman(workDate)})`,
    summary:
      rows.length === 0
        ? `No one is marked absent ${label}. Weekends, holidays and approved leave are not counted as absence.`
        : `${rows.length} employee${rows.length === 1 ? ' is' : 's are'} marked absent ${label}.`,
    table:
      rows.length > 0
        ? {
            columns: ['Employee', 'Department', 'Employee code'],
            rows: rows.map((row) => [row.full_name, row.department ?? 'Unassigned', row.employee_code]),
          }
        : undefined,
    links: [{ label: 'Open the live attendance monitor', href: '/boss/attendance' }],
  }
}

async function lateOnDateAnswer(workDate: string, label: string): Promise<AssistantAnswer> {
  const settings = await getSettings()
  const events = await listDayAttendance(workDate)
  const graceLimit = minutesOf(settings.work_start) + settings.grace_minutes

  // Keep the earliest accepted check-in per employee.
  const firstCheckIn = new Map<string, LiveEvent>()
  for (const event of events) {
    if (event.type !== 'check_in' || event.review_status === 'rejected') continue
    const current = firstCheckIn.get(event.employee_id)
    if (!current || event.server_time < current.server_time) firstCheckIn.set(event.employee_id, event)
  }

  const late = [...firstCheckIn.values()]
    .filter((event) => minutesOf(event.server_time.slice(11, 16)) > graceLimit)
    .sort((a, b) => a.server_time.localeCompare(b.server_time))

  return {
    intent: label === 'today' ? 'late_today' : 'late_day',
    title: `Late ${label} (${formatDateHuman(workDate)})`,
    summary:
      late.length === 0
        ? `No late arrivals ${label}. Work starts at ${settings.work_start} with a ${settings.grace_minutes}-minute grace period.`
        : `${late.length} employee${late.length === 1 ? ' arrived' : 's arrived'} after the grace period ${label} (work starts ${settings.work_start}, grace ${settings.grace_minutes} min).`,
    table:
      late.length > 0
        ? {
            columns: ['Employee', 'Department', 'Checked in', 'Late by'],
            rows: late.map((event) => [
              `${event.employee_name} (${event.employee_code})`,
              event.department ?? 'Unassigned',
              formatStamp12(event.server_time),
              `${minutesOf(event.server_time.slice(11, 16)) - graceLimit} min`,
            ]),
          }
        : undefined,
    links: [{ label: 'Open the live attendance monitor', href: '/boss/attendance' }],
  }
}

async function checkedOutOnDateAnswer(workDate: string, label: string): Promise<AssistantAnswer> {
  const events = (await listDayAttendance(workDate)).filter((event) => event.review_status !== 'rejected')
  const firstIn = new Map<string, LiveEvent>()
  const firstOut = new Map<string, LiveEvent>()

  for (const event of events) {
    const target = event.type === 'check_in' ? firstIn : firstOut
    const current = target.get(event.employee_id)
    if (!current || event.server_time < current.server_time) target.set(event.employee_id, event)
  }

  const rows = [...firstOut.values()].sort((a, b) => b.server_time.localeCompare(a.server_time))
  const stillIn = [...firstIn.keys()].filter((employeeId) => !firstOut.has(employeeId))

  return {
    intent: label === 'today' ? 'checked_out_today' : 'checked_out_day',
    title: `Check-outs ${label} (${formatDateHuman(workDate)})`,
    summary:
      rows.length === 0
        ? `No check-outs recorded ${label}.`
        : `${rows.length} employee${rows.length === 1 ? ' has' : 's have'} checked out ${label}${
            stillIn.length > 0 ? `; ${stillIn.length} still had no check-out.` : '.'
          }`,
    table:
      rows.length > 0
        ? {
            columns: ['Employee', 'Department', 'Checked in', 'Checked out'],
            rows: rows.map((event) => [
              `${event.employee_name} (${event.employee_code})`,
              event.department ?? 'Unassigned',
              formatStamp12(firstIn.get(event.employee_id)?.server_time ?? null),
              formatStamp12(event.server_time),
            ]),
          }
        : undefined,
    links: [{ label: 'Open the live attendance monitor', href: '/boss/attendance' }],
  }
}

async function daySummaryAnswer(workDate: string, label: string): Promise<AssistantAnswer> {
  const [team, settings, events] = await Promise.all([
    listTeamEmployees(),
    getSettings(),
    listDayAttendance(workDate),
  ])
  const evaluations = await Promise.all(
    team.map((employee) => getDayEvaluations(employee.id, workDate, workDate, { settings })),
  )
  const statuses = evaluations.map((days) => days[0]?.status ?? 'upcoming')
  const count = (status: string) => statuses.filter((value) => value === status).length

  const accepted = events.filter((event) => event.review_status !== 'rejected')
  const checkedIn = new Set(accepted.filter((event) => event.type === 'check_in').map((event) => event.employee_id))
  const checkedOut = new Set(accepted.filter((event) => event.type === 'check_out').map((event) => event.employee_id))
  const stillIn = [...checkedIn].filter((employeeId) => !checkedOut.has(employeeId)).length

  const late = count('late') + count('pending')
  const present = count('on_time') + late
  const absent = count('absent')
  const leave = count('leave')
  const nonWorking = count('weekend') + count('holiday')

  return {
    intent: label === 'today' ? 'present_today' : 'day_summary',
    title: `${label === 'today' ? 'Today' : 'Yesterday'} at a glance (${formatDateHuman(workDate)})`,
    summary:
      nonWorking === statuses.length && statuses.length > 0
        ? `This was a non-working day (weekend or holiday) for the whole team.`
        : `${present} of ${team.length} team members were present ${label}.`,
    bullets: [
      `Present: ${present}`,
      `On time: ${count('on_time')}`,
      `Late: ${late}`,
      `Absent: ${absent}`,
      `Approved leave: ${leave}`,
      `Checked in: ${checkedIn.size}`,
      `Checked out: ${checkedOut.size}`,
      `Still without a check-out: ${stillIn}`,
    ],
    links: [{ label: 'Open the live attendance monitor', href: '/boss/attendance' }],
  }
}

async function topLateAnswer(
  question: string,
  employees: Employee[],
  anchor: string,
  label: string,
): Promise<AssistantAnswer> {
  const threshold = parseThreshold(question)
  const limit = parseTop(question) ?? 10

  const rows = await Promise.all(
    employees.map(async (employee) => {
      const { summary } = await getMonthEvaluations(employee.id, anchor)
      return {
        employee,
        late: summary.lateDays,
        absent: summary.absentDays,
        present: summary.presentDays,
      }
    }),
  )

  const filtered = rows
    .filter((row) => (threshold === null ? row.late > 0 : row.late >= threshold))
    .sort((a, b) => b.late - a.late || a.employee.full_name.localeCompare(b.employee.full_name))
    .slice(0, limit)

  const condition = threshold === null ? 'at least one late day' : `${threshold} or more late days`
  return {
    intent: 'top_late',
    title: `Late arrivals — ${label}`,
    summary:
      filtered.length === 0
        ? `No employee had ${condition} in ${label}.`
        : `${filtered.length} employee${filtered.length === 1 ? ' has' : 's have'} ${condition} in ${label}, highest first.`,
    table:
      filtered.length > 0
        ? {
            columns: ['#', 'Employee', 'Late days', 'Absent days', 'Present days'],
            rows: filtered.map((row, index) => [
              String(index + 1),
              `${row.employee.full_name} (${row.employee.employee_code})`,
              String(row.late),
              String(row.absent),
              String(row.present),
            ]),
          }
        : undefined,
    links: [{ label: 'Open reports', href: '/boss/reports' }],
  }
}

async function payrollAnswer(
  employee: Employee | null,
  anchor: string,
  label: string,
): Promise<AssistantAnswer> {
  if (employee) {
    const view = await getPayrollView(employee.id, anchor)
    if (!view) {
      return {
        intent: 'payroll_employee',
        title: 'Payroll estimate unavailable',
        summary: `I could not build a payroll estimate for ${employee.full_name}.`,
      }
    }
    return {
      intent: 'payroll_employee',
      title: `${employee.full_name} — payroll estimate for ${label}`,
      summary: `${formatPkr(view.payroll.estimatedNet)} estimated net pay this month. This is an estimate, never a finalized salary.`,
      bullets: [
        `Monthly salary: ${formatPkr(view.payroll.monthlySalary)}`,
        `Daily rate: ${formatPkr(view.payroll.dailyRate)} (${view.payroll.workDaysPerMonth} work days per month)`,
        `Late: ${view.payroll.lateCount} day(s) → ${formatPkr(view.payroll.lateTotal)} deducted`,
        `Absent: ${view.payroll.absentDays} day(s) → ${formatPkr(view.payroll.absenceTotal)} deducted`,
        `Unpaid leave: ${view.payroll.unpaidLeaveDays} day(s) → ${formatPkr(view.payroll.unpaidLeaveTotal)} deducted`,
        `Bonus: ${formatPkr(view.payroll.bonusAmount)}`,
        `Total deduction: ${formatPkr(view.payroll.totalDeduction)}`,
      ],
      links: [{ label: `Open ${employee.full_name.split(' ')[0]}’s profile`, href: `/boss/employees/${employee.id}` }],
    }
  }

  const totals = await getPayrollTotals(anchor)
  return {
    intent: 'payroll_company',
    title: `Company payroll estimate — ${label}`,
    summary: `${formatPkr(totals.totalNet)} estimated net pay across active employees this month. These are estimates, not finalized salaries.`,
    bullets: [
      `Late deductions: ${formatPkr(totals.lateDeductions)}`,
      `Absence and unpaid-leave deductions: ${formatPkr(totals.absenceDeductions)}`,
      `Bonuses: ${formatPkr(totals.bonuses)}`,
    ],
    links: [{ label: 'Open reports', href: '/boss/reports' }],
  }
}

async function officePolicyAnswer(): Promise<AssistantAnswer> {
  const settings = await getSettings()
  const weekendNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekend = settings.weekend_days
    .split(',')
    .map((value) => weekendNames[Number(value.trim())])
    .filter(Boolean)
    .join(', ')

  return {
    intent: 'office_policy',
    title: 'Office and attendance policy',
    summary: `${settings.office_name}: work day ${settings.work_start}–${settings.work_end} with a ${settings.grace_minutes}-minute grace period.`,
    bullets: [
      `Allowed check-in radius: ${settings.radius_m} m`,
      `Required hours per day: ${settings.required_hours}`,
      `Weekend: ${weekend || 'none configured'}`,
      `Working days per month: ${settings.work_days_per_month}`,
      `Late penalty: ${formatPkr(settings.late_penalty)} per late day`,
      `Absence deduction: ${settings.absence_deduction_days} day(s) of pay`,
      `Perfect-attendance bonus: ${formatPkr(settings.perfect_attendance_bonus)}`,
      `No-late bonus: ${formatPkr(settings.no_late_bonus)}`,
      `Entrance gate code: ${settings.require_gate_code === 1 ? 'required' : 'optional'}`,
    ],
    links: [{ label: 'Open the entrance gate screen', href: '/boss/gate' }],
  }
}

async function pendingSyncAnswer(): Promise<AssistantAnswer> {
  const count = await countPendingSync()
  return {
    intent: 'pending_sync',
    title: 'Offline events waiting to sync',
    summary:
      count === 0
        ? 'Nothing is waiting. Every offline capture has been uploaded.'
        : `${count} offline attendance event${count === 1 ? ' is' : 's are'} still waiting to sync.`,
    bullets: [
      'Offline captures are queued on the phone and uploaded when the connection returns.',
      'A late upload keeps its original capture time but is marked for review.',
    ],
    links: [{ label: 'Open the live attendance monitor', href: '/boss/attendance' }],
  }
}

async function fraudFlagsAnswer(kind: 'duplicate_selfie' | 'impossible_travel'): Promise<AssistantAnswer> {
  const queue = await listReviewQueue(100)
  const rows = queue.filter((event) => event.fraud_flags?.includes(kind))
  const label = kind === 'duplicate_selfie' ? 'Duplicate selfie' : 'Impossible travel'

  return {
    intent: kind === 'duplicate_selfie' ? 'duplicate_selfie' : 'impossible_travel',
    title: `${label} flags`,
    summary:
      rows.length === 0
        ? `No ${label.toLowerCase()} flags are waiting in the review queue.`
        : `${rows.length} capture${rows.length === 1 ? ' has' : 's have'} a ${label.toLowerCase()} flag.`,
    table:
      rows.length > 0
        ? {
            columns: ['Date', 'Employee', 'Type', 'Flag'],
            rows: rows.map((event) => [
              formatDateHuman(event.work_date),
              `${event.employee_name} (${event.employee_code})`,
              event.type === 'check_in' ? 'Check-in' : 'Check-out',
              label,
            ]),
          }
        : undefined,
    links: [{ label: 'Open the review queue', href: '/boss/attendance?filter=review&scope=all' }],
  }
}

async function leaveHistoryAnswer(employee: Employee, year: string): Promise<AssistantAnswer> {
  const leaves = await listEmployeeLeaves(employee.id, year)
  const approved = leaves.filter((leave) => leave.status === 'approved')
  const pending = leaves.filter((leave) => leave.status === 'pending' || leave.status === 'submitted')

  return {
    intent: 'leave_history',
    title: `${employee.full_name} — leave history ${year}`,
    summary:
      leaves.length === 0
        ? `No leave requests recorded for ${employee.full_name} in ${year}.`
        : `${leaves.length} request${leaves.length === 1 ? '' : 's'} in ${year}: ${approved.length} approved, ${pending.length} pending.`,
    table:
      leaves.length > 0
        ? {
            columns: ['Type', 'From', 'To', 'Days', 'Status'],
            rows: leaves.map((leave) => [
              titleCase(leave.type),
              formatDateHuman(leave.start_date),
              formatDateHuman(leave.end_date),
              String(leave.days),
              titleCase(leave.status),
            ]),
          }
        : undefined,
    links: [{ label: `Open ${employee.full_name.split(' ')[0]}’s profile`, href: `/boss/employees/${employee.id}` }],
  }
}

async function perfectAttendanceAnswer(anchor: string, label: string): Promise<AssistantAnswer> {
  const team = await listTeamEmployees()
  const rows = await Promise.all(
    team.map(async (employee) => ({
      employee,
      summary: (await getMonthEvaluations(employee.id, anchor)).summary,
    })),
  )
  const perfect = rows.filter(
    (row) => row.summary.lateDays === 0 && row.summary.absentDays === 0 && row.summary.presentDays > 0,
  )

  return {
    intent: 'perfect_attendance',
    title: `Perfect attendance — ${label}`,
    summary:
      perfect.length === 0
        ? `No employee has perfect attendance in ${label} yet.`
        : `${perfect.length} employee${perfect.length === 1 ? ' has' : 's have'} no late day and no absence in ${label}.`,
    table:
      perfect.length > 0
        ? {
            columns: ['Employee', 'Present days', 'On time', 'Worked hours'],
            rows: perfect.map((row) => [
              `${row.employee.full_name} (${row.employee.employee_code})`,
              String(row.summary.presentDays),
              String(row.summary.onTimeDays),
              String(row.summary.workedHours),
            ]),
          }
        : undefined,
    links: [{ label: 'Open reports', href: '/boss/reports' }],
  }
}

async function topAbsentAnswer(anchor: string, label: string): Promise<AssistantAnswer> {
  const team = await listTeamEmployees()
  const rows = await Promise.all(
    team.map(async (employee) => ({
      employee,
      summary: (await getMonthEvaluations(employee.id, anchor)).summary,
    })),
  )
  const filtered = rows
    .filter((row) => row.summary.absentDays > 0)
    .sort((a, b) => b.summary.absentDays - a.summary.absentDays || a.employee.full_name.localeCompare(b.employee.full_name))
    .slice(0, 10)

  return {
    intent: 'top_absent',
    title: `Absences — ${label}`,
    summary:
      filtered.length === 0
        ? `No absences recorded in ${label}.`
        : `${filtered.length} employee${filtered.length === 1 ? ' has' : 's have'} at least one absent day in ${label}, highest first.`,
    table:
      filtered.length > 0
        ? {
            columns: ['#', 'Employee', 'Absent days', 'Late days', 'Present days'],
            rows: filtered.map((row, index) => [
              String(index + 1),
              `${row.employee.full_name} (${row.employee.employee_code})`,
              String(row.summary.absentDays),
              String(row.summary.lateDays),
              String(row.summary.presentDays),
            ]),
          }
        : undefined,
    links: [{ label: 'Open reports', href: '/boss/reports' }],
  }
}

async function overtimeAnswer(anchor: string, label: string): Promise<AssistantAnswer> {
  const team = await listTeamEmployees()
  const rows = await Promise.all(
    team.map(async (employee) => ({
      employee,
      summary: (await getMonthEvaluations(employee.id, anchor)).summary,
    })),
  )
  const withOvertime = rows
    .filter((row) => row.summary.overtimeHours > 0)
    .sort((a, b) => b.summary.overtimeHours - a.summary.overtimeHours)

  return {
    intent: 'overtime',
    title: `Overtime — ${label}`,
    summary:
      withOvertime.length === 0
        ? `No overtime recorded in ${label}.`
        : `${withOvertime.length} employee${withOvertime.length === 1 ? ' has' : 's have'} overtime in ${label}.`,
    table:
      withOvertime.length > 0
        ? {
            columns: ['Employee', 'Overtime hours', 'Worked hours', 'Present days'],
            rows: withOvertime.map((row) => [
              `${row.employee.full_name} (${row.employee.employee_code})`,
              String(row.summary.overtimeHours),
              String(row.summary.workedHours),
              String(row.summary.presentDays),
            ]),
          }
        : undefined,
    links: [{ label: 'Open reports', href: '/boss/reports' }],
  }
}

async function joinedThisMonthAnswer(anchor: string, label: string): Promise<AssistantAnswer> {
  const month = anchor.slice(0, 7)
  const team = await listTeamEmployees()
  const rows = team.filter((employee) => employee.joining_date?.startsWith(month))

  return {
    intent: 'joined_this_month',
    title: `New joiners — ${label}`,
    summary:
      rows.length === 0
        ? `No employee joined in ${label}.`
        : `${rows.length} employee${rows.length === 1 ? ' joined' : 's joined'} in ${label}.`,
    table:
      rows.length > 0
        ? {
            columns: ['Employee', 'Code', 'Department', 'Joined'],
            rows: rows.map((row) => [
              row.full_name,
              row.employee_code,
              row.department ?? 'Unassigned',
              formatDateHuman(row.joining_date),
            ]),
          }
        : undefined,
    links: [{ label: 'Open the employee directory', href: '/boss/employees' }],
  }
}

async function departmentHeadcountAnswer(): Promise<AssistantAnswer> {
  const team = await listTeamEmployees()
  const counts = new Map<string, number>()
  for (const employee of team) {
    const department = employee.department ?? 'Unassigned'
    counts.set(department, (counts.get(department) ?? 0) + 1)
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1])

  return {
    intent: 'department_headcount',
    title: 'Headcount by department',
    summary: `${team.length} active team member${team.length === 1 ? '' : 's'} across ${rows.length} department${rows.length === 1 ? '' : 's'}.`,
    table: rows.length > 0 ? { columns: ['Department', 'Employees'], rows: rows.map(([name, count]) => [name, String(count)]) } : undefined,
    links: [{ label: 'Open the employee directory', href: '/boss/employees' }],
  }
}

async function inactiveEmployeesAnswer(): Promise<AssistantAnswer> {
  const employees = await listEmployees({ includeInactive: true })
  const rows = employees.filter((employee) => employee.status !== 'active')
  return {
    intent: 'inactive_employees',
    title: 'Inactive employees',
    summary:
      rows.length === 0
        ? 'No employee account is inactive.'
        : `${rows.length} employee account${rows.length === 1 ? ' is' : 's are'} inactive.`,
    table:
      rows.length > 0
        ? {
            columns: ['Employee', 'Code', 'Department'],
            rows: rows.map((row) => [row.full_name, row.employee_code, row.department ?? 'Unassigned']),
          }
        : undefined,
    links: [{ label: 'Open the employee directory', href: '/boss/employees?status=inactive' }],
  }
}

async function leaveBalanceAnswer(employee: Employee, anchor: string): Promise<AssistantAnswer> {
  const balance = await getLeaveBalance(employee.id, anchor.slice(0, 4))
  const entitlement = balance.entitlement + balance.carryForward
  return {
    intent: 'leave_balance',
    title: `${employee.full_name} — leave balance`,
    summary: `${balance.annualRemaining} of ${entitlement} annual leave day(s) are still available this year.`,
    bullets: [
      `Annual entitlement: ${balance.entitlement} day(s) + ${balance.carryForward} carried forward`,
      `Annual used: ${balance.annualUsed}`,
      `Annual pending approval: ${balance.annualPending}`,
      `Sick leave used: ${balance.sickUsed}`,
      `Casual leave used: ${balance.casualUsed}`,
      `Unpaid leave used: ${balance.unpaidUsed}`,
      `Emergency leave used: ${balance.emergencyUsed}`,
    ],
    links: [{ label: `Open ${employee.full_name.split(' ')[0]}’s profile`, href: `/boss/employees/${employee.id}` }],
  }
}

async function employeeSummaryAnswer(employee: Employee, anchor: string, label: string): Promise<AssistantAnswer> {
  const { summary } = await getMonthEvaluations(employee.id, anchor)
  return {
    intent: 'employee_summary',
    title: `${employee.full_name} — ${label}`,
    summary: `${summary.attendancePercentage}% attendance across ${summary.presentDays} present day(s) out of ${summary.workingDays} working day(s).`,
    bullets: [
      `On time: ${summary.onTimeDays} day(s)`,
      `Late: ${summary.lateDays} day(s)`,
      `Absent: ${summary.absentDays} day(s)`,
      `Approved leave: ${summary.leaveDays} day(s)`,
      `Pending sync: ${summary.pendingDays} day(s)`,
      `Average check-in: ${summary.averageCheckIn ?? '—'}`,
      `Average check-out: ${summary.averageCheckOut ?? '—'}`,
      `Total worked hours: ${summary.workedHours}`,
    ],
    links: [{ label: `Open ${employee.full_name.split(' ')[0]}’s profile`, href: `/boss/employees/${employee.id}` }],
  }
}

async function monthOverviewAnswer(anchor: string, label: string): Promise<AssistantAnswer> {
  const totals = await getCompanyStatusTotals(anchor)
  const denominator = totals.present + totals.absent + totals.leave
  const percentage = denominator > 0 ? Math.round(((totals.present + totals.leave) / denominator) * 100) : 0
  return {
    intent: 'month_overview',
    title: `Company summary — ${label}`,
    summary: `${percentage}% attendance month-to-date across ${denominator} employee-day(s).`,
    bullets: [
      `Present: ${totals.present} day(s)`,
      `On time: ${totals.onTime} day(s)`,
      `Late: ${totals.late} day(s)`,
      `Absent: ${totals.absent} day(s)`,
      `Approved leave: ${totals.leave} day(s)`,
    ],
    links: [{ label: 'Open reports', href: '/boss/reports' }],
  }
}

async function flaggedCountAnswer(workDate: string): Promise<AssistantAnswer> {
  const flagged = await countFlaggedEvents(startOfMonth(workDate), workDate)
  return {
    intent: 'flagged_this_month',
    title: 'Flagged captures this month',
    summary: `${flagged} attendance event${flagged === 1 ? ' was' : 's were'} flagged for review this month.`,
    links: [{ label: 'Open the review queue', href: '/boss/attendance?filter=review&scope=all' }],
  }
}

function whichEmployeeAnswer(question: string, candidates: Employee[]): AssistantAnswer {
  if (candidates.length === 0) {
    return {
      intent: 'unknown_employee',
      title: 'Which employee do you mean?',
      summary:
        'I could not find that name in the active employee list. Use the full name or the employee code, for example “Summary for Ali Raza this month”.',
      suggestions: buildSuggestions(),
    }
  }

  return {
    intent: 'ambiguous_employee',
    title: 'More than one employee matches',
    summary: 'Please include the full name or employee code so I answer about the right person.',
    table: {
      columns: ['Employee', 'Code', 'Department'],
      rows: candidates.slice(0, 10).map((employee) => [
        employee.full_name,
        employee.employee_code,
        employee.department ?? 'Unassigned',
      ]),
    },
    suggestions: candidates.slice(0, 3).map((employee) => `Summary for ${employee.full_name} this month`),
  }
}

function fallbackAnswer(employees: Employee[]): AssistantAnswer {
  return {
    intent: 'fallback',
    title: 'I did not understand that question',
    summary:
      'I only answer a fixed set of attendance, leave and payroll questions in English. Try one of the examples below, or ask “What can you do?”.',
    suggestions: buildSuggestions(employees),
  }
}

// ---------------- router ----------------

export async function answerQuestion(rawQuestion: string, userId: string): Promise<AssistantAnswer> {
  const question = normalize(String(rawQuestion ?? '').slice(0, 300))
  if (!question) return promptAnswer()

  if (
    hasAny(question, ['help', 'what can you do', 'what can i ask', 'how do you work', 'what do you know', 'commands', 'examples'])
  ) {
    return helpAnswer()
  }

  if (hasAny(question, ['gate code', 'entrance code', 'qr code', 'gate policy', 'gate required', 'is the gate'])) {
    return gateAnswer()
  }

  if (hasAny(question, ['notification', 'notifications', 'alerts', 'inbox'])) {
    return notificationsAnswer(userId)
  }

  if (
    hasAny(question, ['how many employees', 'employee count', 'staff count', 'list employees', 'who works here', 'team size', 'number of employees'])
  ) {
    return employeeCountAnswer()
  }

  const workDate = toWorkDate()
  const month = resolveMonth(question, workDate)
  const day = resolveDay(question, workDate)

  // ---- policy / operations ----
  if (
    hasAny(question, [
      'work hours',
      'office hours',
      'office timing',
      'office timings',
      'work start',
      'work end',
      'grace period',
      'office radius',
      'office location',
      'office policy',
      'attendance policy',
    ])
  ) {
    return officePolicyAnswer()
  }

  if (hasAny(question, ['pending sync', 'offline event', 'offline events', 'not synced', 'waiting to sync'])) {
    return pendingSyncAnswer()
  }

  if (hasAny(question, ['inactive employee', 'inactive employees', 'deactivated', 'disabled account'])) {
    return inactiveEmployeesAnswer()
  }

  if (hasAny(question, ['duplicate selfie', 'same selfie', 'reused selfie', 'identical selfie'])) {
    return fraudFlagsAnswer('duplicate_selfie')
  }

  if (hasAny(question, ['impossible travel', 'too far to be possible'])) {
    return fraudFlagsAnswer('impossible_travel')
  }

  if (hasAny(question, ['department headcount', 'headcount by department', 'employees by department', 'department count'])) {
    return departmentHeadcountAnswer()
  }

  if (hasAny(question, ['new joiner', 'new joiners', 'new hire', 'new hires', 'joined this month', 'who joined'])) {
    return joinedThisMonthAnswer(month.anchor, month.label)
  }

  if (hasAny(question, ['perfect attendance', 'no late', 'zero late', 'no absence'])) {
    return perfectAttendanceAnswer(month.anchor, month.label)
  }

  if (hasAny(question, ['most absent', 'top absent', 'absent the most', 'highest absence', 'absent this month'])) {
    return topAbsentAnswer(month.anchor, month.label)
  }

  if (hasAny(question, ['overtime', 'extra hours'])) {
    return overtimeAnswer(month.anchor, month.label)
  }

  // ---- day-level attendance ----
  if (
    hasAny(question, ['on leave today', 'who is on leave', 'leave today', 'on leave right now', 'on leave yesterday'])
  ) {
    return onLeaveTodayAnswer(day.date, day.label)
  }

  if (hasAny(question, ['pending leave', 'leave request', 'leave requests', 'approve leave', 'leaves waiting', 'leave approval'])) {
    return pendingLeavesAnswer()
  }

  if (
    hasAny(question, ['not checked out', 'havent checked out', 'still in office', 'still working', 'didnt check out', 'no checkout', 'missing checkout', 'still clocked in'])
  ) {
    return notCheckedOutAnswer()
  }

  if (hasAny(question, ['checked out', 'check out', 'checkout', 'check outs'])) {
    return checkedOutOnDateAnswer(day.date, day.label)
  }

  if (
    hasAny(question, ['who is absent', 'absent today', 'absent yesterday', 'absent employees', 'absent right now', 'not present today', 'not checked in today', 'not checked in yesterday'])
  ) {
    return absentOnDateAnswer(day.date, day.label)
  }

  if (
    hasAny(question, ['most late', 'top late', 'late the most', 'late days', 'late count', 'late this month', 'who is late the most']) ||
    (parseThreshold(question) !== null && question.includes('late'))
  ) {
    const employees = await listTeamEmployees()
    return topLateAnswer(question, employees, month.anchor, month.label)
  }

  if (hasAny(question, ['late today', 'late yesterday', 'who is late', 'late employees', 'late right now', 'arrived late', 'came late', 'who was late'])) {
    return lateOnDateAnswer(day.date, day.label)
  }

  if (
    hasAny(question, ['present today', 'how many present', 'checked in today', 'who checked in', 'attendance today', 'today summary', 'summary today', 'today overview', 'yesterday summary', 'yesterday overview', 'attendance yesterday', 'who was present', 'day summary', 'at a glance'])
  ) {
    return daySummaryAnswer(day.date, day.label)
  }

  if (
    hasAny(question, ['review queue', 'needs my review', 'needs review', 'what needs review', 'what should i review', 'pending review', 'what needs my attention', 'needs my attention', 'approve attendance', 'pending attendance', 'flagged this month', 'how many flagged'])
  ) {
    if (question.includes('flagged this month') || question.includes('how many flagged')) {
      return flaggedCountAnswer(workDate)
    }
    return pendingReviewsAnswer()
  }

  // Everything below may need to resolve an employee name.
  const employees = await listEmployees()
  const match = findEmployee(question, employees)
  const employee = match.kind === 'one' ? match.employee : null

  const payrollWords = hasAny(question, ['payroll', 'salary', 'net pay', 'deduction', 'deductions', 'bonus', 'bonuses'])
  if (payrollWords) {
    if (match.kind === 'many') return whichEmployeeAnswer(question, match.candidates)
    return payrollAnswer(employee, month.anchor, month.label)
  }

  const leaveHistoryWords = hasAny(question, [
    'leave history',
    'leaves taken',
    'leave record',
    'leave records',
    'past leaves',
    'leave requests of',
  ])
  if (leaveHistoryWords) {
    if (match.kind === 'many') return whichEmployeeAnswer(question, match.candidates)
    if (match.kind === 'one') return leaveHistoryAnswer(match.employee, month.anchor.slice(0, 4))
    return whichEmployeeAnswer(question, [])
  }

  const leaveWords = hasAny(question, [
    'leave balance',
    'leaves left',
    'leave left',
    'remaining leave',
    'how many leaves',
    'leave allowance',
  ])
  if (leaveWords) {
    if (match.kind === 'many') return whichEmployeeAnswer(question, match.candidates)
    if (match.kind === 'one') return leaveBalanceAnswer(match.employee, month.anchor)
    return whichEmployeeAnswer(question, [])
  }

  const summaryWords = hasAny(question, [
    'summary',
    'attendance',
    'report',
    'how is',
    'how many',
    'late',
    'absent',
    'hours',
    'on time',
    'performance',
  ])
  if (match.kind === 'many') return whichEmployeeAnswer(question, match.candidates)
  if (match.kind === 'one' && (summaryWords || question.includes('leave'))) {
    return employeeSummaryAnswer(match.employee, month.anchor, month.label)
  }

  if (
    hasAny(question, ['this month', 'last month', 'month summary', 'month overview', 'company summary', 'attendance this month', 'monthly summary', 'how was this month', 'how is attendance'])
  ) {
    return monthOverviewAnswer(month.anchor, month.label)
  }

  if (question.includes('flag')) {
    return flaggedCountAnswer(workDate)
  }

  return fallbackAnswer(employees)
}
