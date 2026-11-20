// ============================================================
// Attendance classification + payroll math.
// Pure functions only (no database access) so they can be used
// on the server and in Client Components alike.
// ============================================================

import { clockFromMinutes, hoursBetween, minutesOf } from '@/lib/time'

export type DayStatus =
  | 'on_time'
  | 'late'
  | 'absent'
  | 'leave'
  | 'holiday'
  | 'weekend'
  | 'upcoming'
  | 'pending'
  | 'before_joining'

export const STATUS_META: Record<DayStatus, { label: string; tone: 'green' | 'yellow' | 'red' | 'blue' | 'slate'; dot: string }> = {
  on_time: { label: 'On time', tone: 'green', dot: 'bg-emerald-500' },
  late: { label: 'Late', tone: 'yellow', dot: 'bg-amber-500' },
  absent: { label: 'Absent', tone: 'red', dot: 'bg-rose-500' },
  leave: { label: 'Leave', tone: 'blue', dot: 'bg-sky-500' },
  holiday: { label: 'Holiday', tone: 'blue', dot: 'bg-indigo-500' },
  weekend: { label: 'Weekend', tone: 'slate', dot: 'bg-slate-400' },
  upcoming: { label: 'Upcoming', tone: 'slate', dot: 'bg-slate-300' },
  pending: { label: 'Pending sync', tone: 'yellow', dot: 'bg-amber-400' },
  before_joining: { label: 'Before joining', tone: 'slate', dot: 'bg-slate-300' },
}

export const TONE_CLASSES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
}

/**
 * GPS fixes with a reported accuracy worse than this cannot reliably prove
 * the employee was inside a ~100 m office radius, so they are flagged for the
 * boss even when the coordinates happen to land inside the geo-fence.
 */
export const GPS_ACCURACY_LIMIT_M = 150

export type AttendanceEvent = {
  id: string
  event_id: string
  employee_id: string
  type: 'check_in' | 'check_out'
  work_date: string
  server_time: string
  device_time: string | null
  photo: string | null
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  distance_m: number | null
  location_status: string | null
  sync_status: 'synced' | 'pending'
  verification: 'pending' | 'verified' | 'flagged'
  review_status: 'not_required' | 'pending' | 'approved' | 'rejected'
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  reason: string | null
  photo_hash: string | null
  photo_sha: string | null
  fraud_flags: string | null
  gate_status: 'valid' | 'invalid' | 'missing' | 'not_required' | null
}

export type PolicyLike = {
  work_start: string
  work_end: string
  grace_minutes: number
  required_hours: number
  weekend_days: string
  late_penalty: number
  work_days_per_month: number
  absence_deduction_days: number
  unpaid_leave_deduction_days: number
}

export type DayEvaluation = {
  workDate: string
  status: DayStatus
  checkIn: AttendanceEvent | null
  checkOut: AttendanceEvent | null
  lateMinutes: number
  earlyMinutes: number
  hours: number
  overtimeHours: number
  insideOffice: boolean | null
  hasPendingSync: boolean
}

export function eventClock(event: AttendanceEvent | null): string | null {
  if (!event) return null
  const time = event.server_time.includes('T') ? event.server_time.split('T')[1] : event.server_time
  return time.slice(0, 5)
}

/**
 * Decide the status of one working day.
 * Order of precedence: before joining > upcoming > holiday > weekend > leave > absent > late > on time.
 * Future dates are labelled `upcoming` and never counted as absence. Dates before the
 * employee's joining date are labelled `before_joining` and never counted at all.
 * Events the boss rejected are ignored.
 */
export function evaluateDay(input: {
  workDate: string
  events: AttendanceEvent[]
  onLeave?: boolean
  isHoliday?: boolean
  isWeekend?: boolean
  isFuture?: boolean
  isBeforeJoining?: boolean
  policy: PolicyLike
}): DayEvaluation {
  const {
    workDate,
    events,
    onLeave = false,
    isHoliday = false,
    isWeekend = false,
    isFuture = false,
    isBeforeJoining = false,
    policy,
  } = input

  // A rejected review means the boss decided this event does not count.
  const usableEvents = events.filter((event) => event.review_status !== 'rejected')
  const checkIn = usableEvents.find((event) => event.type === 'check_in') ?? null
  const checkOut = usableEvents.find((event) => event.type === 'check_out') ?? null
  const checkInClock = eventClock(checkIn)
  const checkOutClock = eventClock(checkOut)

  const graceLimit = minutesOf(policy.work_start) + policy.grace_minutes
  const lateMinutes = checkInClock ? Math.max(0, minutesOf(checkInClock) - graceLimit) : 0
  const earlyMinutes = checkOutClock ? Math.max(0, minutesOf(policy.work_end) - minutesOf(checkOutClock)) : 0
  const hours = hoursBetween(checkInClock, checkOutClock)
  const overtimeHours = Math.max(0, Math.round((hours - policy.required_hours) * 100) / 100)

  let status: DayStatus
  if (isBeforeJoining) status = 'before_joining'
  else if (isFuture) status = 'upcoming'
  else if (isHoliday) status = 'holiday'
  else if (isWeekend) status = 'weekend'
  else if (onLeave) status = 'leave'
  else if (!checkIn) status = 'absent'
  else if (lateMinutes > 0) status = 'late'
  else status = 'on_time'

  const hasPendingSync = usableEvents.some((event) => event.sync_status === 'pending')
  if (hasPendingSync && status !== 'absent') status = status === 'on_time' || status === 'late' ? 'pending' : status

  return {
    workDate,
    status,
    checkIn,
    checkOut,
    lateMinutes,
    earlyMinutes,
    hours,
    overtimeHours,
    insideOffice: checkIn ? checkIn.location_status === 'inside' : null,
    hasPendingSync,
  }
}

