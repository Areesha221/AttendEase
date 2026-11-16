#!/usr/bin/env node
// ============================================================
// Generate realistic, deterministic SAMPLE attendance for the
// employees that remain after the demo accounts are removed.
//
// Why: the seeded demo attendance belongs to demo employees, so
// deleting them leaves every dashboard/report empty. This script
// fills the last four weeks with believable check-in/out events so
// the portfolio deployment looks alive.
//
// Usage (from attendance-app/):
//   node scripts/generate-sample-attendance.mjs                 # local data/attendance.db
//   node scripts/generate-sample-attendance.mjs --url=libsql://… --token=…
//   node scripts/generate-sample-attendance.mjs --dry-run       # print, write nothing
//
// Rows are tagged with event ids starting `sample-`, so re-running
// replaces only sample rows and never touches real attendance.
// ============================================================

import { createClient } from '@libsql/client'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const argValue = (name) => {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.indexOf(name)
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return undefined
}
const dryRun = args.includes('--dry-run')

function loadEnvLocal() {
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnvLocal()

const url =
  argValue('--url') ??
  process.env.TURSO_DATABASE_URL ??
  `file:${path.join(process.cwd(), 'data', 'attendance.db').replace(/\\/g, '/')}`
const token = argValue('--token') ?? process.env.TURSO_AUTH_TOKEN
const isRemote = /^(libsql|https?|wss?):/i.test(url)

// ---- deterministic pseudo-random numbers (same output every run) ----
function mulberry32(seed) {
  let a = seed
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261117)
const pick = (min, max) => min + rand() * (max - min)
const int = (min, max) => Math.floor(pick(min, max + 1))

const pad = (n) => String(n).padStart(2, '0')

/** PKT (UTC+05:00) wall-clock time as YYYY-MM-DDTHH:mm:ss+05:00. */
function pktStamp(date, hour, minute, second = 0) {
  return `${date}T${pad(hour)}:${pad(minute)}:${pad(second)}+05:00`
}
function isoDate(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

const TODAY = new Date()
// "Today" in Pakistan time (the app's authoritative timezone), not the
// machine's local/UTC date — they can differ by a day.
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Karachi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(TODAY)
const [todayYear, todayMonth, todayDay] = today.split('-').map(Number)
const todayUtcMidnight = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay))
const windowDays = 28

const PROFILES = [
  {
    match: ['Hamza Sheikh'],
    joining: null, // keep existing (2022)
    start: [8 * 60 + 25, 8 * 60 + 55], // 08:25 – 08:55
    end: [17 * 60 + 10, 17 * 60 + 35],
    lateChance: 0.05,
    absenceDays: 0,
    checkInToday: true,
  },
  {
    match: ['Areesha'],
    joining: '2026-09-01',
    start: [8 * 60 + 48, 9 * 60 + 8], // 08:48 – 09:08
    end: [17 * 60 + 15, 17 * 60 + 45],
    lateChance: 0.1,
    absenceDays: 2,
    checkInToday: true,
  },
  {
    match: ['Hina Qureshi'],
    joining: '2026-09-15',
    start: [8 * 60 + 50, 9 * 60 + 12], // 08:50 – 09:12
    end: [17 * 60 + 5, 17 * 60 + 40],
    lateChance: 0.14,
    absenceDays: 2,
    checkInToday: true,
  },
]

const ABSENCE_DAYS = {
  Areesha: ['2026-10-27', '2026-11-11'],
  'Hina Qureshi': ['2026-10-29', '2026-11-12'],
}

