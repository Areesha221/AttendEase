// ============================================================
// Database inspector  ->  npm run db:check
//
// Opens the SQLite database in READ-ONLY mode and prints a short
// summary: every table with its row count, the login accounts,
// the employee records and the most recent audit-log entries.
//
// Use this to prove that what you do in the app (adding an
// employee, approving leave, changing a password, ...) is really
// written to data/attendance.db.
// ============================================================

import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const DB_PATH = process.env.ATTENDANCE_DB_PATH ?? path.join(root, 'data', 'attendance.db')

if (!fs.existsSync(DB_PATH)) {
  console.error(`\nDatabase not found at: ${DB_PATH}`)
  console.error('Create it first with:  npm run seed\n')
  process.exit(1)
}

const db = new DatabaseSync(DB_PATH, { readOnly: true })

const line = (char = '─') => console.log(char.repeat(60))

console.log(`\nDatabase file: ${DB_PATH}`)
const stat = fs.statSync(DB_PATH)
console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB   •   Last modified: ${stat.mtime.toLocaleString()}\n`)

// ---- tables + row counts ----
line('═')
console.log('TABLES AND ROW COUNTS')
line('═')
const tables = db
  .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
  .all()

for (const { name } of tables) {
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get()
  console.log(`  ${name.padEnd(22)} ${String(count).padStart(6)} row(s)`)
}

// ---- login accounts ----
line()
console.log('LOGIN ACCOUNTS (users)')
line()
const users = db.prepare(`SELECT email, role, is_active FROM users ORDER BY role, email`).all()
for (const user of users) {
  console.log(`  ${user.email.padEnd(22)} ${user.role.padEnd(9)} ${user.is_active ? 'active' : 'INACTIVE'}`)
}

// ---- employees ----
line()
console.log('EMPLOYEES')
line()
const employees = db
  .prepare(
    `SELECT employee_code, full_name, department, status, monthly_salary
     FROM employees ORDER BY employee_code`,
  )
  .all()
for (const employee of employees) {
  console.log(
    `  ${employee.employee_code.padEnd(10)} ${employee.full_name.padEnd(20)} ` +
      `${(employee.department ?? '—').padEnd(16)} ${employee.status.padEnd(8)} Rs. ${employee.monthly_salary}`,
  )
}

// ---- most recent audit log ----
line()
console.log('MOST RECENT AUDIT LOG (last 8 changes)')
line()
const audits = db
  .prepare(
    `SELECT created_at, actor_name, action, entity, details
     FROM audit_logs ORDER BY created_at DESC LIMIT 8`,
  )
  .all()
for (const entry of audits) {
  console.log(`  ${entry.created_at.slice(0, 19)}  ${(entry.actor_name ?? '—').padEnd(14)} ${entry.action.padEnd(11)} ${entry.details ?? ''}`)
}

console.log('\nTip: run this again after changing something in the app to see the row counts and log grow.\n')

db.close()
