// ============================================================
// Asia/Karachi (PKT, UTC+05:00) time helpers.
// All attendance timestamps come from the SERVER clock in this
// timezone, never from the employee's device clock alone.
// Pakistan does not observe daylight saving, so a fixed +05:00
// offset is correct year-round.
// ============================================================

export const TIME_ZONE = 'Asia/Karachi'
export const PKT_OFFSET = '+05:00'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type TimeParts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}

function partsOf(date: Date): TimeParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const out: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = part.value
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === '24' ? '00' : out.hour,
    minute: out.minute,
    second: out.second,
  }
}

/** YYYY-MM-DD for a moment in Karachi time. */
export function toWorkDate(date: Date = new Date()): string {
  const p = partsOf(date)
  return `${p.year}-${p.month}-${p.day}`
}

/** HH:mm for a moment in Karachi time. */
export function toClock(date: Date = new Date()): string {
  const p = partsOf(date)
  return `${p.hour}:${p.minute}`
}

/** HH:mm:ss for a moment in Karachi time. */
export function toClockSeconds(date: Date = new Date()): string {
  const p = partsOf(date)
  return `${p.hour}:${p.minute}:${p.second}`
}

/** Authoritative server timestamp: 2026-08-08T08:58:00+05:00 */
export function toServerTime(date: Date = new Date()): string {
  const p = partsOf(date)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${PKT_OFFSET}`
}

/** "08-Aug-2026" */
export function formatDateHuman(workDate: string | null | undefined): string {
  if (!workDate) return '—'
  const [y, m, d] = workDate.split('-')
  const monthIndex = Number(m) - 1
  return `${d}-${MONTH_SHORT[monthIndex] ?? m}-${y}`
}

/** "8 Aug 2026" */
export function formatDateLong(workDate: string | null | undefined): string {
  if (!workDate) return '—'
  const [y, m, d] = workDate.split('-')
  const monthIndex = Number(m) - 1
  return `${Number(d)} ${MONTH_SHORT[monthIndex] ?? m} ${y}`
}

/** "09:05 AM" from "09:05" or "09:05:00" */
export function formatTime12(clock: string | null | undefined): string {
  if (!clock) return '—'
  const [hRaw, m] = clock.split(':')
  const h = Number(hRaw)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${String(hour12).padStart(2, '0')}:${m} ${suffix}`
}

/** "09:05 AM" from a full server timestamp. */
export function formatStamp12(stamp: string | null | undefined): string {
  if (!stamp) return '—'
  const clock = stamp.includes('T') ? stamp.split('T')[1]?.slice(0, 5) : stamp
  return formatTime12(clock)
}

/** Minutes since midnight for "HH:mm". */
export function minutesOf(clock: string | null | undefined): number {
  if (!clock) return 0
  const [h, m] = clock.split(':')
  return Number(h) * 60 + Number(m)
}

/** "HH:mm" from minutes since midnight. */
export function clockFromMinutes(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Weekday index (0 = Sunday) for a YYYY-MM-DD date string. */
export function weekdayOf(workDate: string): number {
  const [y, m, d] = workDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function weekdayName(workDate: string): string {
  return WEEKDAY_NAMES[weekdayOf(workDate)]
}

/** Weekend check against a settings value such as "0,6". */
export function isWeekend(workDate: string, weekendDays: string): boolean {
  const set = weekendDays.split(',').map((value) => Number(value.trim()))
  return set.includes(weekdayOf(workDate))
}

/** Whole days between two YYYY-MM-DD dates (inclusive). */
export function daysBetweenInclusive(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

/** List of YYYY-MM-DD dates from start to end (inclusive). */
export function eachDate(start: string, end: string): string[] {
  const dates: string[] = []
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return dates
  for (let t = a; t <= b; t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10))
  }
  return dates
}

export function startOfMonth(workDate: string): string {
  return `${workDate.slice(0, 7)}-01`
}

export function endOfMonth(workDate: string): string {
  const [y, m] = workDate.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${workDate.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

/** "November 2026" */
export function monthLabel(workDate: string): string {
  const [y, m] = workDate.split('-').map(Number)
  const full = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${full[m - 1] ?? m} ${y}`
}

/** Shift a YYYY-MM-DD date by N days. */
export function shiftDate(workDate: string, days: number): string {
  const base = Date.parse(`${workDate}T00:00:00Z`)
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10)
}

/** Hours between two "HH:mm" clocks, e.g. 08:58 -> 17:06 = 8.13 */
export function hoursBetween(startClock: string | null | undefined, endClock: string | null | undefined): number {
  if (!startClock || !endClock) return 0
  const diff = minutesOf(endClock) - minutesOf(startClock)
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0
}

export function formatHours(hours: number | null | undefined): string {
  if (!hours) return '0h 00m'
  const total = Math.round(hours * 60)
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}

/** Great-circle distance in meters. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

/** Mask a CNIC: 42101-1234567-1 -> 42101-*******-1 */
export function maskCnic(cnic: string | null | undefined): string {
  if (!cnic) return '—'
  const parts = cnic.split('-')
  if (parts.length === 3) return `${parts[0]}-${'*'.repeat(parts[1].length)}-${parts[2]}`
  return `${cnic.slice(0, 4)}${'*'.repeat(Math.max(cnic.length - 5, 0))}${cnic.slice(-1)}`
}

/** Days remaining until a YYYY-MM-DD deadline (negative = passed). */
export function daysUntil(deadline: string | null | undefined, from: string = toWorkDate()): number | null {
  if (!deadline) return null
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${deadline}T00:00:00Z`)
  if (Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}