async function main() {
  const client = createClient({ url, authToken: isRemote ? token : undefined })
  try {
    const settingsRow = (
      await client.execute(
        'SELECT office_lat, office_lng, weekend_days, work_start, work_end FROM settings WHERE id = 1',
      )
    ).rows[0]
    if (!settingsRow) {
      console.error('settings row is missing — run the migration or seed first.')
      process.exitCode = 1
      return
    }
    const officeLat = Number(settingsRow.office_lat)
    const officeLng = Number(settingsRow.office_lng)
    const weekendDays = String(settingsRow.weekend_days ?? '0')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value))

    const employees = (
      await client.execute(
        "SELECT id, employee_code, full_name FROM employees WHERE status = 'active' ORDER BY employee_code",
      )
    ).rows

    const holidays = new Set(
      (await client.execute('SELECT date FROM holidays')).rows.map((row) => String(row.date)),
    )

    // Working dates: last 4 weeks, excluding weekends and public holidays.
    const workDates = []
    for (let offset = windowDays; offset >= 1; offset -= 1) {
      const d = new Date(todayUtcMidnight.getTime() - offset * 24 * 60 * 60 * 1000)
      const iso = isoDate(d)
      if (weekendDays.includes(d.getUTCDay())) continue
      if (holidays.has(iso)) continue
      workDates.push(iso)
    }

    const plan = []
    for (const employee of employees) {
      const name = String(employee.full_name)
      const profile = PROFILES.find((item) => item.match.includes(name))
      if (!profile) continue

      const absent = new Set(ABSENCE_DAYS[name] ?? [])
      // Choose which working days this person is absent on (deterministic).
      const eligible = workDates.filter((date) => !absent.has(date))
      const chosenAbsences = new Set(eligible.slice(0, profile.absenceDays))
      const inserting = []
      for (const date of workDates) {
        if (chosenAbsences.has(date)) continue

        const late = rand() < profile.lateChance
        // Late means arriving after the 09:15 grace period.
        const startMinutes = late ? int(9 * 60 + 18, 9 * 60 + 36) : int(profile.start[0], profile.start[1])
        const endMinutes = int(profile.end[0], profile.end[1])

        const distance = Number(pick(12, 89).toFixed(1))
        const accuracy = Number(pick(5, 22).toFixed(1))
        inserting.push({
          date,
          startHour: Math.floor(startMinutes / 60),
          startMinute: startMinutes % 60,
          endHour: Math.floor(endMinutes / 60),
          endMinute: endMinutes % 60,
          distance,
          accuracy,
        })
      }

      // Today: a live check-in without a check-out, so the dashboard is not empty.
      // Only when the office day has actually started (PKT), never in the future.
      const now = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(TODAY)
      const [nowHour, nowMinute] = now.split(':').map(Number)
      const nowMinutes = nowHour * 60 + nowMinute
      if (profile.checkInToday && nowMinutes >= 9 * 60 + 30) {
        const minutes = int(8 * 60 + 40, Math.min(9 * 60 + 12, nowMinutes - 5))
        inserting.push({
          date: today,
          startHour: Math.floor(minutes / 60),
          startMinute: minutes % 60,
          endHour: null,
          endMinute: null,
          distance: Number(pick(15, 70).toFixed(1)),
          accuracy: Number(pick(5, 18).toFixed(1)),
        })
      }

      plan.push({
        employee,
        profile,
        inserting: inserting.sort((a, b) => a.date.localeCompare(b.date)),
      })
    }

    let rowCount = 0
    for (const item of plan) {
      rowCount += item.inserting.length * 2 - item.inserting.filter((row) => row.endHour === null).length
    }

    console.log(`Target : ${url.replace(/\/\/([^@/]+)@/, '//***@')}`)
    console.log(`Dates  : ${workDates[0]} → ${workDates[workDates.length - 1]} (+ today ${today})`)
    console.log(`People : ${plan.map((item) => item.employee.full_name).join(', ')}`)
    console.log(`Rows   : ${rowCount} attendance events`)
    for (const item of plan) {
      console.log(`  ${item.employee.employee_code} ${item.employee.full_name}: ${item.inserting.length} day(s)`)
    }

    if (dryRun) {
      console.log('\nDry run — nothing written.')
      return
    }

    // Replace previous sample rows only.
    const removed = await client.execute("DELETE FROM attendance WHERE event_id LIKE 'sample-%'")
    console.log(`\nRemoved ${removed.rowsAffected} previous sample row(s).`)

    const tx = await client.transaction('write')
    try {
      for (const item of plan) {
        const employeeId = String(item.employee.id)
        const code = String(item.employee.employee_code)

        if (item.profile.joining) {
          await tx.execute({
            sql: 'UPDATE employees SET joining_date = ? WHERE id = ?',
            args: [item.profile.joining, employeeId],
          })
        }

        for (const row of item.inserting) {
          const inTime = pktStamp(row.date, row.startHour, row.startMinute, int(0, 59))
          await tx.execute({
            sql: `INSERT INTO attendance
                    (id, event_id, employee_id, type, work_date, server_time, device_time, photo,
                     latitude, longitude, accuracy_m, distance_m, location_status, sync_status,
                     verification, review_status, created_at)
                  VALUES (?, ?, ?, 'check_in', ?, ?, ?, NULL, ?, ?, ?, ?, 'inside', 'synced',
                          'verified', 'not_required', ?)`,
            args: [
              `att_sample_${code}_${row.date}_in`,
              `sample-${code}-${row.date}-in`,
              employeeId,
              row.date,
              inTime,
              inTime,
              officeLat + 0.0003,
              officeLng - 0.0004,
              row.accuracy,
              row.distance,
              inTime,
            ],
          })

          if (row.endHour !== null && row.endMinute !== null) {
            const outTime = pktStamp(row.date, row.endHour, row.endMinute, int(0, 59))
            await tx.execute({
              sql: `INSERT INTO attendance
                      (id, event_id, employee_id, type, work_date, server_time, device_time, photo,
                       latitude, longitude, accuracy_m, distance_m, location_status, sync_status,
                       verification, review_status, created_at)
                    VALUES (?, ?, ?, 'check_out', ?, ?, ?, NULL, ?, ?, ?, ?, 'inside', 'synced',
                            'verified', 'not_required', ?)`,
              args: [
                `att_sample_${code}_${row.date}_out`,
                `sample-${code}-${row.date}-out`,
                employeeId,
                row.date,
                outTime,
                outTime,
                officeLat + 0.0002,
                officeLng + 0.0003,
                row.accuracy,
                row.distance,
                outTime,
              ],
            })
          }
        }
      }
      await tx.commit()
    } catch (error) {
      await tx.rollback()
      throw error
    } finally {
      tx.close()
    }

    const total = await client.execute("SELECT COUNT(*) AS n FROM attendance WHERE event_id LIKE 'sample-%'")
    console.log(`✓ Inserted ${total.rows[0].n} sample attendance events.`)
  } finally {
    client.close()
  }
}

main().catch((error) => {
  console.error('Sample generation failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
