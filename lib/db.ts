// ============================================================
// Database connection (Turso / libSQL, with a local SQLite file
// fallback for development).
//
// Production (Vercel):
//   TURSO_DATABASE_URL = libsql://<db>-<org>.turso.io
//   TURSO_AUTH_TOKEN   = <turso token>
//
// Local development (no env needed):
//   data/attendance.db is used through @libsql/client's file: driver.
//
// The client is async, so every query helper returns a Promise.
// Server-side only. Never import this file from a Client Component.
// ============================================================

import { createClient, type Client, type InValue, type Row, type Transaction } from '@libsql/client'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'attendance.db')
const DATABASE_URL =
  process.env.TURSO_DATABASE_URL ??
  process.env.ATTENDANCE_DB_URL ??
  `file:${DEFAULT_DB_PATH.replace(/\\/g, '/')}`
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN
const SCHEMA_PATH = path.join(process.cwd(), 'lib', 'schema.sql')

export const isRemoteDatabase = /^(libsql|https?|wss?):/i.test(DATABASE_URL)

declare global {
  // Reused across dev hot-reloads and serverless invocations so we do not
  // open a new connection for every request.
  var __attendanceClient: Client | undefined
  var __attendanceReady: Promise<void> | undefined
}

export const db: Client =
  globalThis.__attendanceClient ??
  (globalThis.__attendanceClient =
    createClient({
      url: DATABASE_URL,
      authToken: isRemoteDatabase ? AUTH_TOKEN : undefined,
    }))

/** Safe label for logs/health checks — never includes the auth token. */
export const databaseLabel = isRemoteDatabase
  ? DATABASE_URL.replace(/\/\/([^@/]+)@/, '//***@')
  : 'local SQLite file (data/attendance.db)'

async function migrate(client: Client): Promise<void> {
  if (!isRemoteDatabase) {
    fs.mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true })
    // Best-effort local tuning; ignored by remote Turso.
    try {
      await client.execute('PRAGMA journal_mode = WAL')
      await client.execute('PRAGMA busy_timeout = 15000')
    } catch {
      // The file driver may not support every pragma; safe to continue.
    }
  }

  const schema = fs
    .readFileSync(SCHEMA_PATH, 'utf8')
    // Connection pragmas are local settings; Turso rejects/ignores them and
    // they are not needed because foreign keys are enforced server-side.
    .split(/\r?\n/)
    .filter((line) => !/^\s*PRAGMA\b/i.test(line))
    .join('\n')

  await client.executeMultiple(schema)

  // ---- lightweight migrations (idempotent, safe on every start) ----
  // `CREATE TABLE IF NOT EXISTS` cannot add columns to an existing table, so
  // columns added after the first release are appended here. Existing data is
  // never dropped or re-seeded.
  const tableInfo = await client.execute('PRAGMA table_info(attendance)')
  const attendanceColumns = tableInfo.rows as unknown as Array<{ name: string }>
  const hasAttendanceColumn = (name: string) => attendanceColumns.some((column) => column.name === name)

  const addColumn = async (name: string, definition: string) => {
    if (hasAttendanceColumn(name)) return
    try {
      await client.execute(`ALTER TABLE attendance ADD COLUMN ${name} ${definition}`)
    } catch (error) {
      // A second serverless instance may have added it at the same time.
      const message = error instanceof Error ? error.message : String(error)
      if (!/duplicate column/i.test(message)) throw error
    }
  }

  await addColumn('review_status', "TEXT NOT NULL DEFAULT 'not_required'")
  await addColumn('review_note', 'TEXT')
  await addColumn('reviewed_by', 'TEXT')
  await addColumn('reviewed_at', 'TEXT')
  // Anti-fraud fingerprints (duplicate selfie / impossible travel).
  await addColumn('photo_hash', 'TEXT')
  await addColumn('photo_sha', 'TEXT')
  await addColumn('fraud_flags', 'TEXT')

  // Flagged / outside-office events (including ones captured before the
  // review feature existed) need a boss decision. Events still waiting to
  // sync from a past date also land in the review queue. The count check
  // keeps this a read-only operation on a normal boot.
  const needsReviewRow = (
    await client.execute(
      `SELECT COUNT(*) AS count FROM attendance
        WHERE review_status = 'not_required'
          AND (verification = 'flagged' OR location_status = 'outside' OR sync_status = 'pending')`,
    )
  ).rows[0] as unknown as { count: number } | undefined

  if ((needsReviewRow?.count ?? 0) > 0) {
    await client.execute(
      `UPDATE attendance
          SET review_status = 'pending'
        WHERE review_status = 'not_required'
          AND (verification = 'flagged' OR location_status = 'outside' OR sync_status = 'pending')`,
    )
  }

  // Employees created before the joining-date rules get a sensible start
  // date: their earliest attendance, or the day their record was created.
  const missingJoiningRow = (
    await client.execute(
      `SELECT COUNT(*) AS count FROM employees
        WHERE joining_date IS NULL OR trim(joining_date) = ''`,
    )
  ).rows[0] as unknown as { count: number } | undefined

  if ((missingJoiningRow?.count ?? 0) > 0) {
    await client.execute(
      `UPDATE employees
          SET joining_date = COALESCE(
            (SELECT MIN(a.work_date) FROM attendance a WHERE a.employee_id = employees.id),
            substr(created_at, 1, 10)
          )
        WHERE joining_date IS NULL OR trim(joining_date) = ''`,
    )
  }
}

function ensureReady(): Promise<void> {
  if (process.env.VERCEL && !isRemoteDatabase) {
    return Promise.reject(
      new Error(
        'TURSO_DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables.',
      ),
    )
  }
  if (!globalThis.__attendanceReady) {
    globalThis.__attendanceReady = migrate(db).catch((error) => {
      // Allow a later request to retry after a transient network failure.
      globalThis.__attendanceReady = undefined
      throw error
    })
  }
  return globalThis.__attendanceReady
}

/** Run a query and return every row. */
export async function all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureReady()
  const result = await db.execute({ sql, args: params as InValue[] })
  return result.rows as unknown as T[]
}

/** Run a query and return the first row (or undefined). */
export async function get<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await all<T>(sql, params)
  return rows[0]
}

/** Run a statement that writes data. */
export async function run(sql: string, params: unknown[] = []) {
  await ensureReady()
  return db.execute({ sql, args: params as InValue[] })
}

/** Wrap a group of writes in a transaction. */
export async function transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  await ensureReady()
  const tx = await db.transaction('write')
  try {
    const result = await work(tx)
    await tx.commit()
    return result
  } catch (error) {
    await tx.rollback()
    throw error
  } finally {
    tx.close()
  }
}

/** Short, URL-safe unique id. */
export function newId(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 10)
  const stamp = Date.now().toString(36)
  return `${prefix}${prefix ? '_' : ''}${stamp}${random}`
}
