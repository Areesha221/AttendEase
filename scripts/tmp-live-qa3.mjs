// Temporary live-QA helper: throwaway employee used to exercise the anti-fraud
// checks against the deployed site, removed immediately afterwards.
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'

for (const raw of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
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

const mode = process.argv[2] ?? 'create'
const EMAIL = 'qa.fraud@example.com'
const USER_ID = 'usr_qa_fraud'
const EMPLOYEE_ID = 'emp_qa_fraud'
const CODE = 'QA-FRAUD-1'
const PASSWORD = 'QaFraud-2026!'

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })

try {
  if (mode === 'create') {
    const now = new Date().toISOString()
    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, role, is_active, created_at)
            VALUES (?, ?, ?, 'employee', 1, ?)`,
      args: [USER_ID, EMAIL, bcrypt.hashSync(PASSWORD, 10), now],
    })
    await db.execute({
      sql: `INSERT INTO employees (id, user_id, employee_code, full_name, department, job_title,
                                   joining_date, status, monthly_salary, annual_leave_allowance, carry_forward_leave,
                                   consent, consent_at, created_at)
            VALUES (?, ?, ?, 'QA Fraud', 'Quality Assurance', 'Temporary QA', '2026-11-01', 'active', 0, 0, 0, 1, ?, ?)`,
      args: [EMPLOYEE_ID, USER_ID, CODE, now, now],
    })
    console.log('created', EMAIL, '/', PASSWORD)
  } else {
    await db.execute({ sql: 'DELETE FROM notifications WHERE user_id = ?', args: [USER_ID] })
    await db.execute({
      sql: "DELETE FROM notifications WHERE user_id IS NULL AND body LIKE ?",
      args: [`${CODE}%`],
    })
    await db.execute({ sql: 'DELETE FROM audit_logs WHERE actor_id = ?', args: [USER_ID] })
    await db.execute({ sql: 'DELETE FROM leaves WHERE employee_id = ?', args: [EMPLOYEE_ID] })
    await db.execute({ sql: 'DELETE FROM attendance WHERE employee_id = ?', args: [EMPLOYEE_ID] })
    await db.execute({ sql: 'DELETE FROM employees WHERE id = ?', args: [EMPLOYEE_ID] })
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [USER_ID] })
    console.log('removed temporary QA account')
  }

  const counts = await db.execute(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM employees) AS employees,
            (SELECT COUNT(*) FROM attendance) AS attendance,
            (SELECT COUNT(*) FROM attendance WHERE employee_id = ?) AS qa_events,
            (SELECT COUNT(*) FROM notifications WHERE body LIKE ?) AS qa_notices,
            (SELECT COUNT(*) FROM audit_logs WHERE actor_id = ?) AS qa_audits`,
    [EMPLOYEE_ID, `${CODE}%`, USER_ID],
  )
  console.log(JSON.stringify(counts.rows[0]))
} finally {
  db.close()
}