export type MonthSummary = {
  totalDays: number
  workingDays: number
  presentDays: number
  onTimeDays: number
  lateDays: number
  absentDays: number
  leaveDays: number
  holidayDays: number
  weekendDays: number
  pendingDays: number
  upcomingDays: number
  lateMinutesTotal: number
  earlyDepartures: number
  overtimeHours: number
  workedHours: number
  attendancePercentage: number
  averageCheckIn: string | null
  averageCheckOut: string | null
}

export function summarizeMonth(days: DayEvaluation[]): MonthSummary {
  const workingDays = days.filter(
    (day) =>
      day.status !== 'weekend' &&
      day.status !== 'holiday' &&
      day.status !== 'upcoming' &&
      day.status !== 'before_joining',
  ).length
  const onTimeDays = days.filter((day) => day.status === 'on_time').length
  const lateDays = days.filter((day) => day.status === 'late' || day.status === 'pending').length
  const absentDays = days.filter((day) => day.status === 'absent').length
  const leaveDays = days.filter((day) => day.status === 'leave').length
  const holidayDays = days.filter((day) => day.status === 'holiday').length
  const weekendDays = days.filter((day) => day.status === 'weekend').length
  const pendingDays = days.filter((day) => day.status === 'pending').length
  const upcomingDays = days.filter((day) => day.status === 'upcoming').length
  const presentDays = onTimeDays + lateDays

  const checkIns = days
    .map((day) => eventClock(day.checkIn))
    .filter((clock): clock is string => Boolean(clock))
  const checkOuts = days
    .map((day) => eventClock(day.checkOut))
    .filter((clock): clock is string => Boolean(clock))

  const average = (clocks: string[]): string | null => {
    if (clocks.length === 0) return null
    const total = clocks.reduce((sum, clock) => sum + minutesOf(clock), 0)
    return clockFromMinutes(Math.round(total / clocks.length))
  }

  return {
    totalDays: days.length,
    workingDays,
    presentDays,
    onTimeDays,
    lateDays,
    absentDays,
    leaveDays,
    holidayDays,
    weekendDays,
    pendingDays,
    upcomingDays,
    lateMinutesTotal: days.reduce((sum, day) => sum + day.lateMinutes, 0),
    earlyDepartures: days.filter((day) => day.earlyMinutes > 0).length,
    overtimeHours: Math.round(days.reduce((sum, day) => sum + day.overtimeHours, 0) * 100) / 100,
    workedHours: Math.round(days.reduce((sum, day) => sum + day.hours, 0) * 100) / 100,
    attendancePercentage: workingDays > 0 ? Math.round(((presentDays + leaveDays) / workingDays) * 100) : 0,
    averageCheckIn: average(checkIns),
    averageCheckOut: average(checkOuts),
  }
}

export type PayrollInput = {
  monthlySalary: number
  workDaysPerMonth: number
  lateCount: number
  latePenalty: number
  absentDays: number
  absenceDeductionDays: number
  unpaidLeaveDays: number
  unpaidLeaveDeductionDays: number
  bonusAmount?: number
  approvedLeaveDays?: number
}

export type PayrollBreakdown = {
  monthlySalary: number
  workDaysPerMonth: number
  dailyRate: number
  lateCount: number
  latePenaltyRate: number
  lateTotal: number
  absentDays: number
  absenceTotal: number
  unpaidLeaveDays: number
  unpaidLeaveTotal: number
  bonusAmount: number
  totalDeduction: number
  estimatedNet: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

// Owner concession: the boss is not required to mark attendance, so absence
// days are not deducted and the late penalty is halved.
export const OWNER_LATE_PENALTY_FACTOR = 0.5

/** Transparent, explainable payroll estimate (never auto-finalized). */
export function computePayroll(input: PayrollInput): PayrollBreakdown {
  const dailyRate = input.workDaysPerMonth > 0 ? input.monthlySalary / input.workDaysPerMonth : 0
  const lateTotal = round2(input.lateCount * input.latePenalty)
  const absenceTotal = round2(input.absentDays * input.absenceDeductionDays * dailyRate)
  const unpaidLeaveTotal = round2(input.unpaidLeaveDays * input.unpaidLeaveDeductionDays * dailyRate)
  const bonusAmount = round2(input.bonusAmount ?? 0)
  const totalDeduction = round2(lateTotal + absenceTotal + unpaidLeaveTotal)

  return {
    monthlySalary: input.monthlySalary,
    workDaysPerMonth: input.workDaysPerMonth,
    dailyRate: round2(dailyRate),
    lateCount: input.lateCount,
    latePenaltyRate: round2(input.latePenalty),
    lateTotal,
    absentDays: input.absentDays,
    absenceTotal,
    unpaidLeaveDays: input.unpaidLeaveDays,
    unpaidLeaveTotal,
    bonusAmount,
    totalDeduction,
    estimatedNet: round2(input.monthlySalary - totalDeduction + bonusAmount),
  }
}

export function formatPkr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Rs. 0'
  return `Rs. ${Math.round(amount).toLocaleString('en-PK')}`
}

export function leaveDaysExcludingWeekends(
  dates: string[],
  weekendDays: string,
  holidaySet: Set<string>,
): number {
  const weekend = weekendDays.split(',').map((value) => Number(value.trim()))
  return dates.filter((date) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    return !weekend.includes(weekday) && !holidaySet.has(date)
  }).length
}
