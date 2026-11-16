#!/usr/bin/env node
// ============================================================
// Copy the local SQLite database to Turso (libSQL).
//
// Usage (from attendance-app/):
//   npm run db:migrate                 # copy all data
//   npm run db:migrate -- --clean-demo # copy, then remove demo employees
//
// Target connection is read from, in order:
//   --url / --token arguments
//   TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (environment or .env.local)
//
// Source defaults to data/attendance.db. Override with --source=...
// A file: target is allowed for dry runs, e.g.
//   node scripts/migrate-to-turso.mjs --url=file:data/test-copy.db
//
// The script is idempotent: rows are inserted with INSERT OR REPLACE
// (matched by primary key). Run it ONCE before going live. Re-running
// later would overwrite production rows with your local copy.
// ============================================================

import { createClient } from '@libsql/client'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const hasFlag = (name) => args.includes(name)
const argValue = (name) => {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.indexOf(name)
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return undefined
}

// Minimal .env.local loader (no extra dependency).
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

const sourcePath = argValue('--source') ?? 'data/attendance.db'
const targetUrl = argValue('--url') ?? process.env.TURSO_DATABASE_URL
const targetToken = argValue('--token') ?? process.env.TURSO_AUTH_TOKEN
const cleanDemo = hasFlag('--clean-demo')

if (!fs.existsSync(sourcePath)) {
  console.error(`Source database not found: ${sourcePath}`)
  console.error('Create it first with: npm run seed (this creates demo data), or pass --source=<path>.')
  process.exit(1)
}

if (!targetUrl) {
  console.error('No target database. Set TURSO_DATABASE_URL in .env.local or pass --url=libsql://...')
  process.exit(1)
}

const isRemote = /^(libsql|https?|wss?):/i.test(targetUrl)
if (isRemote && !targetToken) {
  console.error('A Turso database token is required. Set TURSO_AUTH_TOKEN or pass --token=...')
  process.exit(1)
}

const source = createClient({ url: `file:${path.resolve(sourcePath).replace(/\\/g, '/')}` })
const target = createClient({ url: targetUrl, authToken: isRemote ? targetToken : undefined })

const TABLE_ORDER = [
  'users',
  'employees',
  'settings',
  'attendance',
  'leaves',
  'holidays',
  'audit_logs',
  'notifications',
  'countries',
  'universities',
  'programs',
  'saved_programs',
]

const DEMO_EMAILS = ['ali@demo.com', 'ayesha@demo.com', 'bilal@demo.com', 'sana@demo.com']

const quote = (name) => `"${String(name).replace(/"/g, '""')}"`

async function tableColumns(client, table) {
  const result = await client.execute(`PRAGMA table_info(${quote(table)})`)
  return result.rows.map((row) => String(row.name))
}

