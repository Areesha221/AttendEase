// ============================================================
// SQLite connection (Node's built-in node:sqlite - no native build)
// Server-side only. Never import this file from a Client Component.
// ============================================================

import { DatabaseSync, type SQLInputValue, type SQLOutputValue } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const DB_PATH = process.env.ATTENDANCE_DB_PATH ?? path.join(process.cwd(), 'data', 'attendance.db')
const SCHEMA_PATH = path.join(process.cwd(), 'lib', 'schema.sql')

declare global {
  // Reused across dev hot-reloads so we do not open many handles.
  var __attendanceDb: DatabaseSync | undefined
}

function openDatabase(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const database = new DatabaseSync(DB_PATH)
  database.exec('PRAGMA journal_mode = WAL;')
  database.exec('PRAGMA foreign_keys = ON;')
  // During `next build` several workers open the database at the same time.
  // Let a writer wait for the lock instead of failing with SQLITE_BUSY.
  database.exec('PRAGMA busy_timeout = 15000;')
  database.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'))

  // ---- lightweight migrations (idempotent, safe on every start) ----
  // `CREATE TABLE IF NOT EXISTS` cannot add columns to an existing table, so
  // columns added after the first release are appended here. Existing data is
  // never dropped or re-seeded.
  const attendanceColumns = database.prepare('PRAGMA table_info(attendance)').all() as Array<{ name: string }>
  const hasAttendanceColumn = (name: string) => attendanceColumns.some((column) => column.name === name)

  if (!hasAttendanceColumn('review_status')) {
    database.exec("ALTER TABLE attendance ADD COLUMN review_status TEXT NOT NULL DEFAULT 'not_required'")
  }
  if (!hasAttendanceColumn('review_note')) {
    database.exec('ALTER TABLE attendance ADD COLUMN review_note TEXT')
  }
  if (!hasAttendanceColumn('reviewed_by')) {
    database.exec('ALTER TABLE attendance ADD COLUMN reviewed_by TEXT')
  }
  if (!hasAttendanceColumn('reviewed_at')) {
    database.exec('ALTER TABLE attendance ADD COLUMN reviewed_at TEXT')
  }

  // Flagged / outside-office events (including ones captured before the
  // review feature existed) need a boss decision. Events still waiting to
  // sync from a past date also land in the review queue. The count check
  // keeps this a read-only operation on a normal boot.
  const needsReviewRow = database
    .prepare(
      `SELECT COUNT(*) AS count FROM attendance
        WHERE review_status = 'not_required'
          AND (verification = 'flagged' OR location_status = 'outside' OR sync_status = 'pending')`,
    )
    .get() as { count: number }

  if (needsReviewRow.count > 0) {
    database.exec(
      `UPDATE attendance
          SET review_status = 'pending'
        WHERE review_status = 'not_required'
          AND (verification = 'flagged' OR location_status = 'outside' OR sync_status = 'pending')`,
    )
  }

  // Employees created before the joining-date rules get a sensible start
  // date: their earliest attendance, or the day their record was created.
  const missingJoiningRow = database
    .prepare(
      `SELECT COUNT(*) AS count FROM employees
        WHERE joining_date IS NULL OR trim(joining_date) = ''`,
    )
    .get() as { count: number }

  if (missingJoiningRow.count > 0) {
    database.exec(
      `UPDATE employees
          SET joining_date = COALESCE(
            (SELECT MIN(a.work_date) FROM attendance a WHERE a.employee_id = employees.id),
            substr(created_at, 1, 10)
          )
        WHERE joining_date IS NULL OR trim(joining_date) = ''`,
    )
  }

  return database
}

export const db: DatabaseSync = globalThis.__attendanceDb ?? (globalThis.__attendanceDb = openDatabase())

export const databasePath = DB_PATH

/** Run a query and return every row. */
export function all<T = Record<string, SQLOutputValue>>(sql: string, params: SQLInputValue[] = []): T[] {
  return db.prepare(sql).all(...params) as T[]
}

/** Run a query and return the first row (or undefined). */
export function get<T = Record<string, SQLOutputValue>>(sql: string, params: SQLInputValue[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

/** Run a statement that writes data. */
export function run(sql: string, params: SQLInputValue[] = []) {
  return db.prepare(sql).run(...params)
}

/** Wrap a group of writes in a transaction. */
export function transaction<T>(work: () => T): T {
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** Short, URL-safe unique id. */
export function newId(prefix = ''): string {
  const random = Math.random().toString(36).slice(2, 10)
  const stamp = Date.now().toString(36)
  return `${prefix}${prefix ? '_' : ''}${stamp}${random}`
}