async function tableCount(client, table) {
  try {
    const result = await client.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`)
    return Number(result.rows[0]?.n ?? 0)
  } catch {
    return 0
  }
}

async function main() {
  console.log(`Source : ${path.resolve(sourcePath)}`)
  console.log(`Target : ${targetUrl.replace(/\/\/([^@/]+)@/, '//***@')}`)
  console.log(`Clean  : ${cleanDemo ? 'yes (demo employees will be removed)' : 'no'}`)
  console.log('')

  // 1. Create every table/index on the target.
  const schema = fs
    .readFileSync(path.join(process.cwd(), 'lib', 'schema.sql'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !/^\s*PRAGMA\b/i.test(line))
    .join('\n')
  await target.executeMultiple(schema)
  console.log('✓ Schema created (or already present).')

  // 2. Some deployed databases may predate a column. Add them safely.
  const targetAttendanceColumns = await tableColumns(target, 'attendance')
  const addColumn = async (name, definition) => {
    if (targetAttendanceColumns.includes(name)) return
    try {
      await target.execute(`ALTER TABLE attendance ADD COLUMN ${name} ${definition}`)
      console.log(`  + added attendance.${name}`)
    } catch (error) {
      if (!/duplicate column/i.test(error instanceof Error ? error.message : String(error))) throw error
    }
  }
  await addColumn('review_status', "TEXT NOT NULL DEFAULT 'not_required'")
  await addColumn('review_note', 'TEXT')
  await addColumn('reviewed_by', 'TEXT')
  await addColumn('reviewed_at', 'TEXT')

  // 3. Copy rows, parents first so foreign keys stay valid.
  const discovered = (
    await source.execute(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
  ).rows.map((row) => String(row.name))
  const tables = [...TABLE_ORDER.filter((table) => discovered.includes(table))]
  for (const table of discovered) {
    if (!tables.includes(table)) tables.push(table)
  }

  for (const table of tables) {
    const sourceColumns = await tableColumns(source, table)
    const targetColumns = await tableColumns(target, table)
    const columns = sourceColumns.filter((column) => targetColumns.includes(column))
    if (columns.length === 0) {
      console.log(`- ${table}: skipped (no matching columns)`)
      continue
    }

    const rows = (await source.execute(`SELECT ${columns.map(quote).join(', ')} FROM ${quote(table)}`)).rows
    if (rows.length === 0) {
      console.log(`- ${table}: 0 rows`)
      continue
    }

    const sql = `INSERT OR REPLACE INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES (${columns
      .map(() => '?')
      .join(', ')})`

    const tx = await target.transaction('write')
    try {
      for (const row of rows) {
        await tx.execute({
          sql,
          args: columns.map((column) => row[column] ?? null),
        })
      }
      await tx.commit()
    } catch (error) {
      await tx.rollback()
      throw error
    } finally {
      tx.close()
    }
    console.log(`✓ ${table}: ${rows.length} row(s) copied`)
  }

  // 4. Optional cleanup: remove the demo employees and everything linked to
  //    them. Real employees (and the boss account) are never touched.
  if (cleanDemo) {
    console.log('')
    console.log('Cleaning demo data…')
    const placeholders = DEMO_EMAILS.map(() => '?').join(', ')

    const userRows = (
      await target.execute({
        sql: `SELECT id, email FROM users WHERE lower(email) IN (${placeholders})`,
        args: DEMO_EMAILS,
      })
    ).rows
    const userIds = userRows.map((row) => String(row.id))

    const employeeRows = userIds.length
      ? (
          await target.execute({
            sql: `SELECT id, user_id, full_name FROM employees WHERE user_id IN (${userIds.map(() => '?').join(', ')})`,
            args: userIds,
          })
        ).rows
      : []
    const employeeIds = employeeRows.map((row) => String(row.id))
    const demoNames = employeeRows.map((row) => String(row.full_name))

    const deleteWhere = async (table, column, values) => {
      if (values.length === 0) return 0
      const marks = values.map(() => '?').join(', ')
      const result = await target.execute({
        sql: `DELETE FROM ${quote(table)} WHERE ${quote(column)} IN (${marks})`,
        args: values,
      })
      return result.rowsAffected
    }

    const removed = {
      attendance: await deleteWhere('attendance', 'employee_id', employeeIds),
      leaves: await deleteWhere('leaves', 'employee_id', employeeIds),
      notifications: await deleteWhere('notifications', 'user_id', userIds),
      employees: await deleteWhere('employees', 'id', employeeIds),
      users: await deleteWhere('users', 'id', userIds),
    }

    // Broadcast notifications (user_id NULL) and audit rows that mention a
    // demo employee are also noise on a portfolio site.
    let removedNotifications = 0
    let removedAudit = 0
    for (const name of demoNames) {
      const notificationResult = await target.execute({
        sql: `DELETE FROM notifications WHERE user_id IS NULL AND (title LIKE ? OR body LIKE ?)`,
        args: [`%${name}%`, `%${name}%`],
      })
      removedNotifications += notificationResult.rowsAffected
      const auditResult = await target.execute({
        sql: `DELETE FROM audit_logs WHERE actor_name = ? OR details LIKE ?`,
        args: [name, `%${name}%`],
      })
      removedAudit += auditResult.rowsAffected
    }
    removed.notifications += removedNotifications
    removed.audit_logs = removedAudit

    console.log(`  demo emails: ${userRows.map((row) => row.email).join(', ') || 'none found'}`)
    console.log(`  demo names : ${demoNames.join(', ') || 'none found'}`)
    for (const [table, count] of Object.entries(removed)) {
      console.log(`  - ${table}: ${count} row(s) deleted`)
    }
  }

  // 5. Report final row counts.
  console.log('')
  console.log('Final row counts on the target:')
  for (const table of tables) {
    console.log(`  ${table.padEnd(16)} ${await tableCount(target, table)}`)
  }
  console.log('')
  console.log('Done. Next: set a strong boss password with  npm run db:boss-password')

  source.close()
  target.close()
}

main().catch((error) => {
  console.error('')
  console.error('Migration failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
